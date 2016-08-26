'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _lutils = require('lutils');

var _minimatch = require('minimatch');

var _minimatch2 = _interopRequireDefault(_minimatch);

var _utils = require('./utils');

var _Babel = require('./transforms/Babel');

var _Babel2 = _interopRequireDefault(_Babel);

var _Uglify = require('./transforms/Uglify');

var _Uglify2 = _interopRequireDefault(_Uglify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

_bluebird2.default.promisifyAll(_fsExtra2.default);

/**
 *  @class SourceBundler
 *
 *  Handles the inclusion of source code in the artifact.
 */
class SourceBundler {
    constructor() {
        let config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
        let artifact = arguments[1];

        this.config = _extends({
            servicePath: '', // serverless.config.servicePath
            babel: null, // Babel options
            uglify: null, // UglifyJS options
            sourceMaps: false, // Whether to add source maps
            zip: null }, config);
        this.artifact = artifact;
    }

    /**
     *  Walks through, transforms, and zips source content wich
     *  is both `included` and not `excluded` by the regex or glob patterns.
     */
    bundle(_ref) {
        var _this = this;

        var _ref$exclude = _ref.exclude;
        let exclude = _ref$exclude === undefined ? [] : _ref$exclude;
        var _ref$include = _ref.include;
        let include = _ref$include === undefined ? [] : _ref$include;
        return (0, _bluebird.coroutine)(function* () {
            const transforms = yield _this._createTransforms();

            // await this._findFilterFiles(servicePath)

            const onFile = (() => {
                var _ref2 = (0, _bluebird.coroutine)(function* (rootPath, stats, next) {
                    /**
                     *  A relative path to the servicePath
                     *  @example ./functions/test/handler.js
                     */
                    const relPath = _path2.default.join(rootPath.split(_this.config.servicePath)[1], stats.name).replace(/^\/|\/$/g, '');

                    const filePath = _path2.default.join(rootPath, stats.name);

                    const testPattern = function testPattern(pattern) {
                        return _lutils.typeOf.RegExp(pattern) ? pattern.test(relPath) : (0, _minimatch2.default)(relPath, pattern, { dot: true });
                    };

                    /**
                     *  When a pattern matches an exclude, it skips
                     *  When a pattern doesnt match an include, it skips
                     */
                    if (exclude.some(testPattern)) return next();
                    if (!include.some(testPattern)) return next();

                    if (/\.(jsx?)$/i.test(filePath)) {
                        //
                        // JAVASCRIPT
                        //

                        let code = yield _fsExtra2.default.readFileAsync(filePath, 'utf8');
                        let map = '';

                        /**
                         *  Runs transforms against the code, mutating the code & map
                         *  with each iteration, optionally producing source maps
                         */
                        if (transforms.length) for (let transformer of transforms) {
                            let result = transformer.run({ code: code, map: map, filePath: filePath, relPath: relPath });

                            if (result.code) {
                                code = result.code;
                                if (result.map) map = result.map;
                            }
                        }

                        _this.artifact.addBuffer(new Buffer(code), relPath, _this.config.zip);

                        if (_this.config.sourceMaps && map) {
                            if (_lutils.typeOf.Object(map)) map = JSON.stringify(map);

                            _this.artifact.addBuffer(new Buffer(map), `${ relPath }.map`, _this.config.zip);
                        }
                    } else {
                        //
                        // ARBITRARY FILES
                        //

                        _this.artifact.addFile(filePath, relPath, _this.config.zip);
                    }

                    next();
                });

                return function onFile(_x2, _x3, _x4) {
                    return _ref2.apply(this, arguments);
                };
            })();

            // We never want node_modules here
            yield (0, _utils.walker)(_this.config.servicePath, { filters: [/\/node_modules\//i] }).on('file', onFile)
            // .on('directory') TODO: add a directories callback to match against exclude to enhance performance
            .end();

            return _this.artifact;
        })();
    }

    _createTransforms() {
        var _this2 = this;

        return (0, _bluebird.coroutine)(function* () {
            const transforms = [];

            if (_this2.config.babel) {
                let babelQuery = _this2.config.babel;

                if (!_lutils.typeOf.Object(babelQuery)) {
                    const babelrcPath = _path2.default.join(_this2.config.servicePath, '.babelrc');

                    babelQuery = _fsExtra2.default.existsSync(babelrcPath) ? JSON.parse((yield _fsExtra2.default.readFileAsync(babelrcPath))) : babelQuery;
                }

                transforms.push(new _Babel2.default(babelQuery));
            }

            let uglifyConfig = _this2.config.uglify;

            if (uglifyConfig) {
                if (!_lutils.typeOf.Object(uglifyConfig)) uglifyConfig = null;

                transforms.push(new _Uglify2.default(uglifyConfig, { logErrors: true }));
            }

            return transforms;
        })();
    }

    //
    // FIXME: UNSUED CODE BELOW
    //


    /**
     *  Finds both .serverless-include and .serverless-exclude files
     *  Generates a concatenated exclude and include list.
     *
     *  All pathing is resolved to the servicePath, so that "*" in <servicePath>/lib/.serverless-exclude
     *  will be converted to "./lib/*", a relative path.
     *
     *  @returns {Object}
     *      {
     *          include: [ "./lib/**", ... ],
     *          exclude: [ ".git", "*", ... ]
     *      }
     *
     */
    _findFilterFiles(rootPath) {
        return (0, _bluebird.coroutine)(function* () {
            const include = [];
            const exclude = [];

            const parseFile = (() => {
                var _ref3 = (0, _bluebird.coroutine)(function* (filePath) {
                    const parentDir = _path2.default.dirname(filePath);

                    const file = yield _fsExtra2.default.readFileAsync(filePath, 'utf8');

                    return file.split('\n').filter(function (line) {
                        return (/\S/.test(line)
                        );
                    }).map(function (line) {
                        line = line.trim();
                        line = _path2.default.join(parentDir.split(rootPath)[1] || '', line).replace(/^\/|\/$/g, '');

                        return `./${ line }`;
                    });
                });

                return function parseFile(_x5) {
                    return _ref3.apply(this, arguments);
                };
            })();

            yield (0, _utils.walker)(rootPath, { filters: ['node_modules'] }).on('file', (() => {
                var _ref4 = (0, _bluebird.coroutine)(function* (root, _ref5, next) {
                    let name = _ref5.name;

                    const filePath = _path2.default.join(root, name);

                    if (name === '.serverless-exclude') {
                        const lines = yield parseFile(filePath);
                        exclude.push.apply(exclude, _toConsumableArray(lines));
                    } else if (name === '.serverless-include') {
                        const lines = yield parseFile(filePath);
                        include.push.apply(include, _toConsumableArray(lines));
                    }

                    next();
                });

                return function (_x6, _x7, _x8) {
                    return _ref4.apply(this, arguments);
                };
            })()).end();

            return { include: include, exclude: exclude };
        })();
    }

}
exports.default = SourceBundler;
module.exports = exports['default'];