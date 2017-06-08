import * as Archiver from 'archiver';
import * as Bluebird from 'bluebird';
import * as c from 'chalk';
import { copy, createWriteStream, emptyDir, ensureDir } from 'fs-extra';
import { clone, isArray, merge } from 'lutils';
import * as path from 'path';
import * as semver from 'semver';
import { FileBuild } from './FileBuild';
import { Logger } from './Logger';
import { ModuleBundler } from './ModuleBundler';
import { SourceBundler } from './SourceBundler';
import { IPluginConfig, ISls } from './types';
import { colorizeConfig, loadFile } from './utils';

export class ServerlessBuildPlugin {
  config: IPluginConfig = {
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
  };

  serverless: ISls;
  servicePath: string;
  tmpDir: string;
  buildTmpDir: string;
  artifactTmpDir: string;

  functions: any; // FIXME:
  hooks: any; // FIXME:

  fileBuild: FileBuild;
  logger: Logger;

  constructor (serverless: ISls, options = {}) {
    //
    // SERVERLESS
    //

    this.serverless = serverless;

    if (semver.lt(this.serverless.getVersion(), '1.0.0')) {
      throw new this.serverless.classes.Error(
        'serverless-build-plugin requires serverless@1.x.x',
      );
    }

    // put the package plugin into 'individual' mode
    this.serverless.service.package.individually = true;

    // in sls 1.11 and lower this will skip 'archiving' (no effect in 1.12+)
    this.serverless.service.package.artifact = true;

    // in sls 1.12 and high this will skip 'archiving'
    if (semver.gte(this.serverless.getVersion(), '1.12.0')) {
      const packagePlugin = this.serverless.pluginManager.plugins.reduce((acc, val) => {
        if (val.constructor.name === 'Package') {
          return val;
        }
        return acc;
      }, false);

      packagePlugin.packageFunction = (functionName) => {
        const zipFileName = `${functionName}.zip`;

        const functionObject = this.serverless.service.getFunction(functionName);
        const funcPackageConfig = functionObject.package || {};

        const artifactFilePath = funcPackageConfig.artifact;
        const packageFilePath = path.join(this.serverless.config.servicePath,
          '.serverless',
          zipFileName,
        );

        return copy(artifactFilePath, packageFilePath).then(() => {
          functionObject.artifact = artifactFilePath;
          return artifactFilePath;
        });
      };
    }

    //
    // PLUGIN CONFIG GENERATION
    //

    this.servicePath = this.serverless.config.servicePath;
    this.tmpDir = path.join(this.servicePath, './.serverless');
    this.buildTmpDir = path.join(this.tmpDir, './build');
    this.artifactTmpDir = path.join(this.tmpDir, './artifacts');

    const buildConfigPath = path.join(this.servicePath, './serverless.build.yml');
    const buildConfig = loadFile(buildConfigPath) || {};
    const serverlessCustom = this.serverless.service.custom || {};

    // The config inherits from multiple sources
    this.config = merge(
      this.config,
      clone(serverlessCustom.build || {}),
      clone(buildConfig),
      clone(options),
    );

    const { functions } = this.serverless.service;

    const functionSelection = this.config.f || this.config.function;

    let selectedFunctions = isArray(functionSelection)
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
      const fnCfg = functions[fnKey];
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
      'before:offline:start': () => {
        if (!this.config.useServerlessOffline) { return null; }

        this.config.noDeploy = true;
        this.serverless.config.servicePath = this.buildTmpDir;

        return this.build();
      },
    };

    // hooks changed in 1.12 :/
    if (semver.gte(this.serverless.getVersion(), '1.12.0')) {
      this.hooks = {
        'before:package:initialize'               : this.build,
        'before:package:function:initialize'      : this.build,
        'after:package:createDeploymentArtifacts' : () => {
          this.serverless.service.package.artifact = null;
        },
        ...this.hooks,
      };
    } else {
      this.hooks = {
        'after:deploy:function:initialize'       : this.build,
        'after:deploy:initialize'                : this.build,
        'after:deploy:createDeploymentArtifacts' : () => {
          this.serverless.service.package.artifact = null;
        },
        ...this.hooks,
      };
    }

    this.logger = new Logger({ serverless });
  }

  /**
   *  Builds either from file or through the babel optimizer.
   */
  build = async () => {
    this.logger.message('BUILD', 'Build triggered...');

    const { method } = this.config;

    if (method === 'bundle') {
      const { uglify, babel, sourceMaps, babili } = this.config;
      this.logger.config(`${colorizeConfig({ method, uglify, babel, babili, sourceMaps })}`);
    } else {
      const { tryFiles } = this.config;
      this.logger.config(`${colorizeConfig({ method, tryFiles })}`);
    }

    // Ensure directories

    await ensureDir(this.buildTmpDir);
    await ensureDir(this.artifactTmpDir);

    if (!this.config.keep) { await emptyDir(this.artifactTmpDir); }

    /**
     * Iterate functions and run builds either synchronously or concurrently
     */
    await Bluebird.map(Object.keys(this.functions), (name) => {
      const config = this.functions[name];

      return this.buildFunction(name, config);
    }, {
      concurrency: this.config.synchronous ? 1 : Infinity,
    });

    this.logger.log('');
    this.logger.message('BUILD', 'Builds complete');
    this.logger.log('');

    if (this.config.deploy === false) { process.exit(); }
  }

  /**
   * Builds a function into an streaming zip artifact
   * and sets it in `serverless.yml:functions[fnName].artifact`
   * in order for `serverless` to consume it.
   */
  async buildFunction (fnName, fnConfig) {
    let moduleIncludes: Set<string>;
    const { method } = this.config;

    const artifact = Archiver('zip', { gzip: true, gzipOptions: { level: 5 } });

    this.logger.log('');
    this.logger.message('BUILD', c.reset.bold(fnName));

    if (method === 'bundle') {
      //
      // SOURCE BUNDLER
      //

      const sourceBundler = new SourceBundler({
        uglify: this.config.uglifySource
          ? this.config.uglify
          : undefined,

        logger: this.logger,
        archive: artifact,
        servicePath: this.servicePath,
      });

      this.logger.log('');

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

    this.logger.log('');

    await new ModuleBundler(
      {
        logger: this.logger,
        uglify: this.config.uglifyModules
          ? this.config.uglify
          : undefined,

        servicePath: this.servicePath,
        archive: artifact,
      },
    ).bundle({
      include: Array.from(moduleIncludes || []),
      ...this.config.modules,
    });

    await this.completeFunctionArtifact(fnName, artifact);
  }

  /**
   *  Writes the `artifact` and attaches it to serverless
   */
  private async completeFunctionArtifact (fnName: string, artifact: Archiver.Archiver) {
    const artifactPath = path.resolve(
      this.artifactTmpDir,
      `./${this.serverless.service.service}-${fnName}-${new Date().getTime()}.zip`,
    );

    artifact.finalize();

    await new Promise((resolve, reject) => {
      artifact
        .on('error', reject)
        .on('close', resolve);

      artifact.pipe(createWriteStream(artifactPath));

      artifact.end();
    });

    const fnConfig = this.serverless.service.functions[fnName];

    fnConfig.artifact = artifactPath;
    fnConfig.package = fnConfig.package || {};
    fnConfig.package.artifact = artifactPath;
  }
}
