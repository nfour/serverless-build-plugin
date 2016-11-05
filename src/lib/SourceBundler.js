import Promise from 'bluebird';
import path from 'path';
import fs from 'fs-extra';
import { typeOf } from 'lutils';
import glob from 'minimatch';

import { walker, handleFile } from './utils';
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

    const onFile = async (basePath, stats, next) => {
      /**
       *  A relative path to the servicePath
       *  @example ./functions/test/handler.js
       */
      const relPath = path.join(
        basePath.split(this.config.servicePath)[1], stats.name
      ).replace(/^\/|\/$/g, '');

      const filePath = path.join(basePath, stats.name);

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
      if (!included || (excluded && !included)) return next();

      await handleFile({
        filePath,
        relPath,
        transforms,
        transformExtensions : ['js', 'jsx'],
        useSourceMaps       : this.config.sourceMaps,
        artifact            : this.artifact,
        zipConfig           : this.config.zip,
      });

      this.log(`[SOURCE] ${relPath}`);

      return next();
    };

    // We never want node_modules here
    await walker(this.config.servicePath, { filters: [/\/node_modules\//i] })
      .on('file', onFile)
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
          : babelQuery;
      }

      transforms.push(new BabelTransform(babelQuery));
    }

    let uglifyConfig = this.config.uglify;

    if (uglifyConfig) {
      if (!typeOf.Object(uglifyConfig)) uglifyConfig = null;

      transforms.push(new UglifyTransform(uglifyConfig, { logErrors: true }));
    }

    return transforms;
  }

  //
  // FIXME: UNSUED CODE BELOW
  //

  /**
   *  Finds both .serverless-include and .serverless-exclude files
   *  Generates a concatenated exclude and include list.
   *
   *  All pathing is resolved to the servicePath, so that "*"
   *  in <servicePath>/lib/.serverless-exclude
   *  will be converted to "./lib/*", a relative path.
   *
   *  @returns {Object}
   *      {
   *          include: [ "./lib/**", ... ],
   *          exclude: [ ".git", "*", ... ]
   *      }
   *
   */
  async _findFilterFiles(rootPath) {
    const include = [];
    const exclude = [];

    const parseFile = async (filePath) => {
      const parentDir = path.dirname(filePath);

      const file = await fs.readFileAsync(filePath, 'utf8');

      return file.split('\n')
        .filter((line) => /\S/.test(line))
        .map((line) => {
          line = line.trim();
          line = path.join(parentDir.split(rootPath)[1] || '', line)
                .replace(/^\/|\/$/g, '');

          return `./${line}`;
        });
    };

    await walker(rootPath, { filters: ['node_modules'] })
      .on('file', async (root, { name }, next) => {
        const filePath = path.join(root, name);

        if (name === '.serverless-exclude') {
          const lines = await parseFile(filePath);
          exclude.push(...lines);
        } else
          if (name === '.serverless-include') {
            const lines = await parseFile(filePath);
            include.push(...lines);
          }

        next();
      })
      .end();

    return { include, exclude };
  }
}
