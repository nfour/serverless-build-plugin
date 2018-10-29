import { map } from 'bluebird';
import { readdir, stat, Stats } from 'fs-extra';
import { flatten } from 'lodash';
import { basename, resolve } from 'path';

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

export async function readPath (startDirectory: string, input: IReadPathParams) {
  const operations = await traversePath(startDirectory, {
    ...input,
    depth: input.depth || 4,
    previousPaths: [startDirectory],
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
  const { skip, filePath, stats } = await resolvePath(inputPath, { depth, previousPaths, startPath });

  if (skip) { return; }

  if (stats.isDirectory()) {
    const fileNames = await readdir(filePath);

    console.log(`directory:`, fileNames);

    const operations = await map(fileNames, async (fileName) => {
      const lastPathSegment = basename(inputPath);

      return traversePath(fileName, {
        depth: depth - 1,
        previousPaths: [...previousPaths, lastPathSegment],
        startPath,
        onFile,
        onFileFilter,
      });
    }).then(flatten);

    return operations;
  } else {
    console.log(`file:`, filePath);
    const operation = await onFile({ filePath, previousPaths, startPath, stats });

    return [operation];
  }
}

type IResolveParams = Pick<ITraverseParams, 'depth' | 'previousPaths' | 'startPath'>;

async function resolvePath (path: string, { previousPaths, depth, startPath }: IResolveParams) {
  const filePath = resolve(...previousPaths, path);
  const stats = await stat(filePath);

  const skip = await filterPath({
    previousPaths, depth, startPath,
    filePath,
    stats,
  });

  return { skip, filePath, stats };
}

type IFilterParams = Omit<ITraverseParams, 'onFile'> & IFileParams;

async function filterPath ({ previousPaths, onFileFilter, depth, startPath, filePath, stats }: IFilterParams) {
  if (depth < 0) { return true; }
  if (!onFileFilter) { return false; }

  return onFileFilter({ previousPaths, startPath, filePath, stats });
}
