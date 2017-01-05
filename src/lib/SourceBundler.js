import Promise from 'bluebird';
import path from 'path';
import fs from 'fs-extra';
import { typeOf } from 'lutils';
import glob from 'minimatch';

import { walker, handleFile, displayModule } from './utils';
import BabelTransform from './transforms/Babel';
import UglifyTransform from './transforms/Uglify';

Promise.promisifyAll(fs);

/**
 *  @class SourceBundler
 *
 *  Handles the inclusion of source code in the artifact.
 */
export default class SourceBundler {
  constructor(config = {}, artifact) {
    this.config = {
      servicePath : '',        // serverless.config.servicePath
      babel       : null,      // Babel options
      babili      : false,      // Babel options
      uglify      : null,      // UglifyJS options
      sourceMaps  : false,     // Whether to add source maps
      zip         : null,      // Yazl zip options
      ...config,
    };

    this.log = this.config.log || (() => {});

    this.artifact = artifact;
  }

  /**
   *  Walks through, transforms, and zips source content wich
   *  is both `included` and not `excluded` by the regex or glob patterns.
   */
  async bundle({ exclude = [], include = [] }) {
    const transforms = await this._createTransforms();

    // We never want node_modules here
    await walker(this.config.servicePath, { filters: [/\/node_modules\//i] })
      .on('file', async (filePath, stats, stop) => {
        /**
         *  A relative path to the servicePath
         *  @example ./functions/test/handler.js
         */
        const relPath = path.join(
          filePath.split(this.config.servicePath)[1],
        ).replace(/^\/|\/$/g, '');

        const testPattern = (pattern) => {
          return typeOf.RegExp(pattern)
              ? pattern.test(relPath)
              : glob(relPath, pattern, { dot: true });
        };

        const included = include.some(testPattern);
        const excluded = exclude.some(testPattern);

        /**
        *  When a pattern matches an exclude, it skips
        *  When a pattern doesnt match an include, it skips
        */
        if (!included || excluded) return;

        await handleFile({
          filePath,
          relPath,
          transforms,
          transformExtensions : ['js', 'jsx'],
          useSourceMaps       : this.config.sourceMaps,
          artifact            : this.artifact,
          zipConfig           : this.config.zip,
        });

        this.log(`[SOURCE] ${displayModule({ filePath: relPath })}`);
      })
      .end();

    return this.artifact;
  }

  async _createTransforms() {
    const transforms = [];

    if (this.config.babel) {
      let babelQuery = this.config.babel;

      if (!typeOf.Object(babelQuery)) {
        const babelrcPath = path.join(this.config.servicePath, '.babelrc');

        babelQuery = fs.existsSync(babelrcPath)
          ? JSON.parse(await fs.readFileAsync(babelrcPath))
          : {};
      }

      // If `sourceMaps` are switched off by the plugin's configuration,
      // ensure that is passed down to the babel transformer too.
      if (this.config.sourceMaps === false) {
        babelQuery.sourceMaps = false;
      }

      transforms.push(new BabelTransform(babelQuery, this.config));
    }

    let uglifyConfig = this.config.uglify;

    if (uglifyConfig) {
      if (!typeOf.Object(uglifyConfig)) uglifyConfig = null;

      transforms.push(new UglifyTransform(uglifyConfig, { ...this.config, logErrors: true }));
    }

    return transforms;
  }
}
