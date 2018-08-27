import * as Bluebird from 'bluebird';
import { join, sep } from 'path';
import * as resolvePackage from 'resolve-pkg';

import { Archiver } from 'archiver';
import { existsSync } from 'fs-extra';
import { Logger } from './lib/Logger';
import { handleFile } from './lib/utils';
import { findSymlinks, Walker } from './lib/Walker';
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
    const links = await findSymlinks(join(this.servicePath, 'node_modules'));

    this.modules = this.resolveDependencies(
      this.servicePath,
      { include, exclude, deepExclude, links },
    );

    const transforms = this.resolveTransforms();

    const readModule = async ({ packagePath, packageDir, relativePath, packageJson }) => {
      const filter = (dirPath, stats) => {
        const { linkedPath, link } = this.resolveSymlinkPath(dirPath, links);

        let testPackagePath = packagePath;

        if (linkedPath) {
          dirPath = linkedPath;
          testPackagePath = link;
        }

        if (!dirPath || !testPackagePath) { return true; }

        // If there are no deep exclusions, then there is no more filtering.
        if (!deepExclude.length) {
          return true;
        }

        // This pulls ['node_modules', 'pack'] out of
        // .../node_modules/package/node_modules/pack
        const endParts = dirPath.split(testPackagePath)[1].split('/').slice(-2);

        // When a directory is a package and matches a deep exclude pattern
        // Then skip it
        if (
          endParts[0] === 'node_modules' &&
          deepExclude.indexOf(endParts[1]) !== -1
        ) {
          return false;
        }

        return true;
      };

      const onFile = async (filePath: string, stats) => {
        let relPath;

        const { relLinkedPath } = this.resolveSymlinkPath(filePath, links);

        if (relLinkedPath) { relPath = join(relativePath, relLinkedPath); }

        if (!relPath) {
          relPath = filePath.substr(filePath.indexOf(relativePath));
        }

        relPath = relPath.replace(/^\/|\/$/g, '');

        await handleFile({
          filePath,
          relPath,
          transforms,
          transformExtensions: ['js', 'jsx'],
          useSourceMaps: false,
          archive: this.archive,
        });
      };

      await new Walker(`${packagePath}${sep}`)
        .filter(filter)
        .file(onFile)
        .end();

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

  private resolveSymlinkPath (filePath: string, links: Map<string, string>): {
    linkedPath?: string,
    link?: string, real?: string,
    relLinkedPath?: string,
  } {
    const items = Array.from(links.entries()).reverse();

    // Get a relPath from using a matching symlink
    for (const [real, link] of items) {
      if (filePath.startsWith(real)) {
        const relLinkedPath = filePath.slice(real.length);

        return {
          real, link,
          relLinkedPath,
          linkedPath: join(link, relLinkedPath),
        };
      }
    }

    return {};
  }

  /**
   * Resolves a package's dependencies to an array of paths.
   */
  private resolveDependencies (
    initialPackageDir,
    { include = [], exclude = [], deepExclude = [], links = new Map() } = {},
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

        let nextPackagePath = resolvePackage(packageName, { cwd: packageDir });
        if (!nextPackagePath) { return; }

        const link = links.get(nextPackagePath);
        if (link) { nextPackagePath = link; }

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
