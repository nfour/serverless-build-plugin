import * as Bluebird from 'bluebird';
import { join, sep } from 'path';
import * as resolvePackage from 'resolve-pkg';

import { Archiver } from 'archiver';
import { exists } from 'fs-extra';
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
  followSymlinks: boolean = true;

  constructor (config: {
    logger: Logger;
    archive: Archiver;
    servicePath: string;
    uglify?: IUglifyParams;
    followSymlinks?: boolean;
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

    this.modules = await this.resolveDependencies(
      this.servicePath,
      { include, exclude, deepExclude, links },
    );

    const transforms = await this.resolveTransforms();

    const readModule = async ({ packagePath, packageDir, relativePath, packageJson }) => {
      const filter = (dirPath, stats) => {
        const { linkedPath, link } = this.resolveSymlinkPath(dirPath, links);

        let testPackagePath = packagePath;

        if (linkedPath) {
          dirPath = linkedPath;
          testPackagePath = link;
        }

        if (!dirPath || !testPackagePath) { return true; }

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

      const walker = new Walker(packagePath)
        .filter(filter)
        .file(onFile);

      await walker.end();

      await this.logger.module(({ filePath: relativePath, realPath: packagePath, packageJson }));
    };

    await Bluebird.map(this.modules, readModule);

    return this;
  }

  private async resolveTransforms () {
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
  private async resolveDependencies (
    initialPackageDir,
    { include = [], exclude = [], deepExclude = [], links = new Map() } = {},
  ): Promise<IModule[]> {
    const resolvedDeps: IModule[] = [];
    const cache: Set<string> = new Set();
    const separator = `${sep}node_modules${sep}`;

    /**
     *  Resolves packages to their package root directory &
     *  also resolves dependant packages recursively.
     *  - Will also ignore the input package in the results
     */
    const recurse = async (packageDir, _include = [], _exclude = []) => {
      const packageJson = require(join(packageDir, './package.json')); // eslint-disable-line
      const { name, dependencies } = packageJson;

      const result = <IModule> {
        name,
        packageDir,
        packagePath: packageDir,
      };

      if (!dependencies) { return result; }

      await Bluebird.map(Object.keys(dependencies), async (packageName) => {
        /**
         *  Skips on exclude matches, if set
         *  Skips on include mis-matches, if set
         */
        if (_exclude.length && _exclude.indexOf(packageName) > -1) { return; }
        if (_include.length && _include.indexOf(packageName) < 0) { return; }

        let resolvedDir = resolvePackage(packageName, { cwd: packageDir });

        const childPackageJsonPath = join(resolvedDir, './package.json');

        let childPackageJson;
        if (await exists(childPackageJsonPath)) {
          childPackageJson = require(childPackageJsonPath); // eslint-disable-line
        }

        if (!resolvedDir) { return; }

        const nextPackagePath = resolvedDir;

        const link = links.get(resolvedDir);

        if (link) { resolvedDir = link; }

        const relativePath = join('node_modules', resolvedDir.split(separator).slice(1).join(separator));

        if (cache.has(relativePath)) { return; }

        cache.add(relativePath);

        const childResult = await recurse(nextPackagePath, undefined, deepExclude);

        resolvedDeps.push({ ...childResult, packageDir, relativePath, packageJson: childPackageJson });
      });

      return result;
    };

    await recurse(initialPackageDir, include, exclude);

    return resolvedDeps;
  }
}
