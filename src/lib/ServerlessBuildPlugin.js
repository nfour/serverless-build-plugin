import Promise from 'bluebird';
import path from 'path';
import Yazl from 'yazl';
import fs from 'fs-extra';
import { typeOf, merge, clone } from 'lutils';
import c from 'chalk';
import semver from 'semver';

import { loadFile, colorizeConfig } from './utils';
import ModuleBundler from './ModuleBundler';
import SourceBundler from './SourceBundler';
import FileBuild from './FileBuild';

Promise.promisifyAll(fs);

export default class ServerlessBuildPlugin {
  config = {
    method: 'bundle',

    useServerlessOffline: false,

    tryFiles    : ['webpack.config.js'],
    baseExclude : [/\bnode_modules\b/],

    modules: {
      exclude     : [], // These match root dependencies
      deepExclude : [], // These match deep dependencies
    },

    exclude : [],
    include : [],

    uglify        : false,
    uglifySource  : false,
    uglifyModules : true,

    babel             : null,
    babili            : false,
    normalizeBabelExt : false,
    sourceMaps        : true,

    transformExtensions : ['ts', 'js', 'jsx', 'tsx'],
    handlerEntryExt     : 'js',

    // Passed to `yazl` as options
    zip: { compress: true },

    functions: {},

    synchronous : true,
    deploy      : true,
  }

