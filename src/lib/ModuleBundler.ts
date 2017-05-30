import Promise from 'bluebird';
import path, { sep } from 'path';
import fs from 'fs-extra';
import resolvePackage from 'resolve-pkg';

import { walker, handleFile, displayModule } from './utils';
import UglifyTransform from './transforms/Uglify';

Promise.promisifyAll(fs);

/**
 *  @class ModuleBundler
 *
 *  Handles the inclusion of node_modules.
 */
export default class ModuleBundler {
  constructor(config = {}, artifact) {
    this.config = {
      servicePath : '',   // serverless.config.servicePath
      uglify      : null, // UglifyJS config
      zip         : null, // Yazl zip config
      ...config,
    };

    this.log = this.config.log || (() => {});

    this.artifact = artifact;
  }

  /**
   *  Determines module locations then adds them into ./node_modules
   *  inside the artifact.
   */
  async bundle({ include = [], exclude = [], deepExclude = [] }) {
    this.modules = await ModuleBundler.resolveDependencies(
      this.config.servicePath,
      { include, exclude, deepExclude },
    );

    const transforms = await this._createTransforms();

    await Promise.map(this.modules, async ({ packagePath, relativePath, packageJson }) => {
      await walker(packagePath)
        .on('directory', (dirPath, stats, stop) => {
          if (stats.isDirectory()) {
            // This pulls ['node_modules', 'pack'] out of
            // .../node_modules/package/node_modules/pack
            const endParts = dirPath.split(packagePath)[1].split('/').slice(-2);

            // When a directory is a package and matches a deep exclude pattern
            // Then skip it
            if (
              endParts[0] === 'node_modules' &&
              deepExclude.indexOf(endParts[1]) !== -1
            ) return stop();
          }

          return null;
        })
        .on('file', async (filePath, stats, next) => {
          const relPath = filePath.substr(filePath.indexOf(relativePath)).replace(/^\/|\/$/g, '');

          await handleFile({
            filePath,
            relPath,
            transforms,
            transformExtensions : ['js', 'jsx'],
            useSourceMaps       : false,
            artifact            : this.artifact,
            zipConfig           : this.config.zip,
          });
        })
        .end();

      this.log(`[MODULE] ${displayModule({ filePath: relativePath, packageJson })}`);
    });

    return this;
  }

  async _createTransforms() {
    const transforms = [];

    let uglifyConfig = this.config.uglify;

    if (uglifyConfig) {
      if (uglifyConfig === true) uglifyConfig = null;

      transforms.push(new UglifyTransform(uglifyConfig, this.config));
    }

    return transforms;
  }

  /**
   *  Resolves a package's dependencies to an array of paths.
   *
   *  @returns {Array}
   *      [ { name, packagePath, packagePath } ]
   */
  static async resolveDependencies(
    initialPackageDir,
    { include = [], exclude = [], deepExclude = [] } = {},
  ) {
    const resolvedDeps = [];
    const cache        = {};
    const separator    = `${sep}node_modules${sep}`;

    /**
     *  Resolves packages to their package root directory &
     *  also resolves dependant packages recursively.
     *  - Will also ignore the input package in the results
     */
    const recurse = async (packageDir, _include = [], _exclude = []) => {
      const packageJson = require(path.join(packageDir, './package.json')); // eslint-disable-line
      const { name, dependencies } = packageJson;

      const result = {
        name,
        packagePath: packageDir,
      };

      if (!dependencies) return result;

      await Promise.map(Object.keys(dependencies), async (packageName) => {
        /**
         *  Skips on exclude matches, if set
         *  Skips on include mis-matches, if set
         */
        if (_exclude.length && _exclude.indexOf(packageName) > -1) return;
        if (_include.length && _include.indexOf(packageName) < 0) return;

        const resolvedDir  = resolvePackage(packageName, { cwd: packageDir });

        const childPackageJsonPath = path.join(resolvedDir, './package.json');

        let childPackageJson;
        if (fs.existsSync(childPackageJsonPath)) childPackageJson = require(childPackageJsonPath); // eslint-disable-line

        if (!resolvedDir) return;

        const relativePath = path.join('node_modules', resolvedDir.split(separator).slice(1).join(separator));

        if (relativePath in cache) return;

        cache[relativePath] = true;

        const childResult = await recurse(resolvedDir, undefined, deepExclude);

        resolvedDeps.push({ ...childResult, relativePath, packageJson: childPackageJson });
      });

      return result;
    };

    await recurse(initialPackageDir, include, exclude);

    return resolvedDeps;
  }
}
