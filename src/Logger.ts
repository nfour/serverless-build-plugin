import * as c from 'chalk';
import * as path from 'path';
import { colorizeConfig } from './lib/utils';

export class Logger {
  silent = false;
  log: (...args: string[]) => any;

  private serverless: any;

  constructor ({ serverless, silent }: { silent?: boolean, serverless: any }) {
    this.serverless = serverless;
    this.silent = silent;

    this.log = (...args) => !this.silent && this.serverless.cli.log(...args);
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
