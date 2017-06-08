import * as c from 'chalk';
import * as path from 'path';
import { ISls } from './types';

export class Logger {
  serverless: ISls;
  log: (...args: string[]) => any;

  constructor ({ serverless }) {
    this.serverless = serverless;

    this.log = (...args) => this.serverless.cli.log(...args);
  }

  message (prefix: string, str: string) {
    this.log(c.grey(`[${prefix}]`), str);
  }

  module ({ filePath, packageJson }: { filePath: string, packageJson?: any }) {
    const basename = path.basename(filePath);

    return this.log(
      'MODULE',
      `${
        packageJson && c.grey(`${packageJson.version}\t`)
      }${
        c.grey(filePath.replace(basename, c.reset(basename)))
      }`,
    );
  }
}
