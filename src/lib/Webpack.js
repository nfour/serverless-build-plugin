import Promise from 'bluebird';
import path from 'path';
import { typeOf } from 'lutils';

export default class WebpackBuilder {
  constructor(config = {}) {
    this.config = {
      servicePath : '',   // ./
      buildTmpDir : '',   // ./.serverless/build
      ...config,
    };

    this.log = this.config.log || (() => {});

    this.webpack = require('webpack');
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

    this.log('[WEBPACK]');
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
        for (const key in external) {
          const val = external[val];

          if (val === true) arr.push(key);
        }
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


  //
  // FIXME: UNSUED CODE BELOW
  //


  /**
   *  Declarative build method, potentially used in bundling.
   */
  standardBuild(pathFrom, pathTo, { babel, devtool = true, optimize = false } = {}) {
    const config = {
      entry   : [pathFrom],
      context : this.config.servicePath,
      output  : {
        libraryTarget : 'commonjs',
        path          : path.dirname(pathTo),
        filename      : path.basename(pathTo),
      },
    };

    if (devtool) config.devtool = 'source-map';

    if (optimize) {
      config.plugins = [
        ...config.plugins,
        new this.webpack.optimize.DedupePlugin(),
        new this.webpack.optimize.UglifyJsPlugin({
          compress: {
            unused        : true,
            dead_code     : true,
            warnings      : false,
            drop_debugger : true,
          },
        }),
      ];
    }

    if (babel) {
      config.module = {
        loaders: [
          {
            test    : /\.js$/,
            loader  : 'babel',
            exclude : /node_modules/,
            query   : babel,
          },
        ],
      };
    }

    return this._runWebpack(config);
  }

}
