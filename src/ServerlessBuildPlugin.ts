import * as Archiver from 'archiver';
import * as Bluebird from 'bluebird';
import * as c from 'chalk';
import { copy, createWriteStream, emptyDir, ensureDir } from 'fs-extra';
import { clone, isArray, merge } from 'lutils';
import * as path from 'path';
import * as semver from 'semver';
import { defaultConfig, IPluginConfig } from './config';
import { FileBuild } from './FileBuild';
import { Logger } from './lib/Logger';
import { loadFile } from './lib/utils';
import { ModuleBundler } from './ModuleBundler';
import { SourceBundler } from './SourceBundler';

export class ServerlessBuildPlugin {
  config: IPluginConfig = defaultConfig;

  serverless: any;
  servicePath: string;
  tmpDir: string;
  buildTmpDir: string;
  artifactTmpDir: string;

  functions: any;
  hooks: any;

  fileBuild: FileBuild;
  logger: Logger;

  constructor (serverless, options = {}) {
    //
    // SERVERLESS
    //

    this.logger = new Logger({ serverless });
    this.serverless = serverless;

    const version = this.serverless.getVersion();

    if (semver.lt(version, '1.0.0')) {
      throw new this.serverless.classes.Error(
        'serverless-build-plugin requires serverless@1.x.x',
      );
    }

    this.servicePath = this.serverless.config.servicePath;
    this.tmpDir = path.join(this.servicePath, './.serverless');
    this.buildTmpDir = path.join(this.tmpDir, './build');
    this.artifactTmpDir = path.join(this.tmpDir, './artifacts');

    //
    // COMPATIBILITY
    //

    // Put the package plugin into 'individual' mode
    this.serverless.service.package.individually = true;

    // In sls 1.11 and lower this will skip 'archiving' (no effect in 1.12+)
    this.serverless.service.package.artifact = true;

    if (semver.lt(version, '1.12.0')) {
      this.logger.message(
        c.red('DEPRECATION'),
        'Upgrade to >= serverless@1.12. Build plugin is dropping support in the next major version',
      );
    }

    //
    // PLUGIN CONFIG GENERATION
    //

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
     *  An array of realized functions configs to build against.
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
    if (semver.gte(version, '1.12.0')) {
      this.overridePackagePlugin();

      this.hooks = {
        'before:package:function:package': this.build,
        'before:package:initialize': this.build,
        'after:package:createDeploymentArtifacts': () => {
          this.serverless.service.package.artifact = null;
        },
        ...this.hooks,
      };
    } else {
      this.hooks = {
        'after:deploy:function:initialize': this.build,
        'after:deploy:initialize': this.build,
        'after:deploy:createDeploymentArtifacts': () => {
          this.serverless.service.package.artifact = null;
        },
        ...this.hooks,
      };
    }

    this.fileBuild = new FileBuild({
      logger: this.logger,
      servicePath: this.servicePath,
      buildTmpDir: this.buildTmpDir,
      handlerEntryExt: this.config.handlerEntryExt,
      tryFiles: this.config.tryFiles,
    });

  }

  /**
   *  Builds either from file or through babel
   */
  build = async () => {
    this.logger.message('BUILDS', 'Initializing');
    this.logger.log('');

    const reduceConfig = (keys) =>
      keys.reduce((obj, key) => {
        obj[key] = this.config[key];
        return obj;
      }, {});

    if (this.config.method === 'file') {
      this.logger.config(reduceConfig([
        'method', 'tryFiles', 'handlerEntryExt',
        'synchronous', 'deploy', 'useServerlessOffline',
        'modules', 'zip',
        'followSymlinks',
      ]));
    } else {
      this.logger.config(reduceConfig([
        'method',
        'synchronous', 'deploy', 'useServerlessOffline',
        'babel', 'babili', 'uglify', 'uglifySource', 'uglifyModules',
        'nomralizeBabelExt', 'sourceMaps', 'transformExtensions',
        'baseExclude',
        'modules', 'include', 'exclude', 'zip',
        'followSymlinks',
      ]));
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
    this.logger.message('BUILDS', 'Complete!');
    this.logger.log('');

    if (this.config.deploy === false) {
      this.logger.message('EXIT', 'User requested via --no-deploy');

      await Bluebird.delay(1);

      process.exit();
    }
  }

  /**
   * Builds a function into an streaming zip artifact
   * and sets it in `serverless.yml:functions[fnName].artifact`
   * in order for `serverless` to consume it.
   */
  async buildFunction (fnName, fnConfig) {
    let moduleIncludes: Set<string>;
    const { method } = this.config;

    const artifact = Archiver('zip', this.config.zip);

    this.logger.message('FUNCTION', c.reset.bold(fnName));
    this.logger.log('');

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
        followSymlinks: this.config.followSymlinks,
      });

      this.logger.log('');

      await sourceBundler.bundle({
        exclude: fnConfig.package.exclude,
        include: fnConfig.package.include,
      });
    } else
    if (method === 'file') {
      //
      // BUILD FILE
      //

      await this.fileBuild.build(fnConfig, artifact);

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
        followSymlinks: this.config.followSymlinks,
      },
    ).bundle({
      include: Array.from(moduleIncludes || []),
      ...this.config.modules,
    });

    this.logger.log('');

    const result = await this.completeFunctionArtifact(fnName, artifact);

    this.logger.log('');

    return result;
  }

  /**
   *  Writes the `artifact` and attaches it to serverless
   */
  private async completeFunctionArtifact (fnName: string, artifact: Archiver.Archiver) {
    const artifactPath = path.resolve(
      this.artifactTmpDir,
      `./${this.serverless.service.service}-${fnName}-${new Date().getTime()}.zip`,
    );

    await new Promise((resolve, reject) => {
      const stream = createWriteStream(artifactPath);
      stream
        .on('error', reject)
        .on('close', resolve);

      artifact.pipe(stream);
      artifact.finalize();
    });

    const size = `${(artifact.pointer() / 1024 / 1024).toFixed(4)} MB`;

    this.logger.message(
      'ARTIFACT',
      `${c.bold(fnName)} ${c.blue(size)}`,
    );

    const fnConfig = this.serverless.service.functions[fnName];

    fnConfig.artifact = artifactPath;
    fnConfig.package = fnConfig.package || {};
    fnConfig.package.artifact = artifactPath;

    return fnConfig;
  }

  /**
   * Mutates `packageFunction` on the `Package` serverless built-in plugin
   * in order to intercept
   */
  private overridePackagePlugin = () => {
    const packagePlugin = this.serverless.pluginManager.plugins.find((item) =>
      item.constructor.name === 'Package',
    );

    packagePlugin.packageFunction = async (fnName) => {
      const fnConfig = this.serverless.service.functions[fnName];
      const artifactPath = fnConfig.artifact || (fnConfig.package && fnConfig.package.artifact);

      if (!artifactPath) { throw new Error(`Artifact path not found for function ${fnName}`); }

      const packageFilePath = path.join(this.tmpDir, `./${fnName}.zip`);

      await copy(artifactPath, packageFilePath);

      fnConfig.artifact = artifactPath;

      return artifactPath;
    };
  }
}
