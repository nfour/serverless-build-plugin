import { Archiver } from 'archiver';
import * as Bluebird from 'bluebird';
import { existsSync } from 'fs-extra';
import { basename, join, sep } from 'path';
import * as resolvePackage from 'resolve-pkg';

import { Logger } from './lib/Logger';
import { readPath } from './lib/readPath';
import { handleFile } from './lib/utils';
import { UglifyTransform } from './transforms/Uglify';

export interface IModule {
  name: string;
  packagePath: string;
  relativePath: string;
  packageJson: any;
  packageDir: string;
}

export type IUglifyParams = null | boolean | { [key: string]: any };

/**
 *  @class ModuleBundler
 *
 *  Handles the inclusion of node_modules.
 */
export class ModuleBundler {
  modules: IModule[];

  logger: Logger;
  archive: Archiver;
  servicePath: string;
  uglify: IUglifyParams;

  constructor (config: {
    logger: Logger;
    archive: Archiver;
    servicePath: string;
    uglify?: IUglifyParams;
  }) {
    Object.assign(this, config);
  }

  /**
   *  Determines module locations then adds them into ./node_modules
   *  inside the artifact.
   */
  async bundle ({ include = [], exclude = [], deepExclude = [] }: {
    include?: string[], exclude?: string[], deepExclude?: string[],
  }) {
    this.modules = this.resolveDependencies(
      this.servicePath,
      { include, exclude, deepExclude },
      );

    const transforms = this.resolveTransforms();

    const readModule = async ({ packagePath, packageDir, relativePath, packageJson }) => {
      const basePath = `${packagePath}${sep}`;

      await readPath(basePath, {
        onFileFilter: ({ filePath }) => {
          if (!deepExclude.length) { return false; }

          // This pulls ['node_modules', 'pack'] out of
          // .../node_modules/package/node_modules/pack
          const endParts = filePath
            .split(packagePath)[1]
            .split('/')
            .slice(-2);

          // When a directory is a package and matches a deep exclude pattern
          // Then skip it
          if (
            endParts[0] === 'node_modules' &&
            deepExclude.indexOf(endParts[1]) !== -1
          ) {
            return true;
          }

          return false;
        },
        onFile: ({ filePath, previousPaths }) => {
          const relPath = join(
            'node_modules',
            basename(packagePath),
            ...previousPaths.slice(1).map((path) => basename(path)),
            basename(filePath),
          );

          console.dir({ packageDir, packagePath, relPath, filePath }, { colors: true });

          return handleFile({
            filePath,
            relPath,
            transforms,
            transformExtensions: ['js', 'jsx'],
            useSourceMaps: false,
            archive: this.archive,
          });
        },
      });

      return this.logger.module(({ filePath: relativePath, realPath: packagePath, packageJson }));
    };

    await Bluebird.map(this.modules, readModule);

    return this;
  }

  private resolveTransforms () {
    const transforms = [];

    let uglifyConfig = this.uglify;

    if (uglifyConfig) {
      if (uglifyConfig === true) { uglifyConfig = null; }

      transforms.push(new UglifyTransform(uglifyConfig, this));
    }

    return transforms;
  }

  /**
   * Resolves a package's dependencies to an array of paths.
   */
  private resolveDependencies (
    initialPackageDir,
    { include = [], exclude = [], deepExclude = [] } = {},
  ): IModule[] {
    const resolvedDeps: IModule[] = [];
    const cache: Set<string> = new Set();
    const separator = `${sep}node_modules${sep}`;

    /**
     *  Resolves packages to their package root directory &
     *  also resolves dependant packages recursively.
     *  - Will also ignore the input package in the results
     */
    const recurse = (packageDir, _include = [], _exclude = []) => {
      const packageJson = require(join(packageDir, './package.json')); // eslint-disable-line
      const { name, dependencies } = packageJson;

      const result = <IModule> {
        name,
        packageDir,
        packagePath: packageDir,
      };

      if (!dependencies) { return result; }

      Object.keys(dependencies).map((packageName) => {
        // Skips on exclude matches, if set
        if (_exclude.length && _exclude.indexOf(packageName) > -1) { return; }
        // Skips on include mis-matches, if set
        if (_include.length && _include.indexOf(packageName) < 0) { return; }

        const nextPackagePath = resolvePackage(packageName, { cwd: packageDir });
        if (!nextPackagePath) { return; }

        const relativePath = join('node_modules', nextPackagePath.split(separator).slice(1).join(separator));

        if (cache.has(relativePath)) { return; }
        cache.add(relativePath);

        const childPackageJsonPath = join(nextPackagePath, './package.json');
        let childPackageJson;
        if (existsSync(childPackageJsonPath)) {
          childPackageJson = require(childPackageJsonPath); // eslint-disable-line
        }

        const childResult = recurse(nextPackagePath, undefined, deepExclude);
        resolvedDeps.push({ ...childResult, packageDir, relativePath, packageJson: childPackageJson });
      });

      return result;
    };

    recurse(initialPackageDir, include, exclude);

    return resolvedDeps;
  }
}
