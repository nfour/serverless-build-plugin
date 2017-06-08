import { exists, readFile } from 'fs-extra';
import { isObject, isRegExp } from 'lutils';
import * as glob from 'minimatch';
import { join } from 'path';
import { Logger } from './Logger';
import { BabelTransform } from './transforms/Babel';
import { UglifyTransform } from './transforms/Uglify';
import { handleFile, walker } from './utils';

/**
 *  @class SourceBundler
 *
 *  Handles the inclusion of source code in the artifact.
 */
export class SourceBundler {
  config: any;
  logger: Logger;
  artifact: any; // FIXME:

  constructor (config = {}, artifact) {
    this.config = {
      servicePath         : '',        // serverless.config.servicePath
      babel               : null,      // Babel options
      babili              : false,      // Babel options
      uglify              : null,      // UglifyJS options
      sourceMaps          : false,     // Whether to add source maps
      zip                 : null,      // Yazl zip options
      transformExtensions : ['ts', 'js', 'jsx', 'tsx'],
      ...config,
    };

    this.logger = this.config.logger;
    this.artifact = artifact;
  }

  /**
   *  Walks through, transforms, and zips source content wich
   *  is both `included` and not `excluded` by the regex or glob patterns.
   */
  async bundle ({ exclude = [], include = [] }) {
    const transforms = await this.createTransforms();

    // We never want node_modules here
    await walker(this.config.servicePath, { filters: [/\/node_modules\//i] })
      .on('file', async (filePath, stats, stop) => {
        /**
         *  A relative path to the servicePath
         *  @example ./functions/test/handler.js
         */
        const relPath = join(
          filePath.split(this.config.servicePath)[1],
        ).replace(/^\/|\/$/g, '');

        const testPattern = (pattern) => (
          isRegExp(pattern)
            ? pattern.test(relPath)
            : glob(relPath, pattern, { dot: true })
        );

        const included = include.some(testPattern);
        const excluded = exclude.some(testPattern);

        /**
         *  When a pattern matches an exclude, it skips
         *  When a pattern doesnt match an include, it skips
         */
        if (!included || excluded) { return; }

        await handleFile({
          filePath,
          relPath,
          transforms,
          transformExtensions : this.config.transformExtensions,
          useSourceMaps       : this.config.sourceMaps,
          artifact            : this.artifact,
          zipConfig           : this.config.zip,
        });

        this.logger.source({ filePath: relPath });
      })
      .end();

    return this.artifact;
  }

  private async createTransforms () {
    const transforms = [];

    if (this.config.babel) {
      let babelQuery = this.config.babel;

      if (!isObject(babelQuery)) {
        const babelrcPath = join(this.config.servicePath, '.babelrc');

        babelQuery = exists(babelrcPath)
          ? JSON.parse(await readFile(babelrcPath, 'utf8'))
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
      if (!isObject(uglifyConfig)) { uglifyConfig = null; }

      transforms.push(new UglifyTransform(uglifyConfig, { ...this.config, logErrors: true }));
    }

    return transforms;
  }
}
