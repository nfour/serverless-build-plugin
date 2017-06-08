import * as Bluebird from 'bluebird';
import { exists } from 'fs-extra';
import isStream from 'is-stream';
import { clone, isFunction, isObject, isString, merge } from 'lutils';
import path from 'path';

import { WebpackBuilder } from './WebpackBuilder';

export class FileBuild {
  log: any; // FIXME:
  externals: Set<string>;
  alreadyBuilt: Set<string>;
  config: any; // FIXME:

  constructor (config) {
    this.config = {
      servicePath     : '',   // ./
      buildTmpDir     : '',   // ./.serverless/build
      zip             : null, // Yazl zip options
      tryFiles        : [],   // Array of relative paths to test for a build file
      handlerEntryExt : 'js',
      ...config,
    };

    this.log = this.config.log || (() => null);

    this.externals = new Set();
    this.alreadyBuilt = new Set();
  }

  /**
   *  Handles building from a build file's output.
   */
  async build (fnConfig, artifact) {
    //
    // RESOLVE BUILD FILE
    //

    let builderFilePath = await this.tryBuildFiles();

    if (!builderFilePath) {
      throw new Error('Unrecognized build file path');
    }

    builderFilePath = path.resolve(this.config.servicePath, builderFilePath);

    // eslint-disable-next-line
    let result = require(builderFilePath);

    // Resolve any functions...
    if (isFunction(result)) {
      result = await Bluebird.try(() => result(fnConfig, this));
    }

    //
    // HANDLE RESULT OUTPUT:
    //
    // - String, Buffer or Stream:   piped as 'handler.js' into zip
    // - Webpack Config:             executed and output files are zipped
    //

    const entryRelPath = `${fnConfig.handler.split(/\.[^.]+$/)[0]}`;
    const entryPoint = `./${entryRelPath}.${this.config.handlerEntryExt}`;
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

        const { externals } = await new WebpackBuilder(this.config).build(webpackConfig);

        externals.forEach((ext) => this.externals.add(ext));
      }

      await Bluebird.each([
        buildFilename, `${buildFilename}.map`,
      ], async (relPath) => {
        const filePath = path.resolve(this.config.buildTmpDir, relPath);

        try {
          await exists(filePath);
        } catch (err) { return; }

        artifact.addFile(filePath, relPath, this.config.zip);
      });
    } else
    if (isString(result) || result instanceof Buffer) {
      //
      // STRINGS, BUFFERS
      //

      if (isString(result)) { result = new Buffer(result); }

      artifact.addBuffer(result, entryPoint, this.config.zip);
    } else
    if (isStream(result)) {
      //
      // STREAMS
      //

      artifact.addReadStream(result, entryPoint, this.config.zip);
    } else {
      throw new Error('Unrecognized build output');
    }

    return this;
  }

  /**
   *  Allows for build files to be auto selected
   */
  private async tryBuildFiles () {
    for (const fileName of this.config.tryFiles) {
      if (await exists(fileName)) { return fileName; }
    }

    return null;
  }
}
