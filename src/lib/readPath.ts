import { map } from 'bluebird';
import { readdir, stat, Stats } from 'fs-extra';

export interface IFileParams {
  filePath: string;
  stats: Stats;
  startPath: string;
  previousPaths: string[];
}

export async function readPath (startDirectory: string, inputParams: {
  /** Depth at while to stop traversal */
  depth?: number;

  onFileFilter? (params: IFileParams): boolean|Promise<boolean>;
  onFile (params: IFileParams);
}) {

  type ITraverseParams = Parameters<typeof readPath>[1] & { startPath: string, previousPaths: string[] };

  async function traversePath ({  }: ITraverseParams) {
    const paths = await readdir(startDirectory);

    console.log({ paths });

    await map(paths, (path) => {
      return traversePath(path, { onFileFilter, onFile, depth: depth - 1 });
    });
  }

  return traversePath(startDirectory, { });
}
