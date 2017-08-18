import * as Bluebird from 'bluebird';
import { lstat, readdir, realpath } from 'fs-extra';
import { join } from 'path';
import * as createWalker from 'walker';

export class Walker {
  walker: any;
  pending: any[] = [];
  symlinkRoots: Set<string> = new Set();

  constructor (directory) {
    this.walker = createWalker(directory);
  }

  filter (fn) {
    this.walker.filterDir(fn);

    return this;
  }

  directory (fn) {
    this.walker.on('dir', this.capture(fn));

    return this;
  }

  file (fn) {
    this.walker.on('file', this.capture(fn));

    return this;
  }

  async end () {
    await new Promise((resolve, reject) => {
      this.walker.on('error', reject);
      this.walker.on('end', resolve);
    });

    return Promise.all(this.pending);
  }

  private capture = (fn) => {
    return (...args) => {
      const result = fn(...args);
      this.pending.push(result);

      return result;
    };
  }
}

export async function findSymlinks (dirPath, maxDepth = 2) {
  const links = new Map();

  const traverse = async (dir, depth) => {
    if (depth < 0) { return; }

    --depth;

    const stats = await lstat(dir);

    if (stats.isSymbolicLink()) {
      const real = await realpath(dir);

      return links.set(real, dir);
    }

    if (!stats.isDirectory()) { return; }

    const entries = await readdir(dir);

    return Bluebird.map(entries, (entry) =>
      traverse(join(dir, entry), depth),
    );
  };

  await traverse(dirPath, maxDepth);

  return links;
}
