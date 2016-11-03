export default class BabelTransform {
  constructor(config = {}, options = {}) {
    this.options = {
      skipOnError : false, // When false, errors will halt execution
      logErrors   : true,
      ...options,
    };

    this.config = {
      sourceMaps: 'both',
      ...config,
    };


    this.babel = require('babel-core'); // eslint-disable-line
  }

  run({ code, map, relPath }) {
    let result = { code, map };

    try {
      result = this.babel.transform(code, {
        ...this.config,
        sourceFileName  : relPath,
        sourceMapTarget : relPath,
      });
    } catch (err) {
      if (this.options.logErrors) console.error(err); // eslint-disable-line
      if (!this.options.skipOnError) throw err;
    }

    return result;
  }
}
