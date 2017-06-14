import { typeOf } from 'lutils';
import * as requireResolve from 'resolve-pkg';
import { Logger } from './lib/Logger';

export class WebpackBuilder {
  webpack: any;
  entryCache: Set<string> = new Set();
  cache: boolean = true;

  servicePath: string;
  buildTmpDir: string;
  logger: Logger;

  constructor (config: {
    servicePath: string;
    buildTmpDir: string;
    logger: Logger;
    cache?: boolean;
  }) {
    Object.assign(this, config);

    try {
      // eslint-disable-next-line
      this.webpack = require(
        requireResolve('webpack', { cwd: this.servicePath }),
      );
    } catch (err) { /**/ }
  }

  /**
   *  Builds a webpack config into the build directory.
   */
  async build (config): Promise<string[]> {
    const entry = config.entry || [];

    if (entry.length) {
      const cacheKey = entry.join('');

      if (this.entryCache.has(cacheKey)) { return; }

      this.entryCache.add(cacheKey);
    }

    config.context = this.servicePath;
    config.entry = [...entry];
    config.output = {
      ...config.output,
      libraryTarget : 'commonjs',
      path          : this.buildTmpDir,
    };

    const externals = this.normalizeExternals(config.externals || []);

    this.logger.message('WEBPACK');
    this.logger.log('');

    const logs = await this.runWebpack(config);

    this.logger.log('');
    this.logger.block('WEBPACK', logs);

    return externals;
  }

  /**
   *  Normalizes webpacks externals into an array of strings.
   *  This is fairly rough, could be better.
   *
   *  @return [ "moduleName" ]
   */
  private normalizeExternals (externals) {
    return externals.reduce((arr, external) => {
      const type = typeOf(external);

      if (type === 'string') {
        arr.push(external);
      } else
      if (type === 'object') {
        Object.keys(external).forEach((key) => {
          const val = external[key];

          if (val === true) { arr.push(key); }
        });
      }

      return arr;
    }, []);
  }

  private runWebpack (config): Promise<string> {
    return new Promise((resolve, reject) => {
      this.webpack(config).run((err, stats) => {
        if (err) { return reject(err); }

        return resolve(stats.toString({
          colors   : true,
          hash     : false,
          version  : false,
          chunks   : false,
          children : false,
        }));
      });
    });
  }
}
