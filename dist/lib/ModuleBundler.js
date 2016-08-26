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

var _resolvePkg = require('resolve-pkg');

var _resolvePkg2 = _interopRequireDefault(_resolvePkg);

var _utils = require('./utils');

var _Uglify = require('./transforms/Uglify');

var _Uglify2 = _interopRequireDefault(_Uglify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_bluebird2.default.promisifyAll(_fsExtra2.default);

/**
 *  @class ModuleBundler
 *
 *  Handles the inclusion of node_modules.
 */
class ModuleBundler {
    constructor() {
        let config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
        let artifact = arguments[1];

        this.config = _extends({
            servicePath: '', // serverless.config.servicePath
            uglify: null, // UglifyJS config
            zip: null }, config);

        this.artifact = artifact;
    }

    /**
     *  Determines module locations then adds them into ./node_modules
     *  inside the artifact.
     */
    bundle(_ref) {
        var _this = this;

        var _ref$include = _ref.include;
        let include = _ref$include === undefined ? [] : _ref$include;
        var _ref$exclude = _ref.exclude;
        let exclude = _ref$exclude === undefined ? [] : _ref$exclude;
        return (0, _bluebird.coroutine)(function* () {
            const modules = yield _this._resolveDependencies(_this.config.servicePath, { include: include, exclude: exclude });

            const transforms = yield _this._createTransforms();

            yield _bluebird2.default.map(modules, (() => {
                var _ref2 = (0, _bluebird.coroutine)(function* (_ref3) {
                    let packagePath = _ref3.packagePath;
                    let relativePath = _ref3.relativePath;

                    const onFile = (() => {
                        var _ref4 = (0, _bluebird.coroutine)(function* (root, stats, next) {
                            const relPath = _path2.default.join(relativePath, root.split(relativePath)[1], stats.name).replace(/^\/|\/$/g, '');

                            const filePath = _path2.default.join(root, stats.name);

                            if (/\.(js)$/i.test(filePath)) {
                                //
                                // JAVASCRIPT MODULES, transformable
                                //

                                let code = yield _fsExtra2.default.readFileAsync(filePath, 'utf8');
                                let map = '';

                                /**
                                 *  Runs transforms against the code, mutating it.
                                 *  Excludes source maps for modules.
                                 */
                                if (transforms.length) for (let transformer of transforms) {
                                    let result = transformer.run({ code: code, map: map, filePath: filePath });

                                    if (result.code) code = result.code;
                                }

                                _this.artifact.addBuffer(new Buffer(code), relPath, _this.config.zip);
                            } else {
                                //
                                // ARBITRARY FILES
                                //

                                _this.artifact.addFile(filePath, relPath, _this.config.zip);
                            }

                            next();
                        });

                        return function onFile(_x3, _x4, _x5) {
                            return _ref4.apply(this, arguments);
                        };
                    })();

                    yield (0, _utils.walker)(packagePath).on('file', onFile).end();
                });

                return function (_x2) {
                    return _ref2.apply(this, arguments);
                };
            })());

            return _this;
        })();
    }

    _createTransforms() {
        var _this2 = this;

        return (0, _bluebird.coroutine)(function* () {
            const transforms = [];

            let uglifyConfig = _this2.config.uglify;

            if (uglifyConfig) {
                if (uglifyConfig === true) uglifyConfig = null;

                transforms.push(new _Uglify2.default(uglifyConfig));
            }

            return transforms;
        })();
    }

    /**
     *  Resolves a package's dependencies to an array of paths.
     *
     *  @returns {Array}
     *      [ { name, packagePath, packagePath } ]
     */
    _resolveDependencies(initialPackageDir) {
        var _ref5 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        var _ref5$include = _ref5.include;
        let include = _ref5$include === undefined ? [] : _ref5$include;
        var _ref5$exclude = _ref5.exclude;
        let exclude = _ref5$exclude === undefined ? [] : _ref5$exclude;
        return (0, _bluebird.coroutine)(function* () {
            /**
             *  Resolves packages to their package root directory & also resolves dependant packages recursively.
             *  - Will also ignore the input package in the results
             */
            let recurse = (() => {
                var _ref6 = (0, _bluebird.coroutine)(function* (packageDir) {
                    let _include = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

                    let _exclude = arguments.length <= 2 || arguments[2] === undefined ? [] : arguments[2];

                    const packageJson = require(_path2.default.join(packageDir, './package.json'));

                    const name = packageJson.name;
                    const dependencies = packageJson.dependencies;


                    for (let packageName in dependencies) {
                        /**
                         *  Skips on exclude matches, if set
                         *  Skips on include mis-matches, if set
                         */
                        if (_exclude.length && _exclude.indexOf(packageName) > -1) continue;
                        if (_include.length && _include.indexOf(packageName) < 0) continue;

                        const resolvedDir = (0, _resolvePkg2.default)(packageName, { cwd: packageDir });
                        const relativePath = _path2.default.join('node_modules', resolvedDir.split(`${ seperator }`).slice(1).join(seperator));

                        if (relativePath in cache) continue;

                        cache[relativePath] = true;

                        const result = yield recurse(resolvedDir);

                        resolvedDeps.push(_extends({}, result, { relativePath: relativePath }));
                    }

                    return {
                        name: name, packagePath: packageDir
                    };
                });

                return function recurse(_x7, _x8, _x9) {
                    return _ref6.apply(this, arguments);
                };
            })();

            const resolvedDeps = [];
            const cache = {};
            const seperator = `${ _path.sep }node_modules${ _path.sep }`;
            console.log({ include: include, exclude: exclude });

            yield recurse(initialPackageDir, include, exclude);

            return resolvedDeps;
        })();
    }
}
exports.default = ModuleBundler;
module.exports = exports['default'];