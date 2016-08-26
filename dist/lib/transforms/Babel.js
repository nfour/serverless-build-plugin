'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class BabelTransform {
    constructor() {
        let config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
        let options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        this.options = _extends({
            skipOnError: true, // When false, errors will halt execution
            logErrors: true
        }, options);

        this.config = _extends({
            sourceMaps: "both"
        }, config);

        this.babel = require('babel-core');
    }

    run(_ref) {
        let code = _ref.code;
        let map = _ref.map;
        let relPath = _ref.relPath;

        let result = { code: code, map: map };

        try {
            result = this.babel.transform(code, _extends({}, this.config, {
                sourceFileName: relPath,
                sourceMapTarget: relPath
            }));
        } catch (err) {
            if (this.options.logErrors) console.error(err);
            if (!this.options.skipOnError) throw err;
        }

        return result;
    }
}
exports.default = BabelTransform;
module.exports = exports['default'];