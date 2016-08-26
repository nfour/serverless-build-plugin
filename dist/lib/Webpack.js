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