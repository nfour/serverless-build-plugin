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
        var _ref$deepExclude = _ref.deepExclude;
        let deepExclude = _ref$deepExclude === undefined ? [] : _ref$deepExclude;
        return (0, _bluebird.coroutine)(function* () {
            const modules = yield _this._resolveDependencies(_this.config.servicePath, { include: include, exclude: exclude, deepExclude: deepExclude });

            const transforms = yield _this._createTransforms();

            yield _bluebird2.default.map(modules, (() => {
                var _ref2 = (0, _bluebird.coroutine)(function* (_ref3) {
                    let packagePath = _ref3.packagePath;
                    let relativePath = _ref3.relativePath;

                    const onFile = (() => {
                        var _ref4 = (0, _bluebird.coroutine)(function* (basePath, stats, next) {
                            const relPath = _path2.default.join(relativePath, basePath.split(relativePath)[1], stats.name).replace(/^\/|\/$/g, '');

                            const filePath = _path2.default.join(basePath, stats.name);

                            yield (0, _utils.handleFile)({
                                filePath: filePath, relPath: relPath, transforms: transforms,
                                transformExtensions: ['js', 'jsx'],
                                useSourceMaps: false,
                                artifact: _this.artifact,
                                zipConfig: _this.config.zip
                            });

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
        var _ref5$deepExclude = _ref5.deepExclude;
        let deepExclude = _ref5$deepExclude === undefined ? [] : _ref5$deepExclude;
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

                        const result = yield recurse(resolvedDir, undefined, deepExclude);

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

            yield recurse(initialPackageDir, include, exclude);

            return resolvedDeps;
        })();
    }
}
exports.default = ModuleBundler;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvTW9kdWxlQnVuZGxlci5qcyJdLCJuYW1lcyI6WyJwcm9taXNpZnlBbGwiLCJNb2R1bGVCdW5kbGVyIiwiY29uc3RydWN0b3IiLCJjb25maWciLCJhcnRpZmFjdCIsInNlcnZpY2VQYXRoIiwidWdsaWZ5IiwiemlwIiwiYnVuZGxlIiwiaW5jbHVkZSIsImV4Y2x1ZGUiLCJkZWVwRXhjbHVkZSIsIm1vZHVsZXMiLCJfcmVzb2x2ZURlcGVuZGVuY2llcyIsInRyYW5zZm9ybXMiLCJfY3JlYXRlVHJhbnNmb3JtcyIsIm1hcCIsInBhY2thZ2VQYXRoIiwicmVsYXRpdmVQYXRoIiwib25GaWxlIiwiYmFzZVBhdGgiLCJzdGF0cyIsIm5leHQiLCJyZWxQYXRoIiwiam9pbiIsInNwbGl0IiwibmFtZSIsInJlcGxhY2UiLCJmaWxlUGF0aCIsInRyYW5zZm9ybUV4dGVuc2lvbnMiLCJ1c2VTb3VyY2VNYXBzIiwiemlwQ29uZmlnIiwib24iLCJlbmQiLCJ1Z2xpZnlDb25maWciLCJwdXNoIiwiaW5pdGlhbFBhY2thZ2VEaXIiLCJwYWNrYWdlRGlyIiwiX2luY2x1ZGUiLCJfZXhjbHVkZSIsInBhY2thZ2VKc29uIiwicmVxdWlyZSIsImRlcGVuZGVuY2llcyIsInBhY2thZ2VOYW1lIiwibGVuZ3RoIiwiaW5kZXhPZiIsInJlc29sdmVkRGlyIiwiY3dkIiwic2VwZXJhdG9yIiwic2xpY2UiLCJjYWNoZSIsInJlc3VsdCIsInJlY3Vyc2UiLCJ1bmRlZmluZWQiLCJyZXNvbHZlZERlcHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUVBOztBQUNBOzs7Ozs7QUFFQSxtQkFBUUEsWUFBUjs7QUFFQTs7Ozs7QUFLZSxNQUFNQyxhQUFOLENBQW9CO0FBQy9CQyxrQkFBbUM7QUFBQSxZQUF2QkMsTUFBdUIseURBQWQsRUFBYztBQUFBLFlBQVZDLFFBQVU7O0FBQy9CLGFBQUtELE1BQUw7QUFDSUUseUJBQWMs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LGtCQUFNRixZQUFnQixJQUFELFNBQU8saUJBQVAsU0FBeUIsR0FBOUM7O0FBb0NBLGtCQUFNSSxRQUFRaEIsaUJBQVIsRUFBMkIzQixPQUEzQixFQUFvQ0MsT0FBcEMsQ0FBTjs7QUFFQSxtQkFBTzRDLFlBQVA7QUF6Q2lHO0FBMENwRztBQTlHOEI7a0JBQWRyRCxhIiwiZmlsZSI6Ik1vZHVsZUJ1bmRsZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCdcbmltcG9ydCBwYXRoLCB7IHNlcCB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgZnMgZnJvbSAnZnMtZXh0cmEnXG5pbXBvcnQgcmVzb2x2ZVBhY2thZ2UgZnJvbSAncmVzb2x2ZS1wa2cnXG5cbmltcG9ydCB7IHdhbGtlciwgaGFuZGxlRmlsZSB9IGZyb20gJy4vdXRpbHMnXG5pbXBvcnQgVWdsaWZ5VHJhbnNmb3JtIGZyb20gJy4vdHJhbnNmb3Jtcy9VZ2xpZnknXG5cblByb21pc2UucHJvbWlzaWZ5QWxsKGZzKVxuXG4vKipcbiAqICBAY2xhc3MgTW9kdWxlQnVuZGxlclxuICpcbiAqICBIYW5kbGVzIHRoZSBpbmNsdXNpb24gb2Ygbm9kZV9tb2R1bGVzLlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb2R1bGVCdW5kbGVyIHtcbiAgICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSwgYXJ0aWZhY3QpIHtcbiAgICAgICAgdGhpcy5jb25maWcgPSB7XG4gICAgICAgICAgICBzZXJ2aWNlUGF0aCA6ICcnLCAgIC8vIHNlcnZlcmxlc3MuY29uZmlnLnNlcnZpY2VQYXRoXG4gICAgICAgICAgICB1Z2xpZnkgICAgICA6IG51bGwsIC8vIFVnbGlmeUpTIGNvbmZpZ1xuICAgICAgICAgICAgemlwICAgICAgICAgOiBudWxsLCAvLyBZYXpsIHppcCBjb25maWdcbiAgICAgICAgICAgIC4uLmNvbmZpZyxcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXJ0aWZhY3QgPSBhcnRpZmFjdFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBEZXRlcm1pbmVzIG1vZHVsZSBsb2NhdGlvbnMgdGhlbiBhZGRzIHRoZW0gaW50byAuL25vZGVfbW9kdWxlc1xuICAgICAqICBpbnNpZGUgdGhlIGFydGlmYWN0LlxuICAgICAqL1xuICAgIGFzeW5jIGJ1bmRsZSh7IGluY2x1ZGUgPSBbXSwgZXhjbHVkZSA9IFtdLCBkZWVwRXhjbHVkZSA9IFtdIH0pIHtcbiAgICAgICAgY29uc3QgbW9kdWxlcyA9IGF3YWl0IHRoaXMuX3Jlc29sdmVEZXBlbmRlbmNpZXModGhpcy5jb25maWcuc2VydmljZVBhdGgsIHsgaW5jbHVkZSwgZXhjbHVkZSwgZGVlcEV4Y2x1ZGUgfSlcblxuICAgICAgICBjb25zdCB0cmFuc2Zvcm1zID0gYXdhaXQgdGhpcy5fY3JlYXRlVHJhbnNmb3JtcygpXG5cbiAgICAgICAgYXdhaXQgUHJvbWlzZS5tYXAobW9kdWxlcywgYXN5bmMgKHsgcGFja2FnZVBhdGgsIHJlbGF0aXZlUGF0aCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBvbkZpbGUgPSBhc3luYyAoYmFzZVBhdGgsIHN0YXRzLCBuZXh0KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVsUGF0aCA9IHBhdGguam9pbihcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpdmVQYXRoLCBiYXNlUGF0aC5zcGxpdChyZWxhdGl2ZVBhdGgpWzFdLCBzdGF0cy5uYW1lXG4gICAgICAgICAgICAgICAgKS5yZXBsYWNlKC9eXFwvfFxcLyQvZywgJycpXG5cbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgc3RhdHMubmFtZSlcblxuICAgICAgICAgICAgICAgIGF3YWl0IGhhbmRsZUZpbGUoe1xuICAgICAgICAgICAgICAgICAgICBmaWxlUGF0aCwgcmVsUGF0aCwgdHJhbnNmb3JtcyxcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtRXh0ZW5zaW9ucyA6IFsnanMnLCAnanN4J10sXG4gICAgICAgICAgICAgICAgICAgIHVzZVNvdXJjZU1hcHMgICAgICAgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgYXJ0aWZhY3QgICAgICAgICAgICA6IHRoaXMuYXJ0aWZhY3QsXG4gICAgICAgICAgICAgICAgICAgIHppcENvbmZpZyAgICAgICAgICAgOiB0aGlzLmNvbmZpZy56aXAsXG4gICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgIG5leHQoKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCB3YWxrZXIocGFja2FnZVBhdGgpXG4gICAgICAgICAgICAgICAgLm9uKCdmaWxlJywgb25GaWxlKVxuICAgICAgICAgICAgICAgIC5lbmQoKVxuICAgICAgICB9KVxuXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgYXN5bmMgX2NyZWF0ZVRyYW5zZm9ybXMoKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybXMgPSBbXVxuXG4gICAgICAgIGxldCB1Z2xpZnlDb25maWcgPSB0aGlzLmNvbmZpZy51Z2xpZnlcblxuICAgICAgICBpZiAoIHVnbGlmeUNvbmZpZyApIHtcbiAgICAgICAgICAgIGlmICggdWdsaWZ5Q29uZmlnID09PSB0cnVlICkgdWdsaWZ5Q29uZmlnID0gbnVsbFxuXG4gICAgICAgICAgICB0cmFuc2Zvcm1zLnB1c2goIG5ldyBVZ2xpZnlUcmFuc2Zvcm0odWdsaWZ5Q29uZmlnKSApXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJhbnNmb3Jtc1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBSZXNvbHZlcyBhIHBhY2thZ2UncyBkZXBlbmRlbmNpZXMgdG8gYW4gYXJyYXkgb2YgcGF0aHMuXG4gICAgICpcbiAgICAgKiAgQHJldHVybnMge0FycmF5fVxuICAgICAqICAgICAgWyB7IG5hbWUsIHBhY2thZ2VQYXRoLCBwYWNrYWdlUGF0aCB9IF1cbiAgICAgKi9cbiAgICBhc3luYyBfcmVzb2x2ZURlcGVuZGVuY2llcyhpbml0aWFsUGFja2FnZURpciwgeyBpbmNsdWRlID0gW10sIGV4Y2x1ZGUgPSBbXSwgZGVlcEV4Y2x1ZGUgPSBbXSB9ID0ge30pIHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWREZXBzID0gW11cbiAgICAgICAgY29uc3QgY2FjaGUgICAgICAgID0ge31cbiAgICAgICAgY29uc3Qgc2VwZXJhdG9yICAgID0gYCR7c2VwfW5vZGVfbW9kdWxlcyR7c2VwfWBcblxuICAgICAgICAvKipcbiAgICAgICAgICogIFJlc29sdmVzIHBhY2thZ2VzIHRvIHRoZWlyIHBhY2thZ2Ugcm9vdCBkaXJlY3RvcnkgJiBhbHNvIHJlc29sdmVzIGRlcGVuZGFudCBwYWNrYWdlcyByZWN1cnNpdmVseS5cbiAgICAgICAgICogIC0gV2lsbCBhbHNvIGlnbm9yZSB0aGUgaW5wdXQgcGFja2FnZSBpbiB0aGUgcmVzdWx0c1xuICAgICAgICAgKi9cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gcmVjdXJzZShwYWNrYWdlRGlyLCBfaW5jbHVkZSA9IFtdLCBfZXhjbHVkZSA9IFtdKSB7XG4gICAgICAgICAgICBjb25zdCBwYWNrYWdlSnNvbiA9IHJlcXVpcmUoIHBhdGguam9pbihwYWNrYWdlRGlyLCAnLi9wYWNrYWdlLmpzb24nKSApXG5cbiAgICAgICAgICAgIGNvbnN0IHsgbmFtZSwgZGVwZW5kZW5jaWVzIH0gPSBwYWNrYWdlSnNvblxuXG4gICAgICAgICAgICBmb3IgKCBsZXQgcGFja2FnZU5hbWUgaW4gZGVwZW5kZW5jaWVzICkge1xuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgICAqICBTa2lwcyBvbiBleGNsdWRlIG1hdGNoZXMsIGlmIHNldFxuICAgICAgICAgICAgICAgICAqICBTa2lwcyBvbiBpbmNsdWRlIG1pcy1tYXRjaGVzLCBpZiBzZXRcbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBpZiAoIF9leGNsdWRlLmxlbmd0aCAmJiBfZXhjbHVkZS5pbmRleE9mKHBhY2thZ2VOYW1lKSA+IC0xICkgY29udGludWVcbiAgICAgICAgICAgICAgICBpZiAoIF9pbmNsdWRlLmxlbmd0aCAmJiBfaW5jbHVkZS5pbmRleE9mKHBhY2thZ2VOYW1lKSA8IDAgKSBjb250aW51ZVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWREaXIgID0gcmVzb2x2ZVBhY2thZ2UocGFja2FnZU5hbWUsIHsgY3dkOiBwYWNrYWdlRGlyIH0pXG4gICAgICAgICAgICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gcGF0aC5qb2luKCAnbm9kZV9tb2R1bGVzJywgcmVzb2x2ZWREaXIuc3BsaXQoYCR7c2VwZXJhdG9yfWApLnNsaWNlKDEpLmpvaW4oc2VwZXJhdG9yKSApXG5cbiAgICAgICAgICAgICAgICBpZiAoIHJlbGF0aXZlUGF0aCBpbiBjYWNoZSApIGNvbnRpbnVlXG5cbiAgICAgICAgICAgICAgICBjYWNoZVtyZWxhdGl2ZVBhdGhdID0gdHJ1ZVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVjdXJzZShyZXNvbHZlZERpciwgdW5kZWZpbmVkLCBkZWVwRXhjbHVkZSlcblxuICAgICAgICAgICAgICAgIHJlc29sdmVkRGVwcy5wdXNoKHsgLi4ucmVzdWx0LCByZWxhdGl2ZVBhdGggfSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBuYW1lLCBwYWNrYWdlUGF0aDogcGFja2FnZURpcixcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHJlY3Vyc2UoaW5pdGlhbFBhY2thZ2VEaXIsIGluY2x1ZGUsIGV4Y2x1ZGUpXG5cbiAgICAgICAgcmV0dXJuIHJlc29sdmVkRGVwc1xuICAgIH1cbn1cbiJdfQ==