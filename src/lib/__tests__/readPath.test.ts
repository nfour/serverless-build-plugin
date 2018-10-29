import { resolve } from 'path';

import { readPath } from '../readPath';

const testDir = resolve(__dirname, '../../__tests__/project');

it('reads regular file nested in 1 folder', async () => {
  const files: string[] = [];

  await readPath(testDir, {
    depth: 2,
    async onFile ({ startPath, previousPaths, filePath, stats }) {
      console.log({ previousPaths });
      files.push(filePath);
    },
  });

  expect(files.sort()).toMatchSnapshot();
});

it('can filter out paths matching /c/', async () => {
  const files: string[] = [];

  await readPath(testDir, {
    depth: 4,
    async onFile ({ startPath, previousPaths, filePath, stats }) {
      if (!/\/c\//.test(filePath)) { return true; }

      files.push(filePath);
    },
  });

  expect(files.sort()).toMatchSnapshot();
});

it('can traverse circular symlinks up to depth', async () => {
  const files: string[] = [];

  await readPath(testDir, {
    depth: 20,
    async onFile ({ startPath, previousPaths, filePath, stats }) {
      files.push(filePath);
    },
  });

  expect(files.sort()).toMatchSnapshot();
});
