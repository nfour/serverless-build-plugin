import { map } from 'bluebird';
import { lstat, readdir, stat, Stats } from 'fs-extra';
import { flatten } from 'lodash';
import { resolve } from 'path';

import { Omit } from '../types';

export interface IFileParams {
  filePath: string;
  stats: Stats;
  startPath: string;
  previousPaths: string[];
}

export interface IReadPathParams {
  /** Depth at while to stop traversal */
  depth?: number;

  onFileFilter? (params: IFileParams): boolean | Promise<boolean>;
  onFile (params: IFileParams);
}

export async function readPath (startDirectory: string, { depth = 4, ...input }: IReadPathParams) {
  const operations = await traversePath(startDirectory, {
    ...input,
    depth,
    previousPaths: [],
    startPath: startDirectory,
  });

  return Promise.all(operations);
}

type ITraverseParams = IReadPathParams & {
  startPath: string,
  previousPaths: string[],
  depth: number,
};

async function traversePath (inputPath: string, {
  previousPaths, startPath, onFile,
  onFileFilter, depth,
}: ITraverseParams): Promise<Array<PromiseLike<unknown>>> {
  const { skip, filePath, stats } = await validatePath(inputPath, { depth, previousPaths, startPath });

  if (skip) { return; }

  if (stats.isDirectory()) {
    const fileNames = await readdir(filePath);

    console.log(`${'  '.repeat(depth)} directory: ${depth}`, fileNames);

    const operations = await map(fileNames, async (fileName) => {
      const currentPaths = [...previousPaths, inputPath];
      const nextFilePath = resolvePathName(currentPaths, fileName);

      return traversePath(nextFilePath, {
        depth: depth - 1,
        previousPaths: currentPaths,
        startPath,
        onFile,
        onFileFilter,
      });
    }).then(flatten);

    return operations;
  } else {
    console.log(`${'  '.repeat(depth)} file:`, filePath);

    const operation = await onFile({ filePath, previousPaths, startPath, stats });

    return [operation];
  }
}

type IResolveParams = Pick<ITraverseParams, 'depth' | 'previousPaths' | 'startPath'>;

async function validatePath (pathName: string, { previousPaths, depth, startPath }: IResolveParams) {
  const filePath = resolvePathName(previousPaths, pathName);
  const stats = await stat(filePath);
  const lstats = await lstat(filePath);

  const skip = await filterPath({
    previousPaths, depth, startPath,
    filePath,
    stats,
  });

  return { skip, filePath, lstats, stats };
}

function resolvePathName (previousPaths: string[], pathName: string) {
  const lastPath = previousPaths.slice(-1)[0];

  return resolve(lastPath, pathName);
}

type IFilterParams = Omit<ITraverseParams, 'onFile'> & IFileParams;

async function filterPath ({ previousPaths, onFileFilter, depth, startPath, filePath, stats }: IFilterParams) {
  if (depth < 0) { return true; }
  if (!onFileFilter) { return false; }

  return onFileFilter({ previousPaths, startPath, filePath, stats });
}
