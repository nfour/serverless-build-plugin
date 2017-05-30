import Promise from 'bluebird';
import path from 'path';
import { typeOf, merge, clone } from 'lutils';
import fs from 'fs-extra';
import isStream from 'is-stream';

import WebpackBuilder from './Webpack';

Promise.promisifyAll(fs);

export default class FileBuild {
  constructor(config) {
    this.config = {
      servicePath     : '',   // ./
      buildTmpDir     : '',   // ./.serverless/build
      zip             : null, // Yazl zip options
      tryFiles        : [],   // Array of relative paths to test for a build file
      handlerEntryExt : 'js',
      ...config,
    };

    this.log = this.config.log || (() => {});

    this.externals = new Set();
    this.alreadyBuilt = new Set();
  }

  /**
   *  Handles building from a build file's output.
   */
  async build(fnConfig, artifact) {
    //
    // RESOLVE BUILD FILE
    //

    let builderFilePath = await this._tryBuildFiles();

    if (!builderFilePath) {
      throw new Error('Unrecognized build file path');
    }

    builderFilePath = path.resolve(this.config.servicePath, builderFilePath);

    // eslint-disable-next-line
    let result = require(builderFilePath);

    // Resolve any functions...
    if (typeOf.Function(result)) {
      result = await Promise.try(() => result(fnConfig, this));
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

    if (typeOf.Object(result)) {
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

        externals.forEach(ext => this.externals.add(ext));
      }

      await Promise.each([
        buildFilename, `${buildFilename}.map`,
      ], async (relPath) => {
        const filePath = path.resolve(this.config.buildTmpDir, relPath);

        try {
          await fs.accessAsync(filePath);
        } catch (err) { return; }

        artifact.addFile(filePath, relPath, this.config.zip);
      });
    } else
    if (typeOf.String(result) || result instanceof Buffer) {
      //
      // STRINGS, BUFFERS
      //

      if (typeOf.String(result)) result = new Buffer(result);

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
  async _tryBuildFiles() {
    for (const fileName of this.config.tryFiles) {
      const exists = await fs.statAsync(fileName).then(stat => stat.isFile());

      if (exists) return fileName;
    }

    return null;
  }
}
