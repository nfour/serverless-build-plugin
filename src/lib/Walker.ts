import { readdirSync, statSync } from 'fs-extra';
import { join } from 'path';
import * as createWalker from 'walker';

export class Walker {
  followSymlinks: boolean;
  walker: any;
  pending: any[] = [];
  symlinkRoots: Set<string> = new Set();

  constructor (directory, { followSymlinks = true } = {}) {
    this.checkForSymlinks(directory);

    this.walker = createWalker(directory);
    this.followSymlinks = followSymlinks;

    this.walker.on('dir', this.checkForSymlinks);
  }

  filter (fn) {
    this.walker.filterDir(this.capture(fn));

    return this;
  }

  directory (fn) {
    this.walker.on('dir', this.capture(fn));

    return this;
  }

  file (fn) {
    this.walker.on('file', this.capture(fn));

    if (this.followSymlinks) { this.walker.on('symlink', fn); }

    return this;
  }

  async end () {
    await new Promise((resolve, reject) => {
      this.walker.on('error', reject);
      this.walker.on('end', resolve);
    });

    await Promise.all(this.pending);
  }

  private capture = (fn) => {
    return (...args) => {
      const result = fn(...args);
      this.pending.push(result);
      return result;
    };
  }

  private checkForSymlinks = (dirPath) => {
    console.log("checking", dirPath)
    const entries = readdirSync(dirPath);

    entries.forEach((entry) => {
      const fullPath = join(dirPath, entry);
      if (/lutil/.test(fullPath)) console.log(fullPath);
      if (statSync(fullPath).isSymbolicLink()) {
        this.symlinkRoots.add(fullPath);
      }
    });
  }
}
