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
                var _ref2 = (0, _bluebird.coroutine)(function* (basePath, stats, next) {
                    /**
                     *  A relative path to the servicePath
                     *  @example ./functions/test/handler.js
                     */
                    const relPath = _path2.default.join(basePath.split(_this.config.servicePath)[1], stats.name).replace(/^\/|\/$/g, '');

                    const filePath = _path2.default.join(basePath, stats.name);

                    const testPattern = function testPattern(pattern) {
                        return _lutils.typeOf.RegExp(pattern) ? pattern.test(relPath) : (0, _minimatch2.default)(relPath, pattern, { dot: true });
                    };

                    /**
                     *  When a pattern matches an exclude, it skips
                     *  When a pattern doesnt match an include, it skips
                     */
                    if (exclude.some(testPattern)) return next();
                    if (!include.some(testPattern)) return next();

                    yield (0, _utils.handleFile)({
                        filePath: filePath, relPath: relPath, transforms: transforms,
                        transformExtensions: ['js', 'jsx'],
                        useSourceMaps: _this.config.sourceMaps,
                        artifact: _this.artifact,
                        zipConfig: _this.config.zip
                    });

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvU291cmNlQnVuZGxlci5qcyJdLCJuYW1lcyI6WyJwcm9taXNpZnlBbGwiLCJTb3VyY2VCdW5kbGVyIiwiY29uc3RydWN0b3IiLCJjb25maWciLCJhcnRpZmFjdCIsInNlcnZpY2VQYXRoIiwiYmFiZWwiLCJ1Z2xpZnkiLCJzb3VyY2VNYXBzIiwiemlwIiwiYnVuZGxlIiwiZXhjbHVkZSIsImluY2x1ZGUiLCJ0cmFuc2Zvcm1zIiwiX2NyZWF0ZVRyYW5zZm9ybXMiLCJvbkZpbGUiLCJiYXNlUGF0aCIsInN0YXRzIiwibmV4dCIsInJlbFBhdGgiLCJqb2luIiwic3BsaXQiLCJuYW1lIiwicmVwbGFjZSIsImZpbGVQYXRoIiwidGVzdFBhdHRlcm4iLCJwYXR0ZXJuIiwiUmVnRXhwIiwidGVzdCIsImRvdCIsInNvbWUiLCJ0cmFuc2Zvcm1FeHRlbnNpb25zIiwidXNlU291cmNlTWFwcyIsInppcENvbmZpZyIsImZpbHRlcnMiLCJvbiIsImVuZCIsImJhYmVsUXVlcnkiLCJPYmplY3QiLCJiYWJlbHJjUGF0aCIsImV4aXN0c1N5bmMiLCJKU09OIiwicGFyc2UiLCJyZWFkRmlsZUFzeW5jIiwicHVzaCIsInVnbGlmeUNvbmZpZyIsImxvZ0Vycm9ycyIsIl9maW5kRmlsdGVyRmlsZXMiLCJyb290UGF0aCIsInBhcnNlRmlsZSIsInBhcmVudERpciIsImRpcm5hbWUiLCJmaWxlIiwiZmlsdGVyIiwibGluZSIsIm1hcCIsInRyaW0iLCJyb290IiwibGluZXMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7OztBQUVBOztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O0FBRUEsbUJBQVFBLFlBQVI7O0FBRUE7Ozs7O0FBS2UsTUFBTUMsYUFBTixDQUFvQjtBQUMvQkMsa0JBQW1DO0FBQUEsWUFBdkJDLE1BQXVCLHlEQUFkLEVBQWM7QUFBQSxZQUFWQyxRQUFVOztBQUMvQixhQUFLRCxNQUFMO0FBQ0lFLHlC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QUE7QUFBQTtBQUFBLGdCQUFOOztBQWdCQSxrQkFBTSxtQkFBT04sUUFBUCxFQUFpQixFQUFFZCxTQUFTLENBQUUsY0FBRixDQUFYLEVBQWpCLEVBQ0RDLEVBREMsQ0FDRSxNQURGO0FBQUEscURBQ1UsV0FBT3NCLElBQVAsU0FBdUJ2QyxJQUF2QixFQUFnQztBQUFBLHdCQUFqQkksSUFBaUIsU0FBakJBLElBQWlCOztBQUN4QywwQkFBTUUsV0FBVyxlQUFLSixJQUFMLENBQVVxQyxJQUFWLEVBQWdCbkMsSUFBaEIsQ0FBakI7O0FBRUEsd0JBQUtBLFNBQVMscUJBQWQsRUFBc0M7QUFDbEMsOEJBQU1vQyxRQUFRLE1BQU1ULFVBQVV6QixRQUFWLENBQXBCO0FBQ0FiLGdDQUFRaUMsSUFBUixtQ0FBZ0JjLEtBQWhCO0FBQ0gscUJBSEQsTUFJQSxJQUFLcEMsU0FBUyxxQkFBZCxFQUFzQztBQUNsQyw4QkFBTW9DLFFBQVEsTUFBTVQsVUFBVXpCLFFBQVYsQ0FBcEI7QUFDQVosZ0NBQVFnQyxJQUFSLG1DQUFnQmMsS0FBaEI7QUFDSDs7QUFFRHhDO0FBQ0gsaUJBZEM7O0FBQUE7QUFBQTtBQUFBO0FBQUEsa0JBZURrQixHQWZDLEVBQU47O0FBaUJBLG1CQUFPLEVBQUV4QixnQkFBRixFQUFXRCxnQkFBWCxFQUFQO0FBckM2QjtBQXNDaEM7O0FBdko4QjtrQkFBZFYsYSIsImZpbGUiOiJTb3VyY2VCdW5kbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFByb21pc2UgZnJvbSAnYmx1ZWJpcmQnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzLWV4dHJhJ1xuaW1wb3J0IHsgdHlwZU9mIH0gZnJvbSAnbHV0aWxzJ1xuaW1wb3J0IGdsb2IgZnJvbSAnbWluaW1hdGNoJ1xuXG5pbXBvcnQgeyB3YWxrZXIsIGhhbmRsZUZpbGUgfSBmcm9tICcuL3V0aWxzJ1xuaW1wb3J0IEJhYmVsVHJhbnNmb3JtIGZyb20gJy4vdHJhbnNmb3Jtcy9CYWJlbCdcbmltcG9ydCBVZ2xpZnlUcmFuc2Zvcm0gZnJvbSAnLi90cmFuc2Zvcm1zL1VnbGlmeSdcblxuUHJvbWlzZS5wcm9taXNpZnlBbGwoZnMpXG5cbi8qKlxuICogIEBjbGFzcyBTb3VyY2VCdW5kbGVyXG4gKlxuICogIEhhbmRsZXMgdGhlIGluY2x1c2lvbiBvZiBzb3VyY2UgY29kZSBpbiB0aGUgYXJ0aWZhY3QuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNvdXJjZUJ1bmRsZXIge1xuICAgIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9LCBhcnRpZmFjdCkge1xuICAgICAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgICAgICAgIHNlcnZpY2VQYXRoIDogJycsICAgIC8vIHNlcnZlcmxlc3MuY29uZmlnLnNlcnZpY2VQYXRoXG4gICAgICAgICAgICBiYWJlbCAgICAgICA6IG51bGwsICAvLyBCYWJlbCBvcHRpb25zXG4gICAgICAgICAgICB1Z2xpZnkgICAgICA6IG51bGwsICAvLyBVZ2xpZnlKUyBvcHRpb25zXG4gICAgICAgICAgICBzb3VyY2VNYXBzICA6IGZhbHNlLCAvLyBXaGV0aGVyIHRvIGFkZCBzb3VyY2UgbWFwc1xuICAgICAgICAgICAgemlwICAgICAgICAgOiBudWxsLCAgLy8gWWF6bCB6aXAgb3B0aW9uc1xuICAgICAgICAgICAgLi4uY29uZmlnXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hcnRpZmFjdCA9IGFydGlmYWN0XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogIFdhbGtzIHRocm91Z2gsIHRyYW5zZm9ybXMsIGFuZCB6aXBzIHNvdXJjZSBjb250ZW50IHdpY2hcbiAgICAgKiAgaXMgYm90aCBgaW5jbHVkZWRgIGFuZCBub3QgYGV4Y2x1ZGVkYCBieSB0aGUgcmVnZXggb3IgZ2xvYiBwYXR0ZXJucy5cbiAgICAgKi9cbiAgICBhc3luYyBidW5kbGUoeyBleGNsdWRlID0gW10sIGluY2x1ZGUgPSBbXSB9KSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybXMgPSBhd2FpdCB0aGlzLl9jcmVhdGVUcmFuc2Zvcm1zKClcblxuICAgICAgICAvLyBhd2FpdCB0aGlzLl9maW5kRmlsdGVyRmlsZXMoc2VydmljZVBhdGgpXG5cbiAgICAgICAgY29uc3Qgb25GaWxlID0gYXN5bmMgKGJhc2VQYXRoLCBzdGF0cywgbmV4dCkgPT4ge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiAgQSByZWxhdGl2ZSBwYXRoIHRvIHRoZSBzZXJ2aWNlUGF0aFxuICAgICAgICAgICAgICogIEBleGFtcGxlIC4vZnVuY3Rpb25zL3Rlc3QvaGFuZGxlci5qc1xuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBjb25zdCByZWxQYXRoID0gcGF0aC5qb2luKFxuICAgICAgICAgICAgICAgIGJhc2VQYXRoLnNwbGl0KHRoaXMuY29uZmlnLnNlcnZpY2VQYXRoKVsxXSwgc3RhdHMubmFtZVxuICAgICAgICAgICAgKS5yZXBsYWNlKC9eXFwvfFxcLyQvZywgJycpXG5cbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGJhc2VQYXRoLCBzdGF0cy5uYW1lKVxuXG4gICAgICAgICAgICBjb25zdCB0ZXN0UGF0dGVybiA9IChwYXR0ZXJuKSA9PlxuICAgICAgICAgICAgICAgIHR5cGVPZi5SZWdFeHAocGF0dGVybilcbiAgICAgICAgICAgICAgICAgICAgPyBwYXR0ZXJuLnRlc3QocmVsUGF0aClcbiAgICAgICAgICAgICAgICAgICAgOiBnbG9iKHJlbFBhdGgsIHBhdHRlcm4sIHsgZG90OiB0cnVlIH0pXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogIFdoZW4gYSBwYXR0ZXJuIG1hdGNoZXMgYW4gZXhjbHVkZSwgaXQgc2tpcHNcbiAgICAgICAgICAgICAqICBXaGVuIGEgcGF0dGVybiBkb2VzbnQgbWF0Y2ggYW4gaW5jbHVkZSwgaXQgc2tpcHNcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKCBleGNsdWRlLnNvbWUodGVzdFBhdHRlcm4pICkgcmV0dXJuIG5leHQoKVxuICAgICAgICAgICAgaWYgKCAhIGluY2x1ZGUuc29tZSh0ZXN0UGF0dGVybikgKSByZXR1cm4gbmV4dCgpXG5cbiAgICAgICAgICAgIGF3YWl0IGhhbmRsZUZpbGUoe1xuICAgICAgICAgICAgICAgIGZpbGVQYXRoLCByZWxQYXRoLCB0cmFuc2Zvcm1zLFxuICAgICAgICAgICAgICAgIHRyYW5zZm9ybUV4dGVuc2lvbnMgOiBbJ2pzJywgJ2pzeCddLFxuICAgICAgICAgICAgICAgIHVzZVNvdXJjZU1hcHMgICAgICAgOiB0aGlzLmNvbmZpZy5zb3VyY2VNYXBzLFxuICAgICAgICAgICAgICAgIGFydGlmYWN0ICAgICAgICAgICAgOiB0aGlzLmFydGlmYWN0LFxuICAgICAgICAgICAgICAgIHppcENvbmZpZyAgICAgICAgICAgOiB0aGlzLmNvbmZpZy56aXAsXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICBuZXh0KClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdlIG5ldmVyIHdhbnQgbm9kZV9tb2R1bGVzIGhlcmVcbiAgICAgICAgYXdhaXQgd2Fsa2VyKHRoaXMuY29uZmlnLnNlcnZpY2VQYXRoLCB7IGZpbHRlcnM6IFsgL1xcL25vZGVfbW9kdWxlc1xcLy9pIF0gfSlcbiAgICAgICAgICAgIC5vbignZmlsZScsIG9uRmlsZSlcbiAgICAgICAgICAgIC8vIC5vbignZGlyZWN0b3J5JykgVE9ETzogYWRkIGEgZGlyZWN0b3JpZXMgY2FsbGJhY2sgdG8gbWF0Y2ggYWdhaW5zdCBleGNsdWRlIHRvIGVuaGFuY2UgcGVyZm9ybWFuY2VcbiAgICAgICAgICAgIC5lbmQoKVxuXG4gICAgICAgIHJldHVybiB0aGlzLmFydGlmYWN0XG4gICAgfVxuXG4gICAgYXN5bmMgX2NyZWF0ZVRyYW5zZm9ybXMoKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybXMgPSBbXVxuXG4gICAgICAgIGlmICggdGhpcy5jb25maWcuYmFiZWwgKSB7XG4gICAgICAgICAgICBsZXQgYmFiZWxRdWVyeSA9IHRoaXMuY29uZmlnLmJhYmVsXG5cbiAgICAgICAgICAgIGlmICggISB0eXBlT2YuT2JqZWN0KGJhYmVsUXVlcnkpICkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhYmVscmNQYXRoID0gcGF0aC5qb2luKHRoaXMuY29uZmlnLnNlcnZpY2VQYXRoLCAnLmJhYmVscmMnKVxuXG4gICAgICAgICAgICAgICAgYmFiZWxRdWVyeSA9IGZzLmV4aXN0c1N5bmMoYmFiZWxyY1BhdGgpXG4gICAgICAgICAgICAgICAgICAgID8gSlNPTi5wYXJzZSggYXdhaXQgZnMucmVhZEZpbGVBc3luYyhiYWJlbHJjUGF0aCkgKVxuICAgICAgICAgICAgICAgICAgICA6IGJhYmVsUXVlcnlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJhbnNmb3Jtcy5wdXNoKCBuZXcgQmFiZWxUcmFuc2Zvcm0oYmFiZWxRdWVyeSkgKVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVnbGlmeUNvbmZpZyA9IHRoaXMuY29uZmlnLnVnbGlmeVxuXG4gICAgICAgIGlmICggdWdsaWZ5Q29uZmlnICkge1xuICAgICAgICAgICAgaWYgKCAhIHR5cGVPZi5PYmplY3QodWdsaWZ5Q29uZmlnKSApIHVnbGlmeUNvbmZpZyA9IG51bGxcblxuICAgICAgICAgICAgdHJhbnNmb3Jtcy5wdXNoKCBuZXcgVWdsaWZ5VHJhbnNmb3JtKHVnbGlmeUNvbmZpZywgeyBsb2dFcnJvcnM6IHRydWUgfSkgKVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRyYW5zZm9ybXNcbiAgICB9XG5cblxuICAgIC8vXG4gICAgLy8gRklYTUU6IFVOU1VFRCBDT0RFIEJFTE9XXG4gICAgLy9cblxuXG4gICAgLyoqXG4gICAgICogIEZpbmRzIGJvdGggLnNlcnZlcmxlc3MtaW5jbHVkZSBhbmQgLnNlcnZlcmxlc3MtZXhjbHVkZSBmaWxlc1xuICAgICAqICBHZW5lcmF0ZXMgYSBjb25jYXRlbmF0ZWQgZXhjbHVkZSBhbmQgaW5jbHVkZSBsaXN0LlxuICAgICAqXG4gICAgICogIEFsbCBwYXRoaW5nIGlzIHJlc29sdmVkIHRvIHRoZSBzZXJ2aWNlUGF0aCwgc28gdGhhdCBcIipcIiBpbiA8c2VydmljZVBhdGg+L2xpYi8uc2VydmVybGVzcy1leGNsdWRlXG4gICAgICogIHdpbGwgYmUgY29udmVydGVkIHRvIFwiLi9saWIvKlwiLCBhIHJlbGF0aXZlIHBhdGguXG4gICAgICpcbiAgICAgKiAgQHJldHVybnMge09iamVjdH1cbiAgICAgKiAgICAgIHtcbiAgICAgKiAgICAgICAgICBpbmNsdWRlOiBbIFwiLi9saWIvKipcIiwgLi4uIF0sXG4gICAgICogICAgICAgICAgZXhjbHVkZTogWyBcIi5naXRcIiwgXCIqXCIsIC4uLiBdXG4gICAgICogICAgICB9XG4gICAgICpcbiAgICAgKi9cbiAgICBhc3luYyBfZmluZEZpbHRlckZpbGVzKHJvb3RQYXRoKSB7XG4gICAgICAgIGNvbnN0IGluY2x1ZGUgPSBbXVxuICAgICAgICBjb25zdCBleGNsdWRlID0gW11cblxuICAgICAgICBjb25zdCBwYXJzZUZpbGUgPSBhc3luYyAoZmlsZVBhdGgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudERpciA9IHBhdGguZGlybmFtZShmaWxlUGF0aClcblxuICAgICAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IGZzLnJlYWRGaWxlQXN5bmMoZmlsZVBhdGgsICd1dGY4JylcblxuICAgICAgICAgICAgcmV0dXJuIGZpbGUuc3BsaXQoJ1xcbicpXG4gICAgICAgICAgICAgICAgLmZpbHRlcigobGluZSkgPT4gL1xcUy8udGVzdChsaW5lKSApXG4gICAgICAgICAgICAgICAgLm1hcCgobGluZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsaW5lID0gbGluZS50cmltKClcbiAgICAgICAgICAgICAgICAgICAgbGluZSA9IHBhdGguam9pbiggcGFyZW50RGlyLnNwbGl0KHJvb3RQYXRoKVsxXSB8fCAnJywgbGluZSApXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXlxcL3xcXC8kL2csICcnKVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBgLi8ke2xpbmV9YFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB3YWxrZXIocm9vdFBhdGgsIHsgZmlsdGVyczogWyAnbm9kZV9tb2R1bGVzJyBdIH0pXG4gICAgICAgICAgICAub24oJ2ZpbGUnLCBhc3luYyAocm9vdCwgeyBuYW1lIH0sIG5leHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihyb290LCBuYW1lKVxuXG4gICAgICAgICAgICAgICAgaWYgKCBuYW1lID09PSAnLnNlcnZlcmxlc3MtZXhjbHVkZScgKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gYXdhaXQgcGFyc2VGaWxlKGZpbGVQYXRoKVxuICAgICAgICAgICAgICAgICAgICBleGNsdWRlLnB1c2goLi4ubGluZXMpXG4gICAgICAgICAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICAgICAgaWYgKCBuYW1lID09PSAnLnNlcnZlcmxlc3MtaW5jbHVkZScgKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gYXdhaXQgcGFyc2VGaWxlKGZpbGVQYXRoKVxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlLnB1c2goLi4ubGluZXMpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbmV4dCgpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmVuZCgpXG5cbiAgICAgICAgcmV0dXJuIHsgaW5jbHVkZSwgZXhjbHVkZSB9XG4gICAgfVxuXG59XG4iXX0=