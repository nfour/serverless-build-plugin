'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = function (S) {
    const SCli = require(S.getServerlessPath('utils/cli')); // eslint-disable-line

    class ServerlessBuildPlugin extends S.classes.Plugin {

        /**
         *  This is intended to operate as a base configuration passed to each sub class.
         */
        constructor() {
            //
            // SERVERLESS
            //

            super();
            this.config = {
                tryFiles: ["webpack.config.js"],
                baseExclude: [/\bnode_modules\b/],

                modules: {
                    exclude: ['aws-sdk']
                },

                exclude: [],
                include: [],

                uglify: true,
                uglifySource: false,
                uglifyModules: true,

                babel: null,
                sourceMaps: true,

                // Passed to `yazl` as options
                zip: { compress: true },

                method: 'bundle',
                file: null,

                functions: {}
            };
            this.name = 'ServerlessBuildPlugin';

            // PLUGIN CONFIG GENERATION

            const servicePath = S.config.projectPath;
            const buildConfigPath = _path2.default.join(servicePath, './serverless.build.yml');

            const buildConfig = _fsExtra2.default.existsSync(buildConfigPath) ? _jsYaml2.default.load(_fsExtra2.default.readFileSync(buildConfigPath)) : {};

            this.serverless = {
                config: { servicePath: servicePath },
                service: { package: {} },
                cli: SCli
            };
            // The config inherits from multiple sources
            this.config = _extends({}, this.config, buildConfig);
        }

        init(e) {
            var _this = this;

            return (0, _bluebird.coroutine)(function* () {
                const project = S.getProject();

                const functions = project.functions;


                _this.serverless.service.service = project.name;

                let selectedFunctions = _lutils.typeOf.Array(project.getFunction(e.options.name)) ? project.getFunction(e.options.name) : [project.getFunction(e.options.name)];

                selectedFunctions = selectedFunctions.filter(function (key) {
                    return key in functions;
                });
                selectedFunctions = selectedFunctions.length ? selectedFunctions : Object.keys(functions);

                /**
                 *  An array of full realized functions configs to build against.
                 *  Inherits from
                 *  - serverless.yml functions.<fn>.package
                 *  - serverless.build.yml functions.<fn>
                 *
                 *  in order to generate `include`, `exclude`
                 */
                _this.functions = selectedFunctions.reduce(function (obj, fnKey) {
                    const fnCfg = functions[fnKey];
                    const fnBuildCfg = _this.config.functions[fnKey] || {};

                    const include = [].concat(_toConsumableArray(_this.config.include || []), _toConsumableArray(fnCfg.package && fnCfg.package.include || []), _toConsumableArray(fnBuildCfg.include || []));

                    const exclude = [].concat(_toConsumableArray(_this.config.baseExclude || []), _toConsumableArray(_this.config.exclude || []), _toConsumableArray(fnCfg.package && fnCfg.package.exclude || []), _toConsumableArray(fnBuildCfg.exclude || []));

                    // Utilize the proposed `package` configuration for functions
                    obj[fnKey] = _extends({}, fnCfg, {

                        package: _extends({}, fnCfg.package || {}, _this.config.functions[fnKey] || {}, {
                            include: include, exclude: exclude
                        })
                    });

                    return obj;
                }, {});

                // console.inspect({ options: this.config })
                // console.inspect({ functions: this.functions })

                return e;
            })();
        }

        registerActions() {
            var _this2 = this;

            return (0, _bluebird.coroutine)(function* () {
                S.addAction(_this2.completeArtifact.bind(_this2), {
                    handler: 'buildCompleteArtifact',
                    description: 'Builds artifact for deployment'
                });
                return;
            })();
        }

        registerHooks() {
            var _this3 = this;

            return (0, _bluebird.coroutine)(function* () {
                S.addHook(_this3.init.bind(_this3), {
                    action: 'functionDeploy',
                    event: 'pre'
                });
                S.addHook(_this3.build.bind(_this3), {
                    action: 'codeDeployLambda',
                    event: 'pre'
                });
                return;
            })();
        }

        build(e) {
            var _this4 = this;

            return (0, _bluebird.coroutine)(function* () {

                // TODO in the future:
                // - create seperate zips
                // - modify artifact completion process, splitting builds up into seperate artifacts

                _this4.serverless.cli.log(`Serverless Build triggered for ${ e.options.name }...`);

                const method = _this4.config.method;

                let moduleIncludes = [];
                let moduleExcludes = [];

                // Set build paths
                _this4.tmpDir = e.options.pathDist;
                _this4.buildTmpDir = _path2.default.join(_this4.tmpDir, './build');
                _this4.artifactTmpDir = _path2.default.join(e.options.pathDist, './artifacts');
                _this4.deployTmpDir = _path2.default.join(e.options.pathDist, './deploy');

                yield _fsExtra2.default.ensureDirAsync(_this4.buildTmpDir);
                yield _fsExtra2.default.ensureDirAsync(_this4.artifactTmpDir);

                const artifact = new _yazl2.default.ZipFile();

                if (method === 'bundle') {
                    //
                    // SOURCE BUNDLER
                    //

                    const sourceBundler = new _SourceBundler2.default(_extends({}, _this4.config, {
                        uglify: _this4.config.uglifySource ? _this4.config.uglify : undefined,
                        servicePath: S.config.projectPath
                    }), artifact);

                    for (const fnKey in _this4.functions) {
                        if (fnKey === e.options.name) {
                            const config = _this4.functions[fnKey];

                            _this4.serverless.cli.log(`Bundling ${ fnKey }...`);

                            // Synchronous for now, but can be parellel
                            config.package.exclude.push('_meta');

                            yield sourceBundler.bundle({
                                exclude: config.package.exclude,
                                include: config.package.include
                            });
                        }
                    }
                } else if (method === 'file') {
                    //
                    // BUILD FILE
                    //

                    // This builds all functions
                    const fileBuild = yield new _FileBuild2.default(_extends({}, _this4.config, {
                        servicePath: S.config.projectPath,
                        buildTmpDir: _this4.buildTmpDir,
                        functions: _this4.functions,
                        serverless: _this4.serverless
                    }), artifact).build();

                    moduleIncludes = [].concat(_toConsumableArray(fileBuild.externals)); // Spread, for an iterator
                } else {
                    throw new Error("Unknown build method under `custom.build.method`");
                }

                let funcModuleExcludes = [];
                if (_this4.functions[e.options.name].package.modules) {
                    funcModuleExcludes = _this4.functions[e.options.name].package.modules.exclude || [];
                }

                moduleExcludes = [].concat(_toConsumableArray(_this4.config.modules.exclude), _toConsumableArray(funcModuleExcludes));

                yield new _ModuleBundler2.default(_extends({}, _this4.config, {
                    uglify: _this4.config.uglifyModules ? _this4.config.uglify : undefined,
                    servicePath: S.config.projectPath
                }), artifact).bundle({
                    include: moduleIncludes,
                    exclude: moduleExcludes
                });

                // Serverless 0.5 hack, rebuild a _serverless_handler.js file while still keeping env vars

                const funcObj = S.getProject().getFunction(e.options.name);
                const funcPath = _path2.default.relative(S.config.projectPath, funcObj.getRootPath());

                var _functions$e$options$ = _this4.functions[e.options.name].handler.split('.');

                var _functions$e$options$2 = _slicedToArray(_functions$e$options$, 2);

                const handlerFile = _functions$e$options$2[0];
                const handlerFunc = _functions$e$options$2[1];
                // Read existing handler from fs

                const serverlessHandler = _fsExtra2.default.readFileSync(`${ e.options.pathDist }/_serverless_handler.js`, 'utf8');
                /// Replace exported handler with correct path as per build process
                const oldExport = serverlessHandler.match(/exports\.handler = require\("(.*)"\)\["(.*)"\];/img)[0];
                const newExport = `exports.handler = require("./${ funcPath }/${ handlerFile }")["${ handlerFunc }"]`;
                // Add handler to zip
                artifact.addBuffer(new Buffer(serverlessHandler.replace(oldExport, newExport)), '_serverless_handler.js', _this4.config.zip);

                e.options.artifact = artifact;

                return S.actions.buildCompleteArtifact(e);
            })();
        }

        completeArtifact(e) {
            var _this5 = this;

            return (0, _bluebird.coroutine)(function* () {
                _this5.serverless.cli.log('Compiling deployment artifact');
                yield _this5._completeArtifact({
                    artifact: e.options.artifact,
                    functionName: e.options.name,
                    artifactTmpDir: `${ e.options.pathDist }/artifacts`
                });

                const zipPath = _this5.serverless.service.package.artifact;

                const deployTmpDir = _path2.default.join(e.options.pathDist, './deploy');

                yield _this5._unpackZip({
                    zipPath: zipPath,
                    deployTmpDir: deployTmpDir
                });

                e.options.pathDist = deployTmpDir;
                return e;
            })();
        }

        _unpackZip(_ref) {
            let zipPath = _ref.zipPath;
            let deployTmpDir = _ref.deployTmpDir;
            return (0, _bluebird.coroutine)(function* () {
                return yield new _bluebird2.default(function (resolve, reject) {
                    _yauzl2.default.open(zipPath, { lazyEntries: true }, function (err, zipfile) {
                        if (err) throw err;

                        zipfile.readEntry();
                        zipfile.on("entry", function (entry) {
                            if (/\/$/.test(entry.fileName)) {
                                // directory file names end with '/'
                                (0, _mkdirp2.default)(`${ deployTmpDir }/${ entry.fileName }`, function (mkdirErr) {
                                    if (mkdirErr) throw mkdirErr;
                                    zipfile.readEntry();
                                });
                            } else {
                                // file entry
                                zipfile.openReadStream(entry, function (rsErr, readStream) {
                                    if (rsErr) throw rsErr;
                                    // ensure parent directory exists
                                    (0, _mkdirp2.default)(_path2.default.dirname(`${ deployTmpDir }/${ entry.fileName }`), function (mkdirErr) {
                                        if (mkdirErr) throw mkdirErr;
                                        readStream.pipe(_fsExtra2.default.createWriteStream(`${ deployTmpDir }/${ entry.fileName }`));
                                        readStream.on("end", function () {
                                            zipfile.readEntry();
                                        });
                                    });
                                });
                            }
                        });

                        zipfile.once("end", function () {
                            zipfile.close();
                            resolve();
                        });
                    });
                });
            })();
        }

        /**
         *  Writes the `artifact` and attaches it to serverless
         */
        _completeArtifact(_ref2) {
            var _this6 = this;

            let artifact = _ref2.artifact;
            let functionName = _ref2.functionName;
            let artifactTmpDir = _ref2.artifactTmpDir;
            return (0, _bluebird.coroutine)(function* () {
                // Purge existing artifacts
                if (!_this6.config.keep) yield _fsExtra2.default.emptyDirAsync(artifactTmpDir);

                const zipPath = _path2.default.resolve(artifactTmpDir, `./${ _this6.serverless.service.service }-${ functionName }-${ new Date().getTime() }.zip`);

                yield new _bluebird2.default(function (resolve, reject) {
                    artifact.outputStream.pipe(_fsExtra2.default.createWriteStream(zipPath)).on("error", reject).on("close", resolve);

                    artifact.end();
                });

                _this6.serverless.service.package.artifact = zipPath;

                // Purge build dir
                if (!_this6.config.keep) yield _fsExtra2.default.emptyDirAsync(_this6.buildTmpDir);
            })();
        }

    }

    return ServerlessBuildPlugin;
};

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _yazl = require('yazl');

