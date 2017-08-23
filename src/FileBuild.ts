import { Archiver } from 'archiver';
import * as Bluebird from 'bluebird';
import { existsSync } from 'fs-extra';
import * as isStream from 'is-stream';
import { clone, isFunction, isObject, isString, merge } from 'lutils';
import * as path from 'path';
import * as requireResolve from 'resolve-pkg';
import { Logger } from './lib/Logger';
import { WebpackBuilder } from './WebpackBuilder';

export class FileBuild {
  logger: Logger;
  externals: Set<string>;
  webpackBuilder: WebpackBuilder;

  servicePath: string;
  buildTmpDir: string;
  tryFiles: string[];
  handlerEntryExt: string;

  constructor (config: {
    logger: Logger,
    servicePath: string,
    buildTmpDir: string,
    tryFiles: string[];
    handlerEntryExt: string;
  }) {
    Object.assign(this, config);

    this.externals = new Set();
    this.webpackBuilder = new WebpackBuilder({
      logger: this.logger,
      buildTmpDir: this.buildTmpDir,
      servicePath: this.servicePath,
    });

    try {
      // Register TypeScript for requiring if possible
      require(
        requireResolve('ts-node/register', { cwd: this.servicePath }),
      );
    } catch (err) { /**/ }
  }

  /**
   *  Handles building from a build file's output.
   */
  async build (
    fnConfig: { handler: string; },
    archive: Archiver,
  ) {
    let builderFilePath = this.tryBuildFiles();

    if (!builderFilePath) {
      throw new Error('Unrecognized build file path');
    }

    builderFilePath = path.resolve(this.servicePath, builderFilePath);

    const entryRelPath = `${fnConfig.handler.split(/\.[^.]+$/)[0]}`;
    const entryPoint = `./${entryRelPath}.${this.handlerEntryExt}`;
    const buildFilename = `./${entryRelPath}.js`;

    // eslint-disable-next-line
    let result = require(builderFilePath);

    // Fudge to default exports
    if (result instanceof Object && result.default) { result = result.default; }

    // Resolve any functions...
    if (isFunction(result)) {
      result = await Bluebird.try(() => result(fnConfig, this, { entryRelPath, entryPoint, buildFilename }));
    }

    //
    // - String, Buffer or Stream : piped as 'handler.js' into zip
    // - Webpack Config           : executed and output files are zipped
    //

    if (isObject(result)) {
      //
      // WEBPACK CONFIG
      //

      const webpackConfig = clone(result);

      merge(
        webpackConfig,
        {
          entry  : [...(webpackConfig.entry || []), entryPoint],
          output : {
            filename: buildFilename,
          },
        },
      );

      const externals = await this.webpackBuilder.build(webpackConfig);

      externals && externals.forEach((ext) => this.externals.add(ext));

      [buildFilename, `${buildFilename}.map`].forEach((relPath) => {
        const filePath = path.resolve(this.buildTmpDir, relPath);

        if (!existsSync(filePath)) { return; }

        archive.file(filePath, { name: relPath });
      });
    } else
    if (isString(result) || result instanceof Buffer) {
      //
      // STRINGS, BUFFERS
      //

      if (isString(result)) { result = new Buffer(result); }

      archive.append(result, { name: entryPoint });
    } else
    if (isStream(result)) {
      //
      // STREAMS
      //

      archive.append(result, { name: entryPoint });
    } else {
      throw new Error('Unrecognized build output');
    }

    return this;
  }

  /**
   *  Allows for build files to be auto selected
   */
  private tryBuildFiles () {
    for (const fileName of this.tryFiles) {
      if (existsSync(fileName)) { return fileName; }
    }

    return null;
  }
}
