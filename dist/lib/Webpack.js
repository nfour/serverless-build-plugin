'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

class WebpackBuilder {
    constructor() {
        let config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        this.config = _extends({
            servicePath: '', // ./
            buildTmpDir: '', // ./.serverless/build
            serverless: null }, config);

        this.webpack = require('webpack');
    }

    /**
     *  Builds a webpack config into the build directory.
     */
    build(config) {
        var _this = this;

        return (0, _bluebird.coroutine)(function* () {
            // TODO: make this build on a single function basis with one entry in order to
            // allow for each function to dictate build methods

            config.context = _this.config.servicePath;
            config.entry = [].concat(_toConsumableArray(config.entry || []));
            config.output = _extends({}, config.output, {
                libraryTarget: 'commonjs',
                path: _this.config.buildTmpDir,
                filename: 'handler.js'
                // TODO: ensure source map name is reliable
            });

            /**
             *  TODO: normalize the externals to an array of module names, or else errors.
             */
            _this.externals = config.externals;

            const logs = yield _this._runWebpack(config);

            _this.config.serverless.cli.log(logs);

            return _this;
        })();
    }

    _runWebpack(config) {
        let webpack = arguments.length <= 1 || arguments[1] === undefined ? this.webpack : arguments[1];

        return new _bluebird2.default((resolve, reject) => {
            webpack(config).run((err, stats) => {
                if (err) return reject(err);

                resolve(stats.toString({
                    colors: true,
                    hash: false,
                    version: false,
                    chunks: false,
                    children: false
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
    standardBuild(pathFrom, pathTo) {
        var _ref = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

        let babel = _ref.babel;
        var _ref$devtool = _ref.devtool;
        let devtool = _ref$devtool === undefined ? true : _ref$devtool;
        var _ref$optimize = _ref.optimize;
        let optimize = _ref$optimize === undefined ? false : _ref$optimize;

        const config = {
            entry: [pathFrom],
            context: this.config.servicePath,
            output: {
                libraryTarget: 'commonjs',
                path: _path2.default.dirname(pathTo),
                filename: _path2.default.basename(pathTo)
            }
        };

        if (devtool) config.devtool = 'source-map';

        if (optimize) config.plugins = [].concat(_toConsumableArray(config.plugins), [new this.webpack.optimize.DedupePlugin(), new this.webpack.optimize.UglifyJsPlugin({
            compress: {
                unused: true,
                dead_code: true,
                warnings: false,
                drop_debugger: true
            }
        })]);

        if (babel) config.module = {
            loaders: [{
                test: /\.js$/,
                loader: 'babel',
                exclude: /node_modules/,
                query: babel
            }]
        };

        return this._runWebpack(config);
    }

}
exports.default = WebpackBuilder;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvV2VicGFjay5qcyJdLCJuYW1lcyI6WyJXZWJwYWNrQnVpbGRlciIsImNvbnN0cnVjdG9yIiwiY29uZmlnIiwic2VydmljZVBhdGgiLCJidWlsZFRtcERpciIsInNlcnZlcmxlc3MiLCJ3ZWJwYWNrIiwicmVxdWlyZSIsImJ1aWxkIiwiY29udGV4dCIsImVudHJ5Iiwib3V0cHV0IiwibGlicmFyeVRhcmdldCIsInBhdGgiLCJmaWxlbmFtZSIsImV4dGVybmFscyIsImxvZ3MiLCJfcnVuV2VicGFjayIsImNsaSIsImxvZyIsInJlc29sdmUiLCJyZWplY3QiLCJydW4iLCJlcnIiLCJzdGF0cyIsInRvU3RyaW5nIiwiY29sb3JzIiwiaGFzaCIsInZlcnNpb24iLCJjaHVua3MiLCJjaGlsZHJlbiIsInN0YW5kYXJkQnVpbGQiLCJwYXRoRnJvbSIsInBhdGhUbyIsImJhYmVsIiwiZGV2dG9vbCIsIm9wdGltaXplIiwiZGlybmFtZSIsImJhc2VuYW1lIiwicGx1Z2lucyIsIkRlZHVwZVBsdWdpbiIsIlVnbGlmeUpzUGx1Z2luIiwiY29tcHJlc3MiLCJ1bnVzZWQiLCJkZWFkX2NvZGUiLCJ3YXJuaW5ncyIsImRyb3BfZGVidWdnZXIiLCJtb2R1bGUiLCJsb2FkZXJzIiwidGVzdCIsImxvYWRlciIsImV4Y2x1ZGUiLCJxdWVyeSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQ0E7Ozs7Ozs7O0FBRWUsTUFBTUEsY0FBTixDQUFxQjtBQUNoQ0Msa0JBQXlCO0FBQUEsWUFBYkMsTUFBYSx5REFBSixFQUFJOztBQUNyQixhQUFLQSxNQUFMO0FBQ0lDLHlCQUFjLEVBRGxCLEVBQ3dCO0FBQ3BCQyx5QkFBYyxFQUZsQixFQUV3QjtBQUNwQkMsd0JBQWMsSUFIbEIsSUFJT0gsTUFKUDs7QUFPQSxhQUFLSSxPQUFMLEdBQWVDLFFBQVEsU0FBUixDQUFmO0FBQ0g7O0FBRUQ7OztBQUdNQyxTQUFOLENBQVlOLE1BQVosRUFBb0I7QUFBQTs7QUFBQTtBQUNoQjtBQUNBOztBQUVBQSxtQkFBT08sT0FBUCxHQUFpQixNQUFLUCxNQUFMLENBQVlDLFdBQTdCO0FBQ0FELG1CQUFPUSxLQUFQLGdDQUF1QlIsT0FBT1EsS0FBUCxJQUFnQixFQUF2QztBQUNBUixtQkFBT1MsTUFBUCxnQkFDT1QsT0FBT1MsTUFEZDtBQUVJQywrQkFBZ0IsVUFGcEI7QUFHSUMsc0JBQWdCLE1BQUtYLE1BQUwsQ0FBWUUsV0FIaEM7QUFJSVUsMEJBQWdCO0FBQ2hCO0FBTEo7O0FBUUE7OztBQUdBLGtCQUFLQyxTQUFMLEdBQWlCYixPQUFPYSxTQUF4Qjs7QUFFQSxrQkFBTUMsT0FBTyxNQUFNLE1BQUtDLFdBQUwsQ0FBaUJmLE1BQWpCLENBQW5COztBQUVBLGtCQUFLQSxNQUFMLENBQVlHLFVBQVosQ0FBdUJhLEdBQXZCLENBQTJCQyxHQUEzQixDQUErQkgsSUFBL0I7O0FBRUE7QUF2QmdCO0FBd0JuQjs7QUFFREMsZ0JBQVlmLE1BQVosRUFBNEM7QUFBQSxZQUF4QkksT0FBd0IseURBQWQsS0FBS0EsT0FBUzs7QUFDeEMsZUFBTyx1QkFBWSxDQUFDYyxPQUFELEVBQVVDLE1BQVYsS0FBcUI7QUFDcENmLG9CQUFRSixNQUFSLEVBQWdCb0IsR0FBaEIsQ0FBb0IsQ0FBQ0MsR0FBRCxFQUFNQyxLQUFOLEtBQWdCO0FBQ2hDLG9CQUFLRCxHQUFMLEVBQVcsT0FBT0YsT0FBT0UsR0FBUCxDQUFQOztBQUVYSCx3QkFBUUksTUFBTUMsUUFBTixDQUFlO0FBQ25CQyw0QkFBVyxJQURRO0FBRW5CQywwQkFBVyxLQUZRO0FBR25CQyw2QkFBVyxLQUhRO0FBSW5CQyw0QkFBVyxLQUpRO0FBS25CQyw4QkFBVztBQUxRLGlCQUFmLENBQVI7QUFPSCxhQVZEO0FBV0gsU0FaTSxDQUFQO0FBYUg7O0FBR0Q7QUFDQTtBQUNBOzs7QUFHQTs7O0FBR0FDLGtCQUFjQyxRQUFkLEVBQXdCQyxNQUF4QixFQUFrRjtBQUFBLHlFQUFKLEVBQUk7O0FBQUEsWUFBaERDLEtBQWdELFFBQWhEQSxLQUFnRDtBQUFBLGdDQUF6Q0MsT0FBeUM7QUFBQSxZQUF6Q0EsT0FBeUMsZ0NBQS9CLElBQStCO0FBQUEsaUNBQXpCQyxRQUF5QjtBQUFBLFlBQXpCQSxRQUF5QixpQ0FBZCxLQUFjOztBQUM5RSxjQUFNbEMsU0FBUztBQUNYUSxtQkFBTyxDQUFFc0IsUUFBRixDQURJO0FBRVh2QixxQkFBUyxLQUFLUCxNQUFMLENBQVlDLFdBRlY7QUFHWFEsb0JBQVE7QUFDSkMsK0JBQWdCLFVBRFo7QUFFSkMsc0JBQWdCLGVBQUt3QixPQUFMLENBQWFKLE1BQWIsQ0FGWjtBQUdKbkIsMEJBQWdCLGVBQUt3QixRQUFMLENBQWNMLE1BQWQ7QUFIWjtBQUhHLFNBQWY7O0FBVUEsWUFBS0UsT0FBTCxFQUNJakMsT0FBT2lDLE9BQVAsR0FBaUIsWUFBakI7O0FBRUosWUFBS0MsUUFBTCxFQUNJbEMsT0FBT3FDLE9BQVAsZ0NBQ09yQyxPQUFPcUMsT0FEZCxJQUVJLElBQUksS0FBS2pDLE9BQUwsQ0FBYThCLFFBQWIsQ0FBc0JJLFlBQTFCLEVBRkosRUFHSSxJQUFJLEtBQUtsQyxPQUFMLENBQWE4QixRQUFiLENBQXNCSyxjQUExQixDQUF5QztBQUNyQ0Msc0JBQVU7QUFDTkMsd0JBQWdCLElBRFY7QUFFTkMsMkJBQWdCLElBRlY7QUFHTkMsMEJBQWdCLEtBSFY7QUFJTkMsK0JBQWdCO0FBSlY7QUFEMkIsU0FBekMsQ0FISjs7QUFhSixZQUFLWixLQUFMLEVBQ0loQyxPQUFPNkMsTUFBUCxHQUFnQjtBQUNaQyxxQkFBUyxDQUNMO0FBQ0lDLHNCQUFVLE9BRGQ7QUFFSUMsd0JBQVUsT0FGZDtBQUdJQyx5QkFBVSxjQUhkO0FBSUlDLHVCQUFVbEI7QUFKZCxhQURLO0FBREcsU0FBaEI7O0FBV0osZUFBTyxLQUFLakIsV0FBTCxDQUFpQmYsTUFBakIsQ0FBUDtBQUNIOztBQTNHK0I7a0JBQWZGLGMiLCJmaWxlIjoiV2VicGFjay5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQcm9taXNlIGZyb20gJ2JsdWViaXJkJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2VicGFja0J1aWxkZXIge1xuICAgIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG4gICAgICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgICAgICAgc2VydmljZVBhdGggOiAnJywgICAvLyAuL1xuICAgICAgICAgICAgYnVpbGRUbXBEaXIgOiAnJywgICAvLyAuLy5zZXJ2ZXJsZXNzL2J1aWxkXG4gICAgICAgICAgICBzZXJ2ZXJsZXNzICA6IG51bGwsIC8vIHNlcnZlcmxlc3MgaW5zdGFuY2VcbiAgICAgICAgICAgIC4uLmNvbmZpZ1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy53ZWJwYWNrID0gcmVxdWlyZSgnd2VicGFjaycpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogIEJ1aWxkcyBhIHdlYnBhY2sgY29uZmlnIGludG8gdGhlIGJ1aWxkIGRpcmVjdG9yeS5cbiAgICAgKi9cbiAgICBhc3luYyBidWlsZChjb25maWcpIHtcbiAgICAgICAgLy8gVE9ETzogbWFrZSB0aGlzIGJ1aWxkIG9uIGEgc2luZ2xlIGZ1bmN0aW9uIGJhc2lzIHdpdGggb25lIGVudHJ5IGluIG9yZGVyIHRvXG4gICAgICAgIC8vIGFsbG93IGZvciBlYWNoIGZ1bmN0aW9uIHRvIGRpY3RhdGUgYnVpbGQgbWV0aG9kc1xuXG4gICAgICAgIGNvbmZpZy5jb250ZXh0ID0gdGhpcy5jb25maWcuc2VydmljZVBhdGhcbiAgICAgICAgY29uZmlnLmVudHJ5ICAgPSBbIC4uLihjb25maWcuZW50cnkgfHwgW10pIF1cbiAgICAgICAgY29uZmlnLm91dHB1dCAgPSB7XG4gICAgICAgICAgICAuLi5jb25maWcub3V0cHV0LFxuICAgICAgICAgICAgbGlicmFyeVRhcmdldCA6ICdjb21tb25qcycsXG4gICAgICAgICAgICBwYXRoICAgICAgICAgIDogdGhpcy5jb25maWcuYnVpbGRUbXBEaXIsXG4gICAgICAgICAgICBmaWxlbmFtZSAgICAgIDogJ2hhbmRsZXIuanMnXG4gICAgICAgICAgICAvLyBUT0RPOiBlbnN1cmUgc291cmNlIG1hcCBuYW1lIGlzIHJlbGlhYmxlXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFRPRE86IG5vcm1hbGl6ZSB0aGUgZXh0ZXJuYWxzIHRvIGFuIGFycmF5IG9mIG1vZHVsZSBuYW1lcywgb3IgZWxzZSBlcnJvcnMuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmV4dGVybmFscyA9IGNvbmZpZy5leHRlcm5hbHNcblxuICAgICAgICBjb25zdCBsb2dzID0gYXdhaXQgdGhpcy5fcnVuV2VicGFjayhjb25maWcpXG5cbiAgICAgICAgdGhpcy5jb25maWcuc2VydmVybGVzcy5jbGkubG9nKGxvZ3MpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICBfcnVuV2VicGFjayhjb25maWcsIHdlYnBhY2sgPSB0aGlzLndlYnBhY2spIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIHdlYnBhY2soY29uZmlnKS5ydW4oKGVyciwgc3RhdHMpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIGVyciApIHJldHVybiByZWplY3QoZXJyKVxuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdGF0cy50b1N0cmluZyh7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9ycyAgIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgaGFzaCAgICAgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgdmVyc2lvbiAgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgY2h1bmtzICAgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW4gOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgfVxuXG5cbiAgICAvL1xuICAgIC8vIEZJWE1FOiBVTlNVRUQgQ09ERSBCRUxPV1xuICAgIC8vXG5cblxuICAgIC8qKlxuICAgICAqICBEZWNsYXJhdGl2ZSBidWlsZCBtZXRob2QsIHBvdGVudGlhbGx5IHVzZWQgaW4gYnVuZGxpbmcuXG4gICAgICovXG4gICAgc3RhbmRhcmRCdWlsZChwYXRoRnJvbSwgcGF0aFRvLCB7IGJhYmVsLCBkZXZ0b29sID0gdHJ1ZSwgb3B0aW1pemUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICAgICAgY29uc3QgY29uZmlnID0ge1xuICAgICAgICAgICAgZW50cnk6IFsgcGF0aEZyb20gXSxcbiAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuY29uZmlnLnNlcnZpY2VQYXRoLFxuICAgICAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgICAgICAgbGlicmFyeVRhcmdldCA6ICdjb21tb25qcycsXG4gICAgICAgICAgICAgICAgcGF0aCAgICAgICAgICA6IHBhdGguZGlybmFtZShwYXRoVG8pLFxuICAgICAgICAgICAgICAgIGZpbGVuYW1lICAgICAgOiBwYXRoLmJhc2VuYW1lKHBhdGhUbyksXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGRldnRvb2wgKVxuICAgICAgICAgICAgY29uZmlnLmRldnRvb2wgPSAnc291cmNlLW1hcCdcblxuICAgICAgICBpZiAoIG9wdGltaXplIClcbiAgICAgICAgICAgIGNvbmZpZy5wbHVnaW5zID0gW1xuICAgICAgICAgICAgICAgIC4uLmNvbmZpZy5wbHVnaW5zLFxuICAgICAgICAgICAgICAgIG5ldyB0aGlzLndlYnBhY2sub3B0aW1pemUuRGVkdXBlUGx1Z2luKCksXG4gICAgICAgICAgICAgICAgbmV3IHRoaXMud2VicGFjay5vcHRpbWl6ZS5VZ2xpZnlKc1BsdWdpbih7XG4gICAgICAgICAgICAgICAgICAgIGNvbXByZXNzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bnVzZWQgICAgICAgIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlYWRfY29kZSAgICAgOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgd2FybmluZ3MgICAgICA6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZHJvcF9kZWJ1Z2dlciA6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdXG5cbiAgICAgICAgaWYgKCBiYWJlbCApXG4gICAgICAgICAgICBjb25maWcubW9kdWxlID0ge1xuICAgICAgICAgICAgICAgIGxvYWRlcnM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVzdCAgICA6IC9cXC5qcyQvLFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9hZGVyICA6ICdiYWJlbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBleGNsdWRlIDogL25vZGVfbW9kdWxlcy8sXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVyeSAgIDogYmFiZWxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX3J1bldlYnBhY2soY29uZmlnKVxuICAgIH1cblxufVxuIl19