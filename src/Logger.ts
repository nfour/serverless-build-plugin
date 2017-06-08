import * as c from 'chalk';
import * as path from 'path';
import { ISls } from './types';
import { colorizeConfig } from './utils';

export class Logger {
  serverless: ISls;
  log: (...args: string[]) => any;

  constructor ({ serverless }) {
    this.serverless = serverless;

    this.log = (...args) => this.serverless.cli.log(...args);
  }

  message (prefix: string, str: string = '') {
    this.log(`${c.grey(`[${prefix}]`)} ${str}`);
  }

  module ({ filePath, packageJson }: { filePath: string, packageJson?: any }) {
    const basename = path.basename(filePath);

    return this.message(
      'MODULE',
      `${
        packageJson && c.grey(`${packageJson.version}\t`)
      }${
        c.grey(filePath.replace(basename, c.reset(basename)))
      }`,
    );
  }

  source ({ filePath }: { filePath: string }) {
    const basename = path.basename(filePath);

    return this.message(
      'SOURCE',
      c.grey(filePath.replace(basename, c.reset(basename))),
    );
  }

  config (config: { [key: string]: any }) {
    return this.message('CONFIG', colorizeConfig(config));
  }
}