var _yazl2 = _interopRequireDefault(_yazl);

var _yauzl = require('yauzl');

var _yauzl2 = _interopRequireDefault(_yauzl);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _lutils = require('lutils');

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

var _ModuleBundler = require('./ModuleBundler');

var _ModuleBundler2 = _interopRequireDefault(_ModuleBundler);

var _SourceBundler = require('./SourceBundler');

var _SourceBundler2 = _interopRequireDefault(_SourceBundler);

var _FileBuild = require('./FileBuild');

var _FileBuild2 = _interopRequireDefault(_FileBuild);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

_bluebird2.default.promisifyAll(_fsExtra2.default);

// FIXME: for debugging, remove later
console.inspect = function (val) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
    }

    return console.log(require('util').inspect(val, _extends({ depth: 6, colors: true }, args)));
};

module.exports = exports['default'];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvU2VydmVybGVzc0J1aWxkUGx1Z2luLTAuNS5qcyJdLCJuYW1lcyI6WyJTIiwiU0NsaSIsInJlcXVpcmUiLCJnZXRTZXJ2ZXJsZXNzUGF0aCIsIlNlcnZlcmxlc3NCdWlsZFBsdWdpbiIsImNsYXNzZXMiLCJQbHVnaW4iLCJjb25zdHJ1Y3RvciIsImNvbmZpZyIsInRyeUZpbGVzIiwiZXhjbHVkZWRFeHRlcm5hbHMiLCJiYXNlRXhjbHVkZSIsImV4Y2x1ZGUiLCJpbmNsdWRlIiwidWdsaWZ5IiwidWdsaWZ5U291cmNlIiwidWdsaWZ5TW9kdWxlcyIsImJhYmVsIiwic291cmNlTWFwcyIsInppcCIsImNvbXByZXNzIiwibWV0aG9kIiwiZmlsZSIsImZ1bmN0aW9ucyIsIm5hbWUiLCJzZXJ2aWNlUGF0aCIsInByb2plY3RQYXRoIiwiYnVpbGRDb25maWdQYXRoIiwiam9pbiIsImJ1aWxkQ29uZmlnIiwiZXhpc3RzU3luYyIsImxvYWQiLCJyZWFkRmlsZVN5bmMiLCJzZXJ2ZXJsZXNzIiwic2VydmljZSIsInBhY2thZ2UiLCJjbGkiLCJpbml0IiwiZSIsInByb2plY3QiLCJnZXRQcm9qZWN0Iiwic2VsZWN0ZWRGdW5jdGlvbnMiLCJBcnJheSIsImdldEZ1bmN0aW9uIiwib3B0aW9ucyIsImZpbHRlciIsImtleSIsImxlbmd0aCIsIk9iamVjdCIsImtleXMiLCJyZWR1Y2UiLCJvYmoiLCJmbktleSIsImZuQ2ZnIiwiZm5CdWlsZENmZyIsInJlZ2lzdGVyQWN0aW9ucyIsImFkZEFjdGlvbiIsImNvbXBsZXRlQXJ0aWZhY3QiLCJiaW5kIiwiaGFuZGxlciIsImRlc2NyaXB0aW9uIiwicmVnaXN0ZXJIb29rcyIsImFkZEhvb2siLCJhY3Rpb24iLCJldmVudCIsImJ1aWxkIiwibG9nIiwibW9kdWxlSW5jbHVkZXMiLCJ0bXBEaXIiLCJwYXRoRGlzdCIsImJ1aWxkVG1wRGlyIiwiYXJ0aWZhY3RUbXBEaXIiLCJkZXBsb3lUbXBEaXIiLCJlbnN1cmVEaXJBc3luYyIsImFydGlmYWN0IiwiWmlwRmlsZSIsInNvdXJjZUJ1bmRsZXIiLCJ1bmRlZmluZWQiLCJwdXNoIiwiYnVuZGxlIiwiZmlsZUJ1aWxkIiwiZXh0ZXJuYWxzIiwiRXJyb3IiLCJmdW5jT2JqIiwiZnVuY1BhdGgiLCJyZWxhdGl2ZSIsImdldFJvb3RQYXRoIiwic3BsaXQiLCJoYW5kbGVyRmlsZSIsImhhbmRsZXJGdW5jIiwic2VydmVybGVzc0hhbmRsZXIiLCJvbGRFeHBvcnQiLCJtYXRjaCIsIm5ld0V4cG9ydCIsImFkZEJ1ZmZlciIsIkJ1ZmZlciIsInJlcGxhY2UiLCJhY3Rpb25zIiwiYnVpbGRDb21wbGV0ZUFydGlmYWN0IiwiX2NvbXBsZXRlQXJ0aWZhY3QiLCJmdW5jdGlvbk5hbWUiLCJ6aXBQYXRoIiwiX3VucGFja1ppcCIsInJlc29sdmUiLCJyZWplY3QiLCJvcGVuIiwibGF6eUVudHJpZXMiLCJlcnIiLCJ6aXBmaWxlIiwicmVhZEVudHJ5Iiwib24iLCJlbnRyeSIsInRlc3QiLCJmaWxlTmFtZSIsIm1rZGlyRXJyIiwib3BlblJlYWRTdHJlYW0iLCJyc0VyciIsInJlYWRTdHJlYW0iLCJkaXJuYW1lIiwicGlwZSIsImNyZWF0ZVdyaXRlU3RyZWFtIiwib25jZSIsImNsb3NlIiwia2VlcCIsImVtcHR5RGlyQXN5bmMiLCJEYXRlIiwiZ2V0VGltZSIsIm91dHB1dFN0cmVhbSIsImVuZCIsInByb21pc2lmeUFsbCIsImNvbnNvbGUiLCJpbnNwZWN0IiwidmFsIiwiYXJncyIsImRlcHRoIiwiY29sb3JzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztrQkFrQmUsVUFBVUEsQ0FBVixFQUFhO0FBQ3hCLFVBQU1DLE9BQU9DLFFBQVFGLEVBQUVHLGlCQUFGLENBQW9CLFdBQXBCLENBQVIsQ0FBYixDQUR3QixDQUNnQzs7QUFFeEQsVUFBTUMscUJBQU4sU0FBb0NKLEVBQUVLLE9BQUYsQ0FBVUMsTUFBOUMsQ0FBcUQ7O0FBMkJqRDs7O0FBR0FDLHNCQUFjO0FBQ1Y7QUFDQTtB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QUcsSUFBSXlCLElBQUosR0FBV0MsT0FBWCxFQUFxQixPQUExRyxDQUFoQjs7QUFFQSxzQkFBTSx1QkFBWSxVQUFDdkIsT0FBRCxFQUFVQyxNQUFWLEVBQXFCO0FBQ25DOUIsNkJBQVNxRCxZQUFULENBQXNCUixJQUF0QixDQUE0QixrQkFBR0MsaUJBQUgsQ0FBcUJuQixPQUFyQixDQUE1QixFQUNDUyxFQURELENBQ0ksT0FESixFQUNhTixNQURiLEVBRUNNLEVBRkQsQ0FFSSxPQUZKLEVBRWFQLE9BRmI7O0FBSUE3Qiw2QkFBU3NELEdBQVQ7QUFDSCxpQkFOSyxDQUFOOztBQVFBLHVCQUFLL0YsVUFBTCxDQUFnQkMsT0FBaEIsQ0FBd0JDLE9BQXhCLENBQWdDdUMsUUFBaEMsR0FBMkMyQixPQUEzQzs7QUFFQTtBQUNBLG9CQUFLLENBQUUsT0FBSzdGLE1BQUwsQ0FBWW1ILElBQW5CLEVBQ0ksTUFBTSxrQkFBR0MsYUFBSCxDQUFpQixPQUFLdEQsV0FBdEIsQ0FBTjtBQW5CNEQ7QUFvQm5FOztBQTdUZ0Q7O0FBaVVyRCxXQUFPbEUscUJBQVA7QUFDSCxDOztBQXRWRDs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7O0FBQ0E7Ozs7QUFFQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O0FBRUEsbUJBQVE2SCxZQUFSOztBQUVBO0FBQ0FDLFFBQVFDLE9BQVIsR0FBa0IsVUFBQ0MsR0FBRDtBQUFBLHNDQUFTQyxJQUFUO0FBQVNBLFlBQVQ7QUFBQTs7QUFBQSxXQUFrQkgsUUFBUWhFLEdBQVIsQ0FBYWhFLFFBQVEsTUFBUixFQUFnQmlJLE9BQWhCLENBQXdCQyxHQUF4QixhQUErQkUsT0FBTyxDQUF0QyxFQUF5Q0MsUUFBUSxJQUFqRCxJQUEwREYsSUFBMUQsRUFBYixDQUFsQjtBQUFBLENBQWxCIiwiZmlsZSI6IlNlcnZlcmxlc3NCdWlsZFBsdWdpbi0wLjUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCdcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgWWF6bCBmcm9tICd5YXpsJ1xuaW1wb3J0IFlhdXpsIGZyb20gJ3lhdXpsJ1xuaW1wb3J0IG1rZGlycCBmcm9tICdta2RpcnAnXG5pbXBvcnQgZnMgZnJvbSAnZnMtZXh0cmEnXG5pbXBvcnQgeyB0eXBlT2YgfSBmcm9tICdsdXRpbHMnXG5pbXBvcnQgWWFtbCBmcm9tICdqcy15YW1sJ1xuXG5pbXBvcnQgTW9kdWxlQnVuZGxlciBmcm9tICcuL01vZHVsZUJ1bmRsZXInXG5pbXBvcnQgU291cmNlQnVuZGxlciBmcm9tICcuL1NvdXJjZUJ1bmRsZXInXG5pbXBvcnQgRmlsZUJ1aWxkIGZyb20gJy4vRmlsZUJ1aWxkJ1xuXG5Qcm9taXNlLnByb21pc2lmeUFsbChmcylcblxuLy8gRklYTUU6IGZvciBkZWJ1Z2dpbmcsIHJlbW92ZSBsYXRlclxuY29uc29sZS5pbnNwZWN0ID0gKHZhbCwgLi4uYXJncykgPT4gY29uc29sZS5sb2coIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHZhbCwgeyBkZXB0aDogNiwgY29sb3JzOiB0cnVlLCAuLi5hcmdzIH0pIClcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKFMpIHtcbiAgICBjb25zdCBTQ2xpID0gcmVxdWlyZShTLmdldFNlcnZlcmxlc3NQYXRoKCd1dGlscy9jbGknKSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblxuICAgIGNsYXNzIFNlcnZlcmxlc3NCdWlsZFBsdWdpbiBleHRlbmRzIFMuY2xhc3Nlcy5QbHVnaW4ge1xuXG5cbiAgICAgICAgY29uZmlnID0ge1xuICAgICAgICAgICAgdHJ5RmlsZXMgICAgICAgICAgOiBbIFwid2VicGFjay5jb25maWcuanNcIiBdLFxuICAgICAgICAgICAgZXhjbHVkZWRFeHRlcm5hbHMgOiBbICdhd3Mtc2RrJyBdLFxuICAgICAgICAgICAgYmFzZUV4Y2x1ZGUgICAgICAgOiBbIC9cXGJub2RlX21vZHVsZXNcXGIvIF0sXG5cbiAgICAgICAgICAgIGV4Y2x1ZGU6IFtdLFxuICAgICAgICAgICAgaW5jbHVkZSA6IFtdLFxuXG4gICAgICAgICAgICB1Z2xpZnkgICAgICAgIDogdHJ1ZSxcbiAgICAgICAgICAgIHVnbGlmeVNvdXJjZSAgOiBmYWxzZSxcbiAgICAgICAgICAgIHVnbGlmeU1vZHVsZXMgOiB0cnVlLFxuXG4gICAgICAgICAgICBiYWJlbCAgICAgIDogbnVsbCxcbiAgICAgICAgICAgIHNvdXJjZU1hcHMgOiB0cnVlLFxuXG4gICAgICAgICAgICAvLyBQYXNzZWQgdG8gYHlhemxgIGFzIG9wdGlvbnNcbiAgICAgICAgICAgIHppcDogeyBjb21wcmVzczogdHJ1ZSB9LFxuXG4gICAgICAgICAgICBtZXRob2QgOiAnYnVuZGxlJyxcbiAgICAgICAgICAgIGZpbGUgICA6IG51bGwsXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uczoge31cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgVGhpcyBpcyBpbnRlbmRlZCB0byBvcGVyYXRlIGFzIGEgYmFzZSBjb25maWd1cmF0aW9uIHBhc3NlZCB0byBlYWNoIHN1YiBjbGFzcy5cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIFNFUlZFUkxFU1NcbiAgICAgICAgICAgIC8vXG5cbiAgICAgICAgICAgIHN1cGVyKClcbiAgICAgICAgICAgIHRoaXMubmFtZSA9ICdTZXJ2ZXJsZXNzQnVpbGRQbHVnaW4nXG5cbiAgICAgICAgICAgIC8vIFBMVUdJTiBDT05GSUcgR0VORVJBVElPTlxuXG4gICAgICAgICAgICBjb25zdCBzZXJ2aWNlUGF0aCAgICAgPSBTLmNvbmZpZy5wcm9qZWN0UGF0aFxuICAgICAgICAgICAgY29uc3QgYnVpbGRDb25maWdQYXRoID0gcGF0aC5qb2luKHNlcnZpY2VQYXRoLCAnLi9zZXJ2ZXJsZXNzLmJ1aWxkLnltbCcpXG5cbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkQ29uZmlnID0gZnMuZXhpc3RzU3luYyhidWlsZENvbmZpZ1BhdGgpXG4gICAgICAgICAgICAgICAgPyBZYW1sLmxvYWQoIGZzLnJlYWRGaWxlU3luYyhidWlsZENvbmZpZ1BhdGgpIClcbiAgICAgICAgICAgICAgICA6IHt9XG5cbiAgICAgICAgICAgIHRoaXMuc2VydmVybGVzcyA9IHtcbiAgICAgICAgICAgICAgICBjb25maWc6IHsgc2VydmljZVBhdGg6IHNlcnZpY2VQYXRoIH0sXG4gICAgICAgICAgICAgICAgc2VydmljZTogeyBwYWNrYWdlOiB7fSB9LFxuICAgICAgICAgICAgICAgIGNsaTogU0NsaVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVGhlIGNvbmZpZyBpbmhlcml0cyBmcm9tIG11bHRpcGxlIHNvdXJjZXNcbiAgICAgICAgICAgIHRoaXMuY29uZmlnICAgID0ge1xuICAgICAgICAgICAgICAgIC4uLnRoaXMuY29uZmlnLFxuICAgICAgICAgICAgICAgIC4uLmJ1aWxkQ29uZmlnLFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgaW5pdChlKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0ID0gUy5nZXRQcm9qZWN0KClcblxuICAgICAgICAgICAgY29uc3QgeyBmdW5jdGlvbnMgfSA9IHByb2plY3RcblxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXJsZXNzLnNlcnZpY2Uuc2VydmljZSA9IHByb2plY3QubmFtZVxuXG4gICAgICAgICAgICBsZXQgc2VsZWN0ZWRGdW5jdGlvbnMgPSB0eXBlT2YuQXJyYXkocHJvamVjdC5nZXRGdW5jdGlvbihlLm9wdGlvbnMubmFtZSkpXG4gICAgICAgICAgICAgICAgPyBwcm9qZWN0LmdldEZ1bmN0aW9uKGUub3B0aW9ucy5uYW1lKVxuICAgICAgICAgICAgICAgIDogWyBwcm9qZWN0LmdldEZ1bmN0aW9uKGUub3B0aW9ucy5uYW1lKSBdXG5cblxuICAgICAgICAgICAgc2VsZWN0ZWRGdW5jdGlvbnMgPSBzZWxlY3RlZEZ1bmN0aW9ucy5maWx0ZXIoKGtleSkgPT4ga2V5IGluIGZ1bmN0aW9ucyApXG4gICAgICAgICAgICBzZWxlY3RlZEZ1bmN0aW9ucyA9IHNlbGVjdGVkRnVuY3Rpb25zLmxlbmd0aCA/IHNlbGVjdGVkRnVuY3Rpb25zIDogT2JqZWN0LmtleXMoZnVuY3Rpb25zKVxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqICBBbiBhcnJheSBvZiBmdWxsIHJlYWxpemVkIGZ1bmN0aW9ucyBjb25maWdzIHRvIGJ1aWxkIGFnYWluc3QuXG4gICAgICAgICAgICAgKiAgSW5oZXJpdHMgZnJvbVxuICAgICAgICAgICAgICogIC0gc2VydmVybGVzcy55bWwgZnVuY3Rpb25zLjxmbj4ucGFja2FnZVxuICAgICAgICAgICAgICogIC0gc2VydmVybGVzcy5idWlsZC55bWwgZnVuY3Rpb25zLjxmbj5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiAgdG8gZ2VuZXJhdGUgaW5jbHVkZXMsIGV4Y2x1ZGVzXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuZnVuY3Rpb25zID0gc2VsZWN0ZWRGdW5jdGlvbnMucmVkdWNlKChvYmosIGZuS2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZm5DZmcgICAgICA9IGZ1bmN0aW9uc1tmbktleV1cbiAgICAgICAgICAgICAgICBjb25zdCBmbkJ1aWxkQ2ZnID0gdGhpcy5jb25maWcuZnVuY3Rpb25zW2ZuS2V5XSB8fCB7fVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5jbHVkZSA9IFtcbiAgICAgICAgICAgICAgICAgICAgLi4uKCB0aGlzLmNvbmZpZy5pbmNsdWRlIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggKCBmbkNmZy5wYWNrYWdlICYmIGZuQ2ZnLnBhY2thZ2UuaW5jbHVkZSApIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggZm5CdWlsZENmZy5pbmNsdWRlIHx8IFtdIClcbiAgICAgICAgICAgICAgICBdXG5cbiAgICAgICAgICAgICAgICBjb25zdCBleGNsdWRlID0gW1xuICAgICAgICAgICAgICAgICAgICAuLi4oIHRoaXMuY29uZmlnLmJhc2VFeGNsdWRlIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggdGhpcy5jb25maWcuZXhjbHVkZSB8fCBbXSApLFxuICAgICAgICAgICAgICAgICAgICAuLi4oICggZm5DZmcucGFja2FnZSAmJiBmbkNmZy5wYWNrYWdlLmV4Y2x1ZGUgKSB8fCBbXSApLFxuICAgICAgICAgICAgICAgICAgICAuLi4oIGZuQnVpbGRDZmcuZXhjbHVkZSB8fCBbXSApXG4gICAgICAgICAgICAgICAgXVxuXG4gICAgICAgICAgICAgICAgLy8gVXRpbGl6ZSB0aGUgcHJvcG9zZWQgYHBhY2thZ2VgIGNvbmZpZ3VyYXRpb24gZm9yIGZ1bmN0aW9uc1xuICAgICAgICAgICAgICAgIG9ialtmbktleV0gPSB7XG4gICAgICAgICAgICAgICAgICAgIC4uLmZuQ2ZnLFxuXG4gICAgICAgICAgICAgICAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLiggZm5DZmcucGFja2FnZSB8fCB7fSApLFxuICAgICAgICAgICAgICAgICAgICAgICAgLi4uKCB0aGlzLmNvbmZpZy5mdW5jdGlvbnNbZm5LZXldIHx8IHt9ICksXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlLCBleGNsdWRlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqXG4gICAgICAgICAgICB9LCB7fSlcblxuICAgICAgICAgICAgLy8gY29uc29sZS5pbnNwZWN0KHsgb3B0aW9uczogdGhpcy5jb25maWcgfSlcbiAgICAgICAgICAgIC8vIGNvbnNvbGUuaW5zcGVjdCh7IGZ1bmN0aW9uczogdGhpcy5mdW5jdGlvbnMgfSlcblxuICAgICAgICAgICAgcmV0dXJuIGVcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIHJlZ2lzdGVyQWN0aW9ucygpIHtcbiAgICAgICAgICAgIFMuYWRkQWN0aW9uKHRoaXMuY29tcGxldGVBcnRpZmFjdC5iaW5kKHRoaXMpLCB7XG4gICAgICAgICAgICAgICAgaGFuZGxlcjogICAgICdidWlsZENvbXBsZXRlQXJ0aWZhY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQnVpbGRzIGFydGlmYWN0IGZvciBkZXBsb3ltZW50J1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgcmVnaXN0ZXJIb29rcygpIHtcbiAgICAgICAgICAgIFMuYWRkSG9vayh0aGlzLmluaXQuYmluZCh0aGlzKSwge1xuICAgICAgICAgICAgICAgIGFjdGlvbjogJ2Z1bmN0aW9uRGVwbG95JyxcbiAgICAgICAgICAgICAgICBldmVudDogJ3ByZSdcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBTLmFkZEhvb2sodGhpcy5idWlsZC5iaW5kKHRoaXMpLCB7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiAnY29kZURlcGxveUxhbWJkYScsXG4gICAgICAgICAgICAgICAgZXZlbnQ6ICdwcmUnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgYnVpbGQoZSkge1xuXG4gICAgICAgICAgICAvLyBUT0RPIGluIHRoZSBmdXR1cmU6XG4gICAgICAgICAgICAvLyAtIGNyZWF0ZSBzZXBlcmF0ZSB6aXBzXG4gICAgICAgICAgICAvLyAtIG1vZGlmeSBhcnRpZmFjdCBjb21wbGV0aW9uIHByb2Nlc3MsIHNwbGl0dGluZyBidWlsZHMgdXAgaW50byBzZXBlcmF0ZSBhcnRpZmFjdHNcblxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXJsZXNzLmNsaS5sb2coYFNlcnZlcmxlc3MgQnVpbGQgdHJpZ2dlcmVkIGZvciAke2Uub3B0aW9ucy5uYW1lfS4uLmApXG5cbiAgICAgICAgICAgIGNvbnN0IHsgbWV0aG9kIH0gPSB0aGlzLmNvbmZpZ1xuXG4gICAgICAgICAgICBsZXQgbW9kdWxlSW5jbHVkZXMgPSBbXVxuXG4gICAgICAgICAgICAvLyBTZXQgYnVpbGQgcGF0aHNcbiAgICAgICAgICAgIHRoaXMudG1wRGlyICAgICAgICAgPSBlLm9wdGlvbnMucGF0aERpc3RcbiAgICAgICAgICAgIHRoaXMuYnVpbGRUbXBEaXIgICAgPSBwYXRoLmpvaW4odGhpcy50bXBEaXIsICcuL2J1aWxkJylcbiAgICAgICAgICAgIHRoaXMuYXJ0aWZhY3RUbXBEaXIgPSBwYXRoLmpvaW4oZS5vcHRpb25zLnBhdGhEaXN0LCAnLi9hcnRpZmFjdHMnKVxuICAgICAgICAgICAgdGhpcy5kZXBsb3lUbXBEaXIgPSBwYXRoLmpvaW4oZS5vcHRpb25zLnBhdGhEaXN0LCAnLi9kZXBsb3knKVxuXG4gICAgICAgICAgICBhd2FpdCBmcy5lbnN1cmVEaXJBc3luYyh0aGlzLmJ1aWxkVG1wRGlyKVxuICAgICAgICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyQXN5bmModGhpcy5hcnRpZmFjdFRtcERpcilcblxuICAgICAgICAgICAgY29uc3QgYXJ0aWZhY3QgPSBuZXcgWWF6bC5aaXBGaWxlKClcblxuICAgICAgICAgICAgaWYgKCBtZXRob2QgPT09ICdidW5kbGUnICkge1xuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gU09VUkNFIEJVTkRMRVJcbiAgICAgICAgICAgICAgICAvL1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc291cmNlQnVuZGxlciA9IG5ldyBTb3VyY2VCdW5kbGVyKHtcbiAgICAgICAgICAgICAgICAgICAgLi4udGhpcy5jb25maWcsXG4gICAgICAgICAgICAgICAgICAgIHVnbGlmeSAgICAgIDogdGhpcy5jb25maWcudWdsaWZ5U291cmNlID8gdGhpcy5jb25maWcudWdsaWZ5IDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICBzZXJ2aWNlUGF0aCA6IFMuY29uZmlnLnByb2plY3RQYXRoXG4gICAgICAgICAgICAgICAgfSwgYXJ0aWZhY3QpXG5cbiAgICAgICAgICAgICAgICBmb3IgKCBjb25zdCBmbktleSBpbiB0aGlzLmZ1bmN0aW9ucyApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZuS2V5ID09PSBlLm9wdGlvbnMubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29uZmlnID0gdGhpcy5mdW5jdGlvbnNbZm5LZXldXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VydmVybGVzcy5jbGkubG9nKGBCdW5kbGluZyAke2ZuS2V5fS4uLmApXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN5bmNocm9ub3VzIGZvciBub3csIGJ1dCBjYW4gYmUgcGFyZWxsZWxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5wYWNrYWdlLmV4Y2x1ZGUucHVzaCgnX21ldGEnKVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzb3VyY2VCdW5kbGVyLmJ1bmRsZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhjbHVkZSA6IGNvbmZpZy5wYWNrYWdlLmV4Y2x1ZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZSA6IGNvbmZpZy5wYWNrYWdlLmluY2x1ZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICggbWV0aG9kID09PSAnZmlsZScgKSB7XG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBCVUlMRCBGSUxFXG4gICAgICAgICAgICAgICAgLy9cblxuICAgICAgICAgICAgICAgIC8vIFRoaXMgYnVpbGRzIGFsbCBmdW5jdGlvbnNcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlQnVpbGQgPSBhd2FpdCBuZXcgRmlsZUJ1aWxkKHtcbiAgICAgICAgICAgICAgICAgICAgLi4udGhpcy5jb25maWcsXG4gICAgICAgICAgICAgICAgICAgIHNlcnZpY2VQYXRoIDogUy5jb25maWcucHJvamVjdFBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkVG1wRGlyIDogdGhpcy5idWlsZFRtcERpcixcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb25zICAgOiB0aGlzLmZ1bmN0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgc2VydmVybGVzcyAgOiB0aGlzLnNlcnZlcmxlc3NcbiAgICAgICAgICAgICAgICB9LCBhcnRpZmFjdCkuYnVpbGQoKVxuXG4gICAgICAgICAgICAgICAgbW9kdWxlSW5jbHVkZXMgPSBbIC4uLmZpbGVCdWlsZC5leHRlcm5hbHMgXSAvLyBTcHJlYWQsIGZvciBhbiBpdGVyYXRvclxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIGJ1aWxkIG1ldGhvZCB1bmRlciBgY3VzdG9tLmJ1aWxkLm1ldGhvZGBcIilcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgbmV3IE1vZHVsZUJ1bmRsZXIoe1xuICAgICAgICAgICAgICAgIC4uLnRoaXMuY29uZmlnLFxuICAgICAgICAgICAgICAgIHVnbGlmeSAgICAgIDogdGhpcy5jb25maWcudWdsaWZ5TW9kdWxlcyA/IHRoaXMuY29uZmlnLnVnbGlmeSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBzZXJ2aWNlUGF0aCA6IFMuY29uZmlnLnByb2plY3RQYXRoXG4gICAgICAgICAgICB9LCBhcnRpZmFjdCkuYnVuZGxlKHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBtb2R1bGVJbmNsdWRlcyxcbiAgICAgICAgICAgICAgICBleGNsdWRlOiB0aGlzLmNvbmZpZy5leGNsdWRlZEV4dGVybmFsc1xuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgLy8gU2VydmVybGVzcyAwLjUgaGFjaywgcmVidWlsZCBhIF9zZXJ2ZXJsZXNzX2hhbmRsZXIuanMgZmlsZSB3aGlsZSBzdGlsbCBrZWVwaW5nIGVudiB2YXJzXG5cbiAgICAgICAgICAgIGNvbnN0IGZ1bmNPYmogPSBTLmdldFByb2plY3QoKS5nZXRGdW5jdGlvbihlLm9wdGlvbnMubmFtZSlcbiAgICAgICAgICAgIGNvbnN0IGZ1bmNQYXRoID0gcGF0aC5yZWxhdGl2ZShTLmNvbmZpZy5wcm9qZWN0UGF0aCwgZnVuY09iai5nZXRSb290UGF0aCgpKVxuXG4gICAgICAgICAgICBjb25zdCBbIGhhbmRsZXJGaWxlLCBoYW5kbGVyRnVuYyBdID0gdGhpcy5mdW5jdGlvbnNbZS5vcHRpb25zLm5hbWVdLmhhbmRsZXIuc3BsaXQoJy4nKVxuICAgICAgICAgICAgLy8gUmVhZCBleGlzdGluZyBoYW5kbGVyIGZyb20gZnNcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcmxlc3NIYW5kbGVyID0gZnMucmVhZEZpbGVTeW5jKGAke2Uub3B0aW9ucy5wYXRoRGlzdH0vX3NlcnZlcmxlc3NfaGFuZGxlci5qc2AsICd1dGY4JylcbiAgICAgICAgICAgIC8vLyBSZXBsYWNlIGV4cG9ydGVkIGhhbmRsZXIgd2l0aCBjb3JyZWN0IHBhdGggYXMgcGVyIGJ1aWxkIHByb2Nlc3NcbiAgICAgICAgICAgIGNvbnN0IG9sZEV4cG9ydCA9IHNlcnZlcmxlc3NIYW5kbGVyLm1hdGNoKC9leHBvcnRzXFwuaGFuZGxlciA9IHJlcXVpcmVcXChcIiguKilcIlxcKVxcW1wiKC4qKVwiXFxdOy9pbWcpWzBdXG4gICAgICAgICAgICBjb25zdCBuZXdFeHBvcnQgPSBgZXhwb3J0cy5oYW5kbGVyID0gcmVxdWlyZShcIi4vJHtmdW5jUGF0aH0vJHtoYW5kbGVyRmlsZX1cIilbXCIke2hhbmRsZXJGdW5jfVwiXWBcbiAgICAgICAgICAgIC8vIEFkZCBoYW5kbGVyIHRvIHppcFxuICAgICAgICAgICAgYXJ0aWZhY3QuYWRkQnVmZmVyKCBuZXcgQnVmZmVyKHNlcnZlcmxlc3NIYW5kbGVyLnJlcGxhY2Uob2xkRXhwb3J0LCBuZXdFeHBvcnQpKSwgJ19zZXJ2ZXJsZXNzX2hhbmRsZXIuanMnLCB0aGlzLmNvbmZpZy56aXAgKVxuXG4gICAgICAgICAgICBlLm9wdGlvbnMuYXJ0aWZhY3QgPSBhcnRpZmFjdFxuXG4gICAgICAgICAgICByZXR1cm4gUy5hY3Rpb25zLmJ1aWxkQ29tcGxldGVBcnRpZmFjdChlKVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgY29tcGxldGVBcnRpZmFjdChlKSB7XG4gICAgICAgICAgICB0aGlzLnNlcnZlcmxlc3MuY2xpLmxvZygnQ29tcGlsaW5nIGRlcGxveW1lbnQgYXJ0aWZhY3QnKVxuICAgICAgICAgICAgYXdhaXQgdGhpcy5fY29tcGxldGVBcnRpZmFjdCh7XG4gICAgICAgICAgICAgICAgYXJ0aWZhY3Q6IGUub3B0aW9ucy5hcnRpZmFjdCxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbk5hbWU6IGUub3B0aW9ucy5uYW1lLFxuICAgICAgICAgICAgICAgIGFydGlmYWN0VG1wRGlyOiBgJHtlLm9wdGlvbnMucGF0aERpc3R9L2FydGlmYWN0c2BcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIGNvbnN0IHppcFBhdGggPSB0aGlzLnNlcnZlcmxlc3Muc2VydmljZS5wYWNrYWdlLmFydGlmYWN0XG5cbiAgICAgICAgICAgIGNvbnN0IGRlcGxveVRtcERpciA9IHBhdGguam9pbihlLm9wdGlvbnMucGF0aERpc3QsICcuL2RlcGxveScpXG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuX3VucGFja1ppcCh7XG4gICAgICAgICAgICAgICAgemlwUGF0aCxcbiAgICAgICAgICAgICAgICBkZXBsb3lUbXBEaXJcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIGUub3B0aW9ucy5wYXRoRGlzdCA9IGRlcGxveVRtcERpclxuICAgICAgICAgICAgcmV0dXJuIGVcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIF91bnBhY2taaXAoeyB6aXBQYXRoLCBkZXBsb3lUbXBEaXIgfSkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBZYXV6bC5vcGVuKHppcFBhdGgsIHsgbGF6eUVudHJpZXM6IHRydWUgfSwgKGVyciwgemlwZmlsZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB0aHJvdyBlcnJcblxuICAgICAgICAgICAgICAgICAgICB6aXBmaWxlLnJlYWRFbnRyeSgpXG4gICAgICAgICAgICAgICAgICAgIHppcGZpbGUub24oXCJlbnRyeVwiLCBmdW5jdGlvbihlbnRyeSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKC9cXC8kLy50ZXN0KGVudHJ5LmZpbGVOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRpcmVjdG9yeSBmaWxlIG5hbWVzIGVuZCB3aXRoICcvJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1rZGlycChgJHtkZXBsb3lUbXBEaXJ9LyR7ZW50cnkuZmlsZU5hbWV9YCwgZnVuY3Rpb24obWtkaXJFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1rZGlyRXJyKSB0aHJvdyBta2RpckVyclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB6aXBmaWxlLnJlYWRFbnRyeSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmlsZSBlbnRyeVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHppcGZpbGUub3BlblJlYWRTdHJlYW0oZW50cnksIGZ1bmN0aW9uKHJzRXJyLCByZWFkU3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyc0VycikgdGhyb3cgcnNFcnJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIHBhcmVudCBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1rZGlycChwYXRoLmRpcm5hbWUoYCR7ZGVwbG95VG1wRGlyfS8ke2VudHJ5LmZpbGVOYW1lfWApLCBmdW5jdGlvbihta2RpckVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1rZGlyRXJyKSB0aHJvdyBta2RpckVyclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVhZFN0cmVhbS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKGAke2RlcGxveVRtcERpcn0vJHtlbnRyeS5maWxlTmFtZX1gKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYWRTdHJlYW0ub24oXCJlbmRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgemlwZmlsZS5yZWFkRW50cnkoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgIHppcGZpbGUub25jZShcImVuZFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHppcGZpbGUuY2xvc2UoKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgV3JpdGVzIHRoZSBgYXJ0aWZhY3RgIGFuZCBhdHRhY2hlcyBpdCB0byBzZXJ2ZXJsZXNzXG4gICAgICAgICAqL1xuICAgICAgICBhc3luYyBfY29tcGxldGVBcnRpZmFjdCh7IGFydGlmYWN0LCBmdW5jdGlvbk5hbWUsIGFydGlmYWN0VG1wRGlyIH0pIHtcbiAgICAgICAgICAgIC8vIFB1cmdlIGV4aXN0aW5nIGFydGlmYWN0c1xuICAgICAgICAgICAgaWYgKCAhIHRoaXMuY29uZmlnLmtlZXAgKVxuICAgICAgICAgICAgICAgIGF3YWl0IGZzLmVtcHR5RGlyQXN5bmMoYXJ0aWZhY3RUbXBEaXIpXG5cbiAgICAgICAgICAgIGNvbnN0IHppcFBhdGggPSBwYXRoLnJlc29sdmUoYXJ0aWZhY3RUbXBEaXIsIGAuLyR7dGhpcy5zZXJ2ZXJsZXNzLnNlcnZpY2Uuc2VydmljZX0tJHtmdW5jdGlvbk5hbWV9LSR7bmV3IERhdGUoKS5nZXRUaW1lKCl9LnppcGApXG5cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBhcnRpZmFjdC5vdXRwdXRTdHJlYW0ucGlwZSggZnMuY3JlYXRlV3JpdGVTdHJlYW0oemlwUGF0aCkgKVxuICAgICAgICAgICAgICAgIC5vbihcImVycm9yXCIsIHJlamVjdClcbiAgICAgICAgICAgICAgICAub24oXCJjbG9zZVwiLCByZXNvbHZlKVxuXG4gICAgICAgICAgICAgICAgYXJ0aWZhY3QuZW5kKClcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIHRoaXMuc2VydmVybGVzcy5zZXJ2aWNlLnBhY2thZ2UuYXJ0aWZhY3QgPSB6aXBQYXRoXG5cbiAgICAgICAgICAgIC8vIFB1cmdlIGJ1aWxkIGRpclxuICAgICAgICAgICAgaWYgKCAhIHRoaXMuY29uZmlnLmtlZXAgKVxuICAgICAgICAgICAgICAgIGF3YWl0IGZzLmVtcHR5RGlyQXN5bmModGhpcy5idWlsZFRtcERpcilcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgcmV0dXJuIFNlcnZlcmxlc3NCdWlsZFBsdWdpblxufVxuIl19