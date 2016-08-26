'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lutils = require('lutils');

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _isStream = require('is-stream');

var _isStream2 = _interopRequireDefault(_isStream);

var _Webpack = require('./Webpack');

var _Webpack2 = _interopRequireDefault(_Webpack);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

_bluebird2.default.promisifyAll(_fsExtra2.default);

class FileBuild {
    constructor(config, artifact) {
        this.config = _extends({
            servicePath: '', // ./
            buildTmpDir: '', // ./.serverless/build
            zip: null, // Yazl zip options
            functions: {}, // Realized function configs
            tryFiles: [], // Array of relative paths to test for a build file
            serverless: null }, config);
        this.artifact = artifact;
        this.externals = new Set();
    }

    /**
     *  Handles building from a build file's output.
     */
    build() {
        var _this = this;

        return (0, _bluebird.coroutine)(function* () {
            //
            // RESOLVE BUILD FILE
            //

            let builderFilePath = yield _this._tryBuildFiles();

            if (!builderFilePath) throw new Error("Unrecognized build file path");

            builderFilePath = _path2.default.resolve(_this.config.servicePath, builderFilePath);

            let result = require(builderFilePath);

            // Resolve any functions...
            if (_lutils.typeOf.Function(result)) result = yield _bluebird2.default.try(function () {
                return result(_this);
            });

            //
            // HANDLE RESULT OUTPUT:
            //
            // - String, Buffer or Stream:   piped as 'handler.js' into zip
            // - Webpack Config:             executed and output files are zipped
            //

            if (_lutils.typeOf.Object(result)) {
                //
                // WEBPACK CONFIG
                //

                const functions = _this.config.functions;


                let entryPoints = [];
                for (let fnName in functions) {
                    const entry = functions[fnName].handler.split(/\.[^\.]+$/)[0] || '';

                    if (entryPoints.indexOf(entry) < 0) entryPoints.push(entry);
                }

                // TODO: loop over each function and build seperately.
                // Set result.output.path and filename

                entryPoints = entryPoints.map(function (filePath) {
                    return `./${ filePath }.js`;
                });

                result.entry = [].concat(_toConsumableArray(result.entry || []), _toConsumableArray(entryPoints));

                var _ref = yield new _Webpack2.default(_this.config).build(result);

                const externals = _ref.externals;


                for (let ext of externals) _this.externals.add(ext);['handler.js', `handler.js.map`].map((() => {
                    var _ref2 = (0, _bluebird.coroutine)(function* (relPath) {
                        const filePath = _path2.default.resolve(_this.config.buildTmpDir, relPath);

                        const stats = yield _fsExtra2.default.statAsync(filePath);

                        // Ensure file exists first
                        if (stats.isFile()) _this.artifact.addFile(filePath, relPath, _this.config.zip);
                    });

                    return function (_x) {
                        return _ref2.apply(this, arguments);
                    };
                })());
            } else if (_lutils.typeOf.String(result) || result instanceof Buffer) {
                //
                // STRINGS, BUFFERS
                //

                if (_lutils.typeOf.String(result)) result = new Buffer(result);

                _this.artifact.addBuffer(result, 'handler.js', _this.config.zip);
            } else if ((0, _isStream2.default)(result)) {
                //
                // STREAMS
                //

                _this.artifact.addReadStream(result, 'handler.js', _this.config.zip);
            } else {
                throw new Error("Unrecognized build output");
            }

            // TODO: read from serverless.yml -> package.includes for extenerals as well as excludes

            return _this;
        })();
    }

    /**
     *  Allows for build files to be auto selected
     */
    _tryBuildFiles() {
        var _this2 = this;

        return (0, _bluebird.coroutine)(function* () {
            for (let fileName of _this2.config.tryFiles) {
                const exists = yield _fsExtra2.default.statAsync(fileName).then(function (stat) {
                    return stat.isFile();
                });

                if (exists) return fileName;
            }

            return null;
        })();
    }
}
exports.default = FileBuild;
module.exports = exports['default'];