export default class BabelTransform {
  constructor(config = {}, options = {}) {
    this.config = {
      sourceMaps: 'both',
      ...config,
    };

    this.options = {
      skipOnError : false, // When false, errors will halt execution
      logErrors   : true,
      babili      : false,
      ...options,
    };

    if (options.babili) this.config.presets.push('babili');

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
