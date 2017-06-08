import * as path from 'path';
import * as requireResolve from 'resolve-pkg';

export class UglifyTransform {
  config: any;
  options: any;
  uglify: any;

  constructor (config = {}, options = {}) {
    this.config = {
      dead_code: true,
      unsafe: false,
      ...config,
    };

    this.options = {
      skipOnError: true, // When false, errors will halt execution
      logErrors: false,
      ...options,
    };

    // eslint-disable-next-line
    this.uglify = require(
      requireResolve('uglify-js', { cwd: this.options.servicePath }),
    );
  }

  run ({ code, map, filePath }) {
    const fileName = path.basename(filePath);

    let result = { code, map };

    try {
      result = this.uglify.minify({ [fileName]: code }, {
        ...this.config,

        // Must pass through any previous source maps
        inSourceMap: map || null,

        outSourceMap : `${fileName}.map`,
        fromString   : true,
      });
    } catch (err) {
      // tslint:disable-next-line:no-console
      if (this.options.logErrors) { console.error(err); } // eslint-disable-line
      if (!this.options.skipOnError) { throw err; }
    }

    return result;
  }
}
