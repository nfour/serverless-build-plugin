'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class UglifyTransform {
    constructor() {
        let config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
        let options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        this.options = _extends({
            skipOnError: true, // When false, errors will halt execution
            logErrors: false
        }, options);

        this.config = _extends({
            dead_code: true,
            unsafe: false

        }, config);

        this.uglify = require('uglify-js');
    }

    run(_ref) {
        let code = _ref.code;
        let map = _ref.map;
        let filePath = _ref.filePath;

        const fileName = _path2.default.basename(filePath);

        let result = { code: code, map: map };

        try {
            result = this.uglify.minify({ [fileName]: code }, _extends({}, this.config, {

                // Must pass through any previous source maps
                inSourceMap: map ? map : null,

                outSourceMap: `${ fileName }.map`,
                fromString: true
            }));
        } catch (err) {
            if (this.options.logErrors) console.error(err);
            if (!this.options.skipOnError) throw err;
        }

        return result;
    }
}
exports.default = UglifyTransform;
module.exports = exports['default'];