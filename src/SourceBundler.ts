import { Archiver } from 'archiver';
import { existsSync, readFile } from 'fs-extra';
import { isObject, isRegExp } from 'lutils';
import * as glob from 'minimatch';
import { join } from 'path';
import { Logger } from './lib/Logger';
import { handleFile } from './lib/utils';
import { Walker } from './lib/Walker';
import { BabelTransform } from './transforms/Babel';
import { UglifyTransform } from './transforms/Uglify';

/**
 *  @class SourceBundler
 *
 *  Handles the inclusion of source code in the artifact.
 */
export class SourceBundler {
  logger: Logger;
  archive: Archiver;
  servicePath: string;
  babel: any;
  uglify: any;
  sourceMaps = false;
  transformExtensions = ['ts', 'js', 'jsx', 'tsx'];

  constructor (config: {
    logger: Logger;
    archive: Archiver;
    servicePath: string;
    babel?: any;
    uglify?: any;
    sourceMaps?: boolean;
    transformExtensions?: string[];
  }) {
    Object.assign(this, config);
  }

  /**
   *  Walks through, transforms, and zips source content wich
   *  is both `included` and not `excluded` by the regex or glob patterns.
   */
  async bundle ({ exclude = [], include = [] }) {
    const transforms = await this.createTransforms();

    const onFile = async (filePath, stats, stop) => {
      /**
       *  A relative path to the servicePath
       *  @example ./functions/test/handler.js
       */
      const relPath = join(
        filePath.split(this.servicePath)[1],
      ).replace(/^\/|\/$/g, '');

      const testPattern = (pattern) => (
        isRegExp(pattern)
          ? pattern.test(relPath)
          : glob(relPath, pattern, { dot: true })
      );

      const isIncluded = include.some(testPattern);
      const isExcluded = exclude.some(testPattern);

      /**
       *  When a pattern matches an exclude, it skips
       *  When a pattern doesnt match an include, it skips
       */
      if (!isIncluded || isExcluded) { return; }

      await handleFile({
        filePath,
        relPath,
        transforms,
        transformExtensions: this.transformExtensions,
        useSourceMaps: this.sourceMaps,
        archive: this.archive,
      });

      this.logger.source({ filePath: relPath });
    };

    await new Walker(this.servicePath)
      .filter((dir) => !/\/node_modules\//i.test(dir))
      .file(onFile)
      .end();

    return this.archive;
  }

  private async createTransforms () {
    const transforms = [];

    if (this.babel) {
      let babelQuery = this.babel;

      if (!isObject(babelQuery)) {
        const babelrcPath = join(this.servicePath, '.babelrc');

        babelQuery = existsSync(babelrcPath)
          ? JSON.parse(await readFile(babelrcPath, 'utf8'))
          : {};
      }

      // If `sourceMaps` are switched off by the plugin's configuration,
      // ensure that is passed down to the babel transformer too.
      if (this.sourceMaps === false) {
        babelQuery.sourceMaps = false;
      }

      transforms.push(new BabelTransform(babelQuery, this));
    }

    let uglifyConfig = this.uglify;

    if (uglifyConfig) {
      if (!isObject(uglifyConfig)) { uglifyConfig = null; }

      transforms.push(
        new UglifyTransform(
          uglifyConfig,
          { servicePath: this.servicePath, logErrors: true },
        ),
      );
    }

    return transforms;
  }
}