  constructor(serverless, options = {}) {
    //
    // SERVERLESS
    //

    this.serverless = serverless;

    if (!semver.lt(this.serverless.getVersion(), '1.0.0') {
      throw new this.serverless.classes.Error(
        'serverless-build-plugin requires serverless@1.x.x',
      );
    }

    // This causes the `package` plugin to be skipped
    this.serverless.service.package.artifact     = true;
    this.serverless.service.package.individually = true;


    //
    // PLUGIN CONFIG GENERATION
    //

    this.servicePath    = this.serverless.config.servicePath;
    this.tmpDir         = path.join(this.servicePath, './.serverless');
    this.buildTmpDir    = path.join(this.tmpDir, './build');
    this.artifactTmpDir = path.join(this.tmpDir, './artifacts');

    const buildConfigPath  = path.join(this.servicePath, './serverless.build.yml');
    const buildConfig      = loadFile(buildConfigPath) || {};
    const serverlessCustom = this.serverless.service.custom || {};

    // The config inherits from multiple sources
    this.config = merge(
      this.config,
      clone(serverlessCustom.build || {}),
      clone(buildConfig),
      clone(options),
      { log: this.log },
    );

    const { functions } = this.serverless.service;

    const functionSelection = this.config.f || this.config.function;

    let selectedFunctions = typeOf.Array(functionSelection)
      ? functionSelection
      : [functionSelection];

    selectedFunctions = selectedFunctions.filter(key => key in functions);
    selectedFunctions = selectedFunctions.length ? selectedFunctions : Object.keys(functions);

    /**
     *  An array of full realized functions configs to build against.
     *  Inherits from
     *  - serverless.yml functions.<fn>.package
     *  - serverless.build.yml functions.<fn>
     *
     *  in order to generate `include`, `exclude`
     */
    this.functions = selectedFunctions.reduce((obj, fnKey) => {
      const fnCfg      = functions[fnKey];
      const fnBuildCfg = this.config.functions[fnKey] || {};

      const include = [
        ...(this.config.include || []),
        ...((fnCfg.package && fnCfg.package.include) || []),
        ...(fnBuildCfg.include || []),
      ];

      const exclude = [
        ...(this.config.baseExclude || []),
        ...(this.config.exclude || []),
        ...((fnCfg.package && fnCfg.package.exclude) || []),
        ...(fnBuildCfg.exclude || []),
      ];

      // Utilize the proposed `package` configuration for functions
      obj[fnKey] = {
        ...fnCfg,
        name: fnKey,

        package: {
          ...(fnCfg.package || {}),
          ...(this.config.functions[fnKey] || {}),
          include,
          exclude,
        },
      };

      return obj;
    }, {});


    this.hooks = {
      'after:deploy:createDeploymentArtifacts' : () => {
        this.serverless.service.package.artifact = null;
      },
      'before:offline:start': () => {
        if (!this.config.useServerlessOffline) return null;

        this.config.noDeploy = true;
        this.serverless.config.servicePath = this.buildTmpDir;

        return this.build();
      },
    };

    // hooks change from 1.12
    if (semver.gte(this.serverless.getVersion(), '1.12.0') {
      this.hooks = Object.assign({
        'before:package:initialize'          : this.build,
        'before:package:function:initialize' : this.build,
      }, this.hooks);
    } else {
      this.hooks = Object.assign({
        'after:deploy:function:initialize'   : this.build,
        'after:deploy:initialize'            : this.build,
      }, this.hooks);
    }
  }

  log = (...args) => this.serverless.cli.log(...args)

  /**
   *  Builds either from file or through the babel optimizer.
   */
  build = async () => {
    this.log('[BUILD] Builds triggered');

    const { method } = this.config;

    if (method === 'bundle') {
      const { uglify, babel, sourceMaps, babili } = this.config;
      this.log(`[BUILD] ${colorizeConfig({ method, uglify, babel, babili, sourceMaps })}`);
    } else {
      const { tryFiles } = this.config;
      this.log(`[BUILD] ${colorizeConfig({ method, tryFiles })}`);
    }

    // Ensure directories

    await fs.ensureDirAsync(this.buildTmpDir);
    await fs.ensureDirAsync(this.artifactTmpDir);

    if (!this.config.keep) await fs.emptyDirAsync(this.artifactTmpDir);

    /**
     * Iterate functions and run builds either synchronously or concurrently
     */
    await Promise.map(Object.keys(this.functions), (name) => {
      const config = this.functions[name];

      return this.buildFunction(name, config);
    }, {
      concurrency: this.config.synchronous ? 1 : Infinity,
    });

    this.log('');
    this.log('[BUILD] Builds complete');
    this.log('');

    if (this.config.deploy === false) process.exit();
  }

  /**
   * Builds a function into an streaming zip artifact
   * and sets it in `serverless.yml:functions[fnName].artifact`
   * in order for `serverless` to consume it.
   */
  async buildFunction(fnName, fnConfig) {
    const artifact = new Yazl.ZipFile();
    let moduleIncludes;

    const { method } = this.config;

    this.log('');
    this.log(`[FUNCTION] ${c.reset.bold(fnName)}`);

    if (method === 'bundle') {
      //
      // SOURCE BUNDLER
      //

      const sourceBundler = new SourceBundler({
        ...this.config,

        uglify: this.config.uglifySource
          ? this.config.uglify
          : undefined,

        servicePath: this.servicePath,
      }, artifact);

      this.log('');

      await sourceBundler.bundle({
        exclude : fnConfig.package.exclude,
        include : fnConfig.package.include,
      });
    } else
    if (method === 'file') {
      //
      // BUILD FILE
      //

      if (!this.fileBuild) {
        this.fileBuild = new FileBuild({
          ...this.config,

          servicePath : this.servicePath,
          buildTmpDir : this.buildTmpDir,
          serverless  : this.serverless,
        });
      }

      await this.fileBuild.build(fnConfig, artifact);

      // This builds all functions

      moduleIncludes = this.fileBuild.externals;
    } else {
      throw new Error('Unknown build method');
    }

    this.log('');

    await new ModuleBundler(
      {
        ...this.config,

        uglify: this.config.uglifyModules
          ? this.config.uglify
          : undefined,

        servicePath: this.servicePath,
      },
      artifact,
    ).bundle({
      include: Array.from(moduleIncludes || []),
      ...this.config.modules,
    });

    await this._completeFunctionArtifact(fnName, artifact);
  }

  /**
   *  Writes the `artifact` and attaches it to serverless
   */
  async _completeFunctionArtifact(fnName, artifact) {
    const zipPath = path.resolve(this.artifactTmpDir, `./${this.serverless.service.service}-${fnName}-${new Date().getTime()}.zip`);

    await new Promise((resolve, reject) => {
      artifact.outputStream.pipe(fs.createWriteStream(zipPath))
        .on('error', reject)
        .on('close', resolve);

      artifact.end();
    });

    const fnConfig = this.serverless.service.functions[fnName];

    fnConfig.artifact         = zipPath;
    fnConfig.package          = fnConfig.package || {};
    fnConfig.package.artifact = zipPath;
  }
}
