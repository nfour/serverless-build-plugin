import * as createWalker from 'walker';

export class Walker {
  followSymlinks: boolean;
  walker: any;
  pending: any[] = [];

  constructor(directory, { followSymlinks = true } = {}) {
    this.walker = createWalker(directory);
    this.followSymlinks = followSymlinks;
  }

  filter(fn) {
    this.walker.filterDir(this.capture(fn));

    return this;
  }

  directory(fn) {
    this.walker.on('dir', this.capture(fn));

    return this;
  }

  file(fn) {
    this.walker.on('file', this.capture(fn));

    if (this.followSymlinks) { this.walker.on('symlink', fn); }

    return this;
  }

  async end() {
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
}
