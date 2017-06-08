import { Archiver } from 'archiver';
import * as Bluebird from 'bluebird';
import { exists } from 'fs-extra';
import * as isStream from 'is-stream';
import { clone, isFunction, isObject, isString, merge } from 'lutils';
import * as path from 'path';
import { Logger } from './Logger';
import { WebpackBuilder } from './WebpackBuilder';

export class FileBuild {
  logger: Logger; // FIXME:
  externals: Set<string>;
  alreadyBuilt: Set<string>;

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
    this.alreadyBuilt = new Set();
  }

  /**
   *  Handles building from a build file's output.
   */
  async build (
    fnConfig: { handler: string; },
    archive: Archiver,
  ) {
    let builderFilePath = await this.tryBuildFiles();

    if (!builderFilePath) {
      throw new Error('Unrecognized build file path');
    }

    builderFilePath = path.resolve(this.servicePath, builderFilePath);

    // eslint-disable-next-line
    let result = require(builderFilePath);

    // Resolve any functions...
    if (isFunction(result)) {
      result = await Bluebird.try(() => result(fnConfig, this));
    }

    //
    // - String, Buffer or Stream : piped as 'handler.js' into zip
    // - Webpack Config           : executed and output files are zipped
    //

    const entryRelPath = `${fnConfig.handler.split(/\.[^.]+$/)[0]}`;
    const entryPoint = `./${entryRelPath}.${this.handlerEntryExt}`;
    const buildFilename = `./${entryRelPath}.js`;

    if (isObject(result)) {
      //
      // WEBPACK CONFIG
      //

      if (!this.alreadyBuilt.has(entryRelPath)) {
        this.alreadyBuilt.add(entryRelPath);

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

        const { externals } = await new WebpackBuilder({
          logger: this.logger,
          buildTmpDir: this.buildTmpDir,
          servicePath: this.servicePath,
        }).build(webpackConfig);

        externals.forEach((ext) => this.externals.add(ext));
      }

      await Bluebird.each([
        buildFilename, `${buildFilename}.map`,
      ], async (relPath) => {
        const filePath = path.resolve(this.buildTmpDir, relPath);

        try {
          await exists(filePath);
        } catch (err) { return; }

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
  private async tryBuildFiles () {
    for (const fileName of this.tryFiles) {
      if (await exists(fileName)) { return fileName; }
    }

    return null;
  }
}
