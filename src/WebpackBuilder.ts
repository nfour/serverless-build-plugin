import { typeOf } from 'lutils';
import requireResolve from 'resolve-pkg';
import { Logger } from './Logger';

export class WebpackBuilder {
  externals: any; // FIXME:
  config: any; // FIXME:
  logger: Logger;
  webpack: any; // FIXME:

  constructor (config = {}) {
    this.config = {
      servicePath : '',   // ./
      buildTmpDir : '',   // ./.serverless/build
      ...config,
    };

    this.logger = this.config.logger;

    // eslint-disable-next-line
    this.webpack = require(
      requireResolve('webpack', { cwd: this.config.servicePath }),
    );
  }

  /**
   *  Builds a webpack config into the build directory.
   */
  async build (config) {
    config.context = this.config.servicePath;
    config.entry = [...(config.entry || [])];
    config.output = {
      ...config.output,
      libraryTarget : 'commonjs',
      path          : this.config.buildTmpDir,
    };

    this.externals = this.normalizeExternals(config.externals || []);

    const logs = await this.runWebpack(config);

    this.logger.log('');
    this.logger.message('WEBPACK');
    this.logger.log('');
    this.logger.log(logs);

    return this;
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
