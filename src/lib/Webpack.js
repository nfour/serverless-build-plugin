import Promise from 'bluebird';
import { typeOf } from 'lutils';
import requireResolve from 'resolve-pkg';

export default class WebpackBuilder {
  constructor(config = {}) {
    this.config = {
      servicePath : '',   // ./
      buildTmpDir : '',   // ./.serverless/build
      ...config,
    };

    this.log = this.config.log || (() => {});

    // eslint-disable-next-line
    this.webpack = require(
      requireResolve('webpack', { cwd: this.config.servicePath }),
    );
  }

  /**
   *  Builds a webpack config into the build directory.
   */
  async build(config) {
    config.context = this.config.servicePath;
    config.entry   = [...(config.entry || [])];
    config.output  = {
      ...config.output,
      libraryTarget : 'commonjs',
      path          : this.config.buildTmpDir,
    };

    this.externals = this._normalizeExternals(config.externals || []);

    const logs = await this._runWebpack(config);

    this.log('');
    this.log('[WEBPACK]');
    this.log('');
    this.log(logs);

    return this;
  }

  /**
   *  Normalizes webpacks externals into an array of strings.
   *  This is fairly rough, could be better.
   *
   *  @return [ "moduleName" ]
   */
  _normalizeExternals(externals) {
    return externals.reduce((arr, external) => {
      const type = typeOf(external);

      if (type === 'string') {
        arr.push(external);
      } else
      if (type === 'object') {
        Object.keys(external).forEach((key) => {
          const val = external[key];

          if (val === true) arr.push(key);
        });
      }

      return arr;
    }, []);
  }

  _runWebpack(config, webpack = this.webpack) {
    return new Promise((resolve, reject) => {
      webpack(config).run((err, stats) => {
        if (err) return reject(err);

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
