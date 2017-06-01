import path from 'path';
import requireResolve from 'resolve-pkg';

export class UglifyTransform {
  constructor (config = {}, options = {}) {
    this.config = {
      dead_code : true,
      unsafe    : false,

      ...config,
    };

    this.options = {
      servicePath : '',
      skipOnError : true, // When false, errors will halt execution
      logErrors   : false,
      ...options,
    };

    const { servicePath } = this.options;

    // eslint-disable-next-line
    this.uglify = require(
      requireResolve('uglify-js', { cwd: servicePath }),
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
      if (this.options.logErrors) console.error(err); // eslint-disable-line
      if (!this.options.skipOnError) throw err;
    }

    return result;
  }
}
