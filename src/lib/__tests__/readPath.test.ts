import { relative, resolve } from 'path';

import { readPath } from '../readPath';

const testDir = resolve(__dirname, './project');

it('reads regular file nested in 1 folder', async () => {
  const filesRead: string[] = [];

  await readPath(testDir, {
    depth: 2,
    async onFile ({ startPath, previousPaths, filePath, stats }) {
      filesRead.push(filePath);
    },
  });

  expect(filesRead).toMatchSnapshot();
});

it('can filter out some paths');

it('reads symlinked files nested 2 and maintains reference to traversed paths');
it('does not traverse circular symlinks');
