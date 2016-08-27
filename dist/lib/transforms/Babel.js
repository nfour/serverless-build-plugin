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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvdHJhbnNmb3Jtcy9CYWJlbC5qcyJdLCJuYW1lcyI6WyJCYWJlbFRyYW5zZm9ybSIsImNvbnN0cnVjdG9yIiwiY29uZmlnIiwib3B0aW9ucyIsInNraXBPbkVycm9yIiwibG9nRXJyb3JzIiwic291cmNlTWFwcyIsImJhYmVsIiwicmVxdWlyZSIsInJ1biIsImNvZGUiLCJtYXAiLCJyZWxQYXRoIiwicmVzdWx0IiwidHJhbnNmb3JtIiwic291cmNlRmlsZU5hbWUiLCJzb3VyY2VNYXBUYXJnZXQiLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7OztBQUVlLE1BQU1BLGNBQU4sQ0FBcUI7QUFDaENDLGtCQUF1QztBQUFBLFlBQTNCQyxNQUEyQix5REFBbEIsRUFBa0I7QUFBQSxZQUFkQyxPQUFjLHlEQUFKLEVBQUk7O0FBQ25DLGFBQUtBLE9BQUw7QUFDSUMseUJBQWEsSUFEakIsRUFDdUI7QUFDbkJDLHVCQUFXO0FBRmYsV0FHT0YsT0FIUDs7QUFNQSxhQUFLRCxNQUFMO0FBQ0lJLHdCQUFZO0FBRGhCLFdBRU9KLE1BRlA7O0FBTUEsYUFBS0ssS0FBTCxHQUFhQyxRQUFRLFlBQVIsQ0FBYjtBQUNIOztBQUVEQyxjQUE0QjtBQUFBLFlBQXRCQyxJQUFzQixRQUF0QkEsSUFBc0I7QUFBQSxZQUFoQkMsR0FBZ0IsUUFBaEJBLEdBQWdCO0FBQUEsWUFBWEMsT0FBVyxRQUFYQSxPQUFXOztBQUN4QixZQUFJQyxTQUFTLEVBQUVILFVBQUYsRUFBUUMsUUFBUixFQUFiOztBQUVBLFlBQUk7QUFDQUUscUJBQVMsS0FBS04sS0FBTCxDQUFXTyxTQUFYLENBQXFCSixJQUFyQixlQUNGLEtBQUtSLE1BREg7QUFFTGEsZ0NBQXdCSCxPQUZuQjtBQUdMSSxpQ0FBd0JKO0FBSG5CLGVBQVQ7QUFLSCxTQU5ELENBTUUsT0FBT0ssR0FBUCxFQUFZO0FBQ1YsZ0JBQUssS0FBS2QsT0FBTCxDQUFhRSxTQUFsQixFQUE4QmEsUUFBUUMsS0FBUixDQUFjRixHQUFkO0FBQzlCLGdCQUFLLENBQUUsS0FBS2QsT0FBTCxDQUFhQyxXQUFwQixFQUFrQyxNQUFNYSxHQUFOO0FBQ3JDOztBQUVELGVBQU9KLE1BQVA7QUFDSDtBQWhDK0I7a0JBQWZiLGMiLCJmaWxlIjoiQmFiZWwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBCYWJlbFRyYW5zZm9ybSB7XG4gICAgY29uc3RydWN0b3IoY29uZmlnID0ge30sIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICAgICAgICBza2lwT25FcnJvcjogdHJ1ZSwgLy8gV2hlbiBmYWxzZSwgZXJyb3JzIHdpbGwgaGFsdCBleGVjdXRpb25cbiAgICAgICAgICAgIGxvZ0Vycm9yczogdHJ1ZSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnNcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgICAgICAgc291cmNlTWFwczogXCJib3RoXCIsXG4gICAgICAgICAgICAuLi5jb25maWdcbiAgICAgICAgfVxuXG5cbiAgICAgICAgdGhpcy5iYWJlbCA9IHJlcXVpcmUoJ2JhYmVsLWNvcmUnKVxuICAgIH1cblxuICAgIHJ1bih7IGNvZGUsIG1hcCwgcmVsUGF0aCB9KSB7XG4gICAgICAgIGxldCByZXN1bHQgPSB7IGNvZGUsIG1hcCB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuYmFiZWwudHJhbnNmb3JtKGNvZGUsIHtcbiAgICAgICAgICAgICAgICAuLi50aGlzLmNvbmZpZyxcbiAgICAgICAgICAgICAgICBzb3VyY2VGaWxlTmFtZSAgICAgICAgOiByZWxQYXRoLFxuICAgICAgICAgICAgICAgIHNvdXJjZU1hcFRhcmdldCAgICAgICA6IHJlbFBhdGgsXG4gICAgICAgICAgICB9KVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGlmICggdGhpcy5vcHRpb25zLmxvZ0Vycm9ycyApIGNvbnNvbGUuZXJyb3IoZXJyKVxuICAgICAgICAgICAgaWYgKCAhIHRoaXMub3B0aW9ucy5za2lwT25FcnJvciApIHRocm93IGVyclxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH1cbn1cbiJdfQ==