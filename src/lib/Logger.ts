import { promisify } from 'bluebird';
import * as c from 'chalk';
import * as getFolderSize from 'get-folder-size';
import * as path from 'path';
import { inspect } from 'util';

const indent = (str) => str.split('\n').map((line) => `  ${line}`).join('\n');
const getFolderSizeAsync: any = promisify(getFolderSize);

/** Returns size in MB */
const directorySize = async (directory): Promise<string|null> => {
  try {
    const size = await getFolderSizeAsync(directory);
    return `${(size / 1024 / 1024).toFixed(3)} MB`;
  } catch (err) { return null; }
};

export class Logger {
  silent: boolean;
  private serverless: any;

  constructor (
    { serverless, silent = false }: {
      silent?: boolean, serverless?: any,
    } = {},
  ) {
    Object.assign(this, { serverless, silent });
  }

  log = (...args: string[]) => !this.silent && console.log.apply(console, args);
  logSls = (...args: string[]) => !this.silent && this.serverless.cli.log(...args);

  message (prefix: string, str: string = '') {
    return this.log(`${c.grey(`[${prefix}]`)} ${str}`);
  }

  async module ({ filePath, realPath, packageJson }: {
    filePath: string, packageJson?: any,
    realPath?: string,
  }) {
    const directory = path.basename(filePath);

    const size = await directorySize(realPath || filePath);

    return this.message(
      'MODULE',
      `${
        packageJson && c.grey(`${packageJson.version}\t`)
      }${
        c.grey(
          filePath
            .replace(directory, c.reset(directory))
            .replace(/\bnode_modules\b/, '~'),
        )
        } ${ size ? c.grey(`- ${c.blue(size)}`) : '' }`,
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
    const str = c.grey(
      inspect(config, { depth: 10, colors: true }),
    );

    this.block('CONFIG', str);
  }

  block (prefix, text) {
    this.message(prefix);
    this.log('');
    this.log(indent(text));
    this.log('');
  }
}
