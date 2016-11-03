import Promise from 'bluebird';
import path from 'path';
import Yazl from 'yazl';
import fs from 'fs-extra';
import { typeOf, merge, clone } from 'lutils';
import Yaml from 'js-yaml';

import ModuleBundler from './ModuleBundler';
import SourceBundler from './SourceBundler';
import FileBuild from './FileBuild';

Promise.promisifyAll(fs);

export default class ServerlessBuildPlugin {
  config = {
    tryFiles    : ['webpack.config.js'],
    baseExclude : [/\bnode_modules\b/],

    modules: {
      exclude     : ['aws-sdk'], // These match root dependencies
      deepExclude : ['aws-sdk'], // These match deep dependencies
    },

    exclude : [],
    include : [],

    uglify        : true,
    uglifySource  : false,
    uglifyModules : true,

    babel      : null,
    sourceMaps : true,

        // Passed to `yazl` as options
    zip: { compress: true },

    method : 'bundle',
    file   : null,

    functions: {},

    async: false,
  }

  constructor(serverless, options = {}) {
    //
    // SERVERLESS
    //

    this.serverless = serverless;

    if (!this.serverless.getVersion().startsWith('1')) {
      throw new this.serverless.classes.Error(
        'serverless-build-plugin requires serverless@1.x.x'
      );
    }

    // This causes the `package` plugin to skip
    this.serverless.service.package.artifact = true;

    // Ensurence
    this.serverless.service.package.individually = true;

    this.hooks = {
      'before:deploy:createDeploymentArtifacts' : async (...args) => this.build(...args),
      'after:deploy:createDeploymentArtifacts'  : () => {
        this.serverless.service.package.artifact = null;
      },
      'before:deploy:function:deploy': (...args) => this.build(...args),
    };

    //
    // PLUGIN CONFIG GENERATION
    //

    this.servicePath    = this.serverless.config.servicePath;
    this.tmpDir         = path.join(this.servicePath, './.serverless');
    this.buildTmpDir    = path.join(this.tmpDir, './build');
    this.artifactTmpDir = path.join(this.tmpDir, './artifacts');

    const buildConfigPath = path.join(this.servicePath, './serverless.build.yml');

    const buildConfig = fs.existsSync(buildConfigPath)
      ? Yaml.load(fs.readFileSync(buildConfigPath))
      : {};

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

    selectedFunctions = selectedFunctions.filter((key) => key in functions);
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

        package: {
          ...(fnCfg.package || {}),
          ...(this.config.functions[fnKey] || {}),
          include,
          exclude,
        },
      };

      return obj;
    }, {});
  }

  log = (...args) => this.serverless.cli.log(...args)

  /**
   *  Builds either from file or through the babel optimizer.
   */
  async build() {
    this.log('Builds triggered');

    await fs.ensureDirAsync(this.buildTmpDir);
    await fs.ensureDirAsync(this.artifactTmpDir);

    if (!this.config.keep) await fs.emptyDirAsync(this.artifactTmpDir);

    await Promise.map(Object.keys(this.functions), (name) => {
      const config = this.functions[name];

      return this.buildFunction(name, config);
    }, {
      concurrency: this.config.async ? Infinity : 1,
    });

    this.log('');
    this.log('Builds complete');
    this.log('');

    if (this.config.debug) throw new Error('DEBUGGING STOP');
  }

  async buildFunction(fnName, fnConfig) {
    const artifact = new Yazl.ZipFile();
    const moduleIncludes = [];

    const { method } = this.config;

    this.log('');
    this.log(`[FUNCTION] ${fnName}`);

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

      // This builds all functions
      const fileBuild = await new FileBuild({
        ...this.config,

        servicePath : this.servicePath,
        buildTmpDir : this.buildTmpDir,
        serverless  : this.serverless,
        function    : fnConfig,
      }, artifact).build();

      moduleIncludes.push(...fileBuild.externals);
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
      artifact
    ).bundle({
      include: moduleIncludes,
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
