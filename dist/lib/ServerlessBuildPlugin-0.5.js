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
                    exclude: ['aws-sdk'], // These match root dependencies
                    deepExclude: ['aws-sdk'] },

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

                const funcObj = S.getProject().getFunction(e.options.name);
                const funcPath = _path2.default.relative(S.config.projectPath, funcObj.getRootPath());

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

                            // If no includes are specified for function, then default to using the function folder
                            if (config.package.include.length < 1) {
                                config.package.include.push(`${ funcPath }/**`);
                            }

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
                    exclude: moduleExcludes,
                    deepExclude: _this4.config.modules.deepExclude
                });

                // Serverless 0.5 hack, rebuild a _serverless_handler.js file while still keeping env vars

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvU2VydmVybGVzc0J1aWxkUGx1Z2luLTAuNS5qcyJdLCJuYW1lcyI6WyJTIiwiU0NsaSIsInJlcXVpcmUiLCJnZXRTZXJ2ZXJsZXNzUGF0aCIsIlNlcnZlcmxlc3NCdWlsZFBsdWdpbiIsImNsYXNzZXMiLCJQbHVnaW4iLCJjb25zdHJ1Y3RvciIsImNvbmZpZyIsInRyeUZpbGVzIiwiYmFzZUV4Y2x1ZGUiLCJtb2R1bGVzIiwiZXhjbHVkZSIsImRlZXBFeGNsdWRlIiwiaW5jbHVkZSIsInVnbGlmeSIsInVnbGlmeVNvdXJjZSIsInVnbGlmeU1vZHVsZXMiLCJiYWJlbCIsInNvdXJjZU1hcHMiLCJ6aXAiLCJjb21wcmVzcyIsIm1ldGhvZCIsImZpbGUiLCJmdW5jdGlvbnMiLCJuYW1lIiwic2VydmljZVBhdGgiLCJwcm9qZWN0UGF0aCIsImJ1aWxkQ29uZmlnUGF0aCIsImpvaW4iLCJidWlsZENvbmZpZyIsImV4aXN0c1N5bmMiLCJsb2FkIiwicmVhZEZpbGVTeW5jIiwic2VydmVybGVzcyIsInNlcnZpY2UiLCJwYWNrYWdlIiwiY2xpIiwiaW5pdCIsImUiLCJwcm9qZWN0IiwiZ2V0UHJvamVjdCIsInNlbGVjdGVkRnVuY3Rpb25zIiwiQXJyYXkiLCJnZXRGdW5jdGlvbiIsIm9wdGlvbnMiLCJmaWx0ZXIiLCJrZXkiLCJsZW5ndGgiLCJPYmplY3QiLCJrZXlzIiwicmVkdWNlIiwib2JqIiwiZm5LZXkiLCJmbkNmZyIsImZuQnVpbGRDZmciLCJyZWdpc3RlckFjdGlvbnMiLCJhZGRBY3Rpb24iLCJjb21wbGV0ZUFydGlmYWN0IiwiYmluZCIsImhhbmRsZXIiLCJkZXNjcmlwdGlvbiIsInJlZ2lzdGVySG9va3MiLCJhZGRIb29rIiwiYWN0aW9uIiwiZXZlbnQiLCJidWlsZCIsImxvZyIsIm1vZHVsZUluY2x1ZGVzIiwibW9kdWxlRXhjbHVkZXMiLCJmdW5jT2JqIiwiZnVuY1BhdGgiLCJyZWxhdGl2ZSIsImdldFJvb3RQYXRoIiwidG1wRGlyIiwicGF0aERpc3QiLCJidWlsZFRtcERpciIsImFydGlmYWN0VG1wRGlyIiwiZGVwbG95VG1wRGlyIiwiZW5zdXJlRGlyQXN5bmMiLCJhcnRpZmFjdCIsIlppcEZpbGUiLCJzb3VyY2VCdW5kbGVyIiwidW5kZWZpbmVkIiwicHVzaCIsImJ1bmRsZSIsImZpbGVCdWlsZCIsImV4dGVybmFscyIsIkVycm9yIiwiZnVuY01vZHVsZUV4Y2x1ZGVzIiwic3BsaXQiLCJoYW5kbGVyRmlsZSIsImhhbmRsZXJGdW5jIiwic2VydmVybGVzc0hhbmRsZXIiLCJvbGRFeHBvcnQiLCJtYXRjaCIsIm5ld0V4cG9ydCIsImFkZEJ1ZmZlciIsIkJ1ZmZlciIsInJlcGxhY2UiLCJhY3Rpb25zIiwiYnVpbGRDb21wbGV0ZUFydGlmYWN0IiwiX2NvbXBsZXRlQXJ0aWZhY3QiLCJmdW5jdGlvbk5hbWUiLCJ6aXBQYXRoIiwiX3VucGFja1ppcCIsInJlc29sdmUiLCJyZWplY3QiLCJvcGVuIiwibGF6eUVudHJpZXMiLCJlcnIiLCJ6aXBmaWxlIiwicmVhZEVudHJ5Iiwib24iLCJlbnRyeSIsInRlc3QiLCJmaWxlTmFtZSIsIm1rZGlyRXJyIiwib3BlblJlYWRTdHJlYW0iLCJyc0VyciIsInJlYWRTdHJlYW0iLCJkaXJuYW1lIiwicGlwZSIsImNyZWF0ZVdyaXRlU3RyZWFtIiwib25jZSIsImNsb3NlIiwia2VlcCIsImVtcHR5RGlyQXN5bmMiLCJEYXRlIiwiZ2V0VGltZSIsIm91dHB1dFN0cmVhbSIsImVuZCIsInByb21pc2lmeUFsbCIsImNvbnNvbGUiLCJpbnNwZWN0IiwidmFsIiwiYXJncyIsImRlcHRoIiwiY29sb3JzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztrQkFrQmUsVUFBVUEsQ0FBVixFQUFhO0FBQ3hCLFVBQU1DLE9BQU9DLFFBQVFGLEVBQUVHLGlCQUFGLENBQW9CLFdBQXBCLENBQVIsQ0FBYixDQUR3QixDQUNnQzs7QUFFeEQsVUFBTUMscUJBQU4sU0FBb0NKLEVBQUVLLE9BQUYsQ0FBVUMsTUFBOUMsQ0FBcUQ7O0FBK0JqRDs7O0FBR0FDLHNCQUFjO0FBQ1Y7QUFDQTtBQUNBOztBQUVBO0FBTFUsaUJBL0JkQyxNQStCYyxHQS9CTDtBQUNMQywwQkFBYyxDQUFFLG1CQUFGLENBRFQ7QUFFTEMsNkJBQWMsQ0FBRSxrQkFBRixDQUZUOztBQUlMQyx5QkFBUztBQUNMQyw2QkFBYyxDQUFFLFNBQUYsQ0FEVCxFQUN3QjtBQUM3QkMsaUNBQWMsQ0FBRSxTQUFGLENBRlQsRUFKSjs7QUFTTEQseUJBQVUsRUFUTDtBQVVMRSx5QkFBVSxFQVZMOztBQVlMQyx3QkFBZ0IsSUFaWDtBQWFMQyw4QkFBZ0IsS0FiWDtBQWNMQywrQkFBZ0IsSUFkWDs7QUFnQkxDLHVCQUFhLElBaEJSO0FBaUJMQyw0QkFBYSxJQWpCUjs7QUFtQkw7QUFDQUMscUJBQUssRUFBRUMsVUFBVSxJQUFaLEVBcEJBOztBQXNCTEMsd0JBQVMsUUF0Qko7QUF1QkxDLHNCQUFTLElBdkJKOztBQXlCTEMsMkJBQVc7QUF6Qk4sYUErQks7QUFNVixpQkFBS0MsSUFBTCxHQUFZLHVCQUFaOztBQUVBOztBQUVBLGtCQUFNQyxjQUFrQjFCLEVBQUVRLE1BQUYsQ0FBU21CLFdBQWpDO0FBQ0Esa0JBQU1DLGtCQUFrQixlQUFLQyxJQUFMLENBQVVILFdBQVYsRUFBdUIsd0JBQXZCLENBQXhCOztBQUVBLGtCQUFNSSxjQUFjLGtCQUFHQyxVQUFILENBQWNILGVBQWQsSUFDZCxpQkFBS0ksSUFBTCxDQUFXLGtCQUFHQyxZQUFILENBQWdCTCxlQUFoQixDQUFYLENBRGMsR0FFZCxFQUZOOztBQUlBLGlCQUFLTSxVQUFMLEdBQWtCO0FBQ2QxQix3QkFBUSxFQUFFa0IsYUFBYUEsV0FBZixFQURNO0FBRWRTLHlCQUFTLEVBQUVDLFNBQVMsRUFBWCxFQUZLO0FBR2RDLHFCQUFLcEM7QUFIUyxhQUFsQjtBQUtBO0FBQ0EsaUJBQUtPLE1BQUwsZ0JBQ08sS0FBS0EsTUFEWixFQUVPc0IsV0FGUDtBQUlIOztBQUVLUSxZQUFOLENBQVdDLENBQVgsRUFBYztBQUFBOztBQUFBO0FBQ1Ysc0JBQU1DLFVBQVV4QyxFQUFFeUMsVUFBRixFQUFoQjs7QUFEVSxzQkFHRmpCLFNBSEUsR0FHWWdCLE9BSFosQ0FHRmhCLFNBSEU7OztBQUtWLHNCQUFLVSxVQUFMLENBQWdCQyxPQUFoQixDQUF3QkEsT0FBeEIsR0FBa0NLLFFBQVFmLElBQTFDOztBQUVBLG9CQUFJaUIsb0JBQW9CLGVBQU9DLEtBQVAsQ0FBYUgsUUFBUUksV0FBUixDQUFvQkwsRUFBRU0sT0FBRixDQUFVcEIsSUFBOUIsQ0FBYixJQUNsQmUsUUFBUUksV0FBUixDQUFvQkwsRUFBRU0sT0FBRixDQUFVcEIsSUFBOUIsQ0FEa0IsR0FFbEIsQ0FBRWUsUUFBUUksV0FBUixDQUFvQkwsRUFBRU0sT0FBRixDQUFVcEIsSUFBOUIsQ0FBRixDQUZOOztBQUtBaUIsb0NBQW9CQSxrQkFBa0JJLE1BQWxCLENBQXlCLFVBQUNDLEdBQUQ7QUFBQSwyQkFBU0EsT0FBT3ZCLFNBQWhCO0FBQUEsaUJBQXpCLENBQXBCO0FBQ0FrQixvQ0FBb0JBLGtCQUFrQk0sTUFBbEIsR0FBMkJOLGlCQUEzQixHQUErQ08sT0FBT0MsSUFBUCxDQUFZMUIsU0FBWixDQUFuRTs7QUFFQTs7Ozs7Ozs7QUFRQSxzQkFBS0EsU0FBTCxHQUFpQmtCLGtCQUFrQlMsTUFBbEIsQ0FBeUIsVUFBQ0MsR0FBRCxFQUFNQyxLQUFOLEVBQWdCO0FBQ3RELDBCQUFNQyxRQUFhOUIsVUFBVTZCLEtBQVYsQ0FBbkI7QUFDQSwwQkFBTUUsYUFBYSxNQUFLL0MsTUFBTCxDQUFZZ0IsU0FBWixDQUFzQjZCLEtBQXRCLEtBQWdDLEVBQW5EOztBQUVBLDBCQUFNdkMsdUNBQ0csTUFBS04sTUFBTCxDQUFZTSxPQUFaLElBQXVCLEVBRDFCLHNCQUVLd0MsTUFBTWxCLE9BQU4sSUFBaUJrQixNQUFNbEIsT0FBTixDQUFjdEIsT0FBakMsSUFBOEMsRUFGakQsc0JBR0d5QyxXQUFXekMsT0FBWCxJQUFzQixFQUh6QixFQUFOOztBQU1BLDBCQUFNRix1Q0FDRyxNQUFLSixNQUFMLENBQVlFLFdBQVosSUFBMkIsRUFEOUIsc0JBRUcsTUFBS0YsTUFBTCxDQUFZSSxPQUFaLElBQXVCLEVBRjFCLHNCQUdLMEMsTUFBTWxCLE9BQU4sSUFBaUJrQixNQUFNbEIsT0FBTixDQUFjeEIsT0FBakMsSUFBOEMsRUFIakQsc0JBSUcyQyxXQUFXM0MsT0FBWCxJQUFzQixFQUp6QixFQUFOOztBQU9BO0FBQ0F3Qyx3QkFBSUMsS0FBSixpQkFDT0MsS0FEUDs7QUFHSWxCLDhDQUNTa0IsTUFBTWxCLE9BQU4sSUFBaUIsRUFEMUIsRUFFUyxNQUFLNUIsTUFBTCxDQUFZZ0IsU0FBWixDQUFzQjZCLEtBQXRCLEtBQWdDLEVBRnpDO0FBR0l2Qyw0Q0FISixFQUdhRjtBQUhiO0FBSEo7O0FBVUEsMkJBQU93QyxHQUFQO0FBQ0gsaUJBN0JnQixFQTZCZCxFQTdCYyxDQUFqQjs7QUErQkE7QUFDQTs7QUFFQSx1QkFBT2IsQ0FBUDtBQXpEVTtBQTBEYjs7QUFFS2lCLHVCQUFOLEdBQXdCO0FBQUE7O0FBQUE7QUFDcEJ4RCxrQkFBRXlELFNBQUYsQ0FBWSxPQUFLQyxnQkFBTCxDQUFzQkMsSUFBdEIsUUFBWixFQUE4QztBQUMxQ0MsNkJBQWEsdUJBRDZCO0FBRTFDQyxpQ0FBYTtBQUY2QixpQkFBOUM7QUFJQTtBQUxvQjtBQU12Qjs7QUFFS0MscUJBQU4sR0FBc0I7QUFBQTs7QUFBQTtBQUNsQjlELGtCQUFFK0QsT0FBRixDQUFVLE9BQUt6QixJQUFMLENBQVVxQixJQUFWLFFBQVYsRUFBZ0M7QUFDNUJLLDRCQUFRLGdCQURvQjtBQUU1QkMsMkJBQU87QUFGcUIsaUJBQWhDO0FBSUFqRSxrQkFBRStELE9BQUYsQ0FBVSxPQUFLRyxLQUFMLENBQVdQLElBQVgsUUFBVixFQUFpQztBQUM3QkssNEJBQVEsa0JBRHFCO0FBRTdCQywyQkFBTztBQUZzQixpQkFBakM7QUFJQTtBQVRrQjtBQVVyQjs7QUFFS0MsYUFBTixDQUFZM0IsQ0FBWixFQUFlO0FBQUE7O0FBQUE7O0FBRVg7QUFDQTtBQUNBOztBQUVBLHVCQUFLTCxVQUFMLENBQWdCRyxHQUFoQixDQUFvQjhCLEdBQXBCLENBQXlCLG1DQUFpQzVCLEVBQUVNLE9BQUYsQ0FBVXBCLElBQUssTUFBekU7O0FBTlcsc0JBUUhILE1BUkcsR0FRVSxPQUFLZCxNQVJmLENBUUhjLE1BUkc7O0FBU1gsb0JBQUk4QyxpQkFBaUIsRUFBckI7QUFDQSxvQkFBSUMsaUJBQWlCLEVBQXJCOztBQUVBLHNCQUFNQyxVQUFVdEUsRUFBRXlDLFVBQUYsR0FBZUcsV0FBZixDQUEyQkwsRUFBRU0sT0FBRixDQUFVcEIsSUFBckMsQ0FBaEI7QUFDQSxzQkFBTThDLFdBQVcsZUFBS0MsUUFBTCxDQUFjeEUsRUFBRVEsTUFBRixDQUFTbUIsV0FBdkIsRUFBb0MyQyxRQUFRRyxXQUFSLEVBQXBDLENBQWpCOztBQUVBO0FBQ0EsdUJBQUtDLE1BQUwsR0FBc0JuQyxFQUFFTSxPQUFGLENBQVU4QixRQUFoQztBQUNBLHVCQUFLQyxXQUFMLEdBQXNCLGVBQUsvQyxJQUFMLENBQVUsT0FBSzZDLE1BQWYsRUFBdUIsU0FBdkIsQ0FBdEI7QUFDQSx1QkFBS0csY0FBTCxHQUFzQixlQUFLaEQsSUFBTCxDQUFVVSxFQUFFTSxPQUFGLENBQVU4QixRQUFwQixFQUE4QixhQUE5QixDQUF0QjtBQUNBLHVCQUFLRyxZQUFMLEdBQXNCLGVBQUtqRCxJQUFMLENBQVVVLEVBQUVNLE9BQUYsQ0FBVThCLFFBQXBCLEVBQThCLFVBQTlCLENBQXRCOztBQUVBLHNCQUFNLGtCQUFHSSxjQUFILENBQWtCLE9BQUtILFdBQXZCLENBQU47QUFDQSxzQkFBTSxrQkFBR0csY0FBSCxDQUFrQixPQUFLRixjQUF2QixDQUFOOztBQUVBLHNCQUFNRyxXQUFXLElBQUksZUFBS0MsT0FBVCxFQUFqQjs7QUFFQSxvQkFBSzNELFdBQVcsUUFBaEIsRUFBMkI7QUFDdkI7QUFDQTtBQUNBOztBQUVBLDBCQUFNNEQsZ0JBQWdCLHlDQUNmLE9BQUsxRSxNQURVO0FBRWxCTyxnQ0FBYyxPQUFLUCxNQUFMLENBQVlRLFlBQVosR0FBMkIsT0FBS1IsTUFBTCxDQUFZTyxNQUF2QyxHQUFnRG9FLFNBRjVDO0FBR2xCekQscUNBQWMxQixFQUFFUSxNQUFGLENBQVNtQjtBQUhMLHdCQUluQnFELFFBSm1CLENBQXRCOztBQU1BLHlCQUFNLE1BQU0zQixLQUFaLElBQXFCLE9BQUs3QixTQUExQixFQUFzQztBQUNsQyw0QkFBSTZCLFVBQVVkLEVBQUVNLE9BQUYsQ0FBVXBCLElBQXhCLEVBQThCO0FBQzFCLGtDQUFNakIsU0FBUyxPQUFLZ0IsU0FBTCxDQUFlNkIsS0FBZixDQUFmOztBQUVBLG1DQUFLbkIsVUFBTCxDQUFnQkcsR0FBaEIsQ0FBb0I4QixHQUFwQixDQUF5QixhQUFXZCxLQUFNLE1BQTFDOztBQUVBO0FBQ0E3QyxtQ0FBTzRCLE9BQVAsQ0FBZXhCLE9BQWYsQ0FBdUJ3RSxJQUF2QixDQUE0QixPQUE1Qjs7QUFFQTtBQUNBLGdDQUFJNUUsT0FBTzRCLE9BQVAsQ0FBZXRCLE9BQWYsQ0FBdUJrQyxNQUF2QixHQUFnQyxDQUFwQyxFQUF1QztBQUNuQ3hDLHVDQUFPNEIsT0FBUCxDQUFldEIsT0FBZixDQUF1QnNFLElBQXZCLENBQTZCLElBQUViLFFBQVMsTUFBeEM7QUFDSDs7QUFFRCxrQ0FBTVcsY0FBY0csTUFBZCxDQUFxQjtBQUN2QnpFLHlDQUFVSixPQUFPNEIsT0FBUCxDQUFleEIsT0FERjtBQUV2QkUseUNBQVVOLE9BQU80QixPQUFQLENBQWV0QjtBQUZGLDZCQUFyQixDQUFOO0FBSUg7QUFDSjtBQUNKLGlCQS9CRCxNQStCTyxJQUFLUSxXQUFXLE1BQWhCLEVBQXlCO0FBQzVCO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDBCQUFNZ0UsWUFBWSxNQUFNLHFDQUNqQixPQUFLOUUsTUFEWTtBQUVwQmtCLHFDQUFjMUIsRUFBRVEsTUFBRixDQUFTbUIsV0FGSDtBQUdwQmlELHFDQUFjLE9BQUtBLFdBSEM7QUFJcEJwRCxtQ0FBYyxPQUFLQSxTQUpDO0FBS3BCVSxvQ0FBYyxPQUFLQTtBQUxDLHdCQU1yQjhDLFFBTnFCLEVBTVhkLEtBTlcsRUFBeEI7O0FBUUFFLGtFQUFzQmtCLFVBQVVDLFNBQWhDLEdBZDRCLENBY2dCO0FBQy9DLGlCQWZNLE1BZUE7QUFDSCwwQkFBTSxJQUFJQyxLQUFKLENBQVUsa0RBQVYsQ0FBTjtBQUNIOztBQUVELG9CQUFJQyxxQkFBcUIsRUFBekI7QUFDQSxvQkFBSSxPQUFLakUsU0FBTCxDQUFlZSxFQUFFTSxPQUFGLENBQVVwQixJQUF6QixFQUErQlcsT0FBL0IsQ0FBdUN6QixPQUEzQyxFQUFvRDtBQUNoRDhFLHlDQUFxQixPQUFLakUsU0FBTCxDQUFlZSxFQUFFTSxPQUFGLENBQVVwQixJQUF6QixFQUErQlcsT0FBL0IsQ0FBdUN6QixPQUF2QyxDQUErQ0MsT0FBL0MsSUFBMEQsRUFBL0U7QUFDSDs7QUFFRHlELDhEQUFzQixPQUFLN0QsTUFBTCxDQUFZRyxPQUFaLENBQW9CQyxPQUExQyxzQkFBc0Q2RSxrQkFBdEQ7O0FBRUEsc0JBQU0seUNBQ0MsT0FBS2pGLE1BRE47QUFFRk8sNEJBQWMsT0FBS1AsTUFBTCxDQUFZUyxhQUFaLEdBQTRCLE9BQUtULE1BQUwsQ0FBWU8sTUFBeEMsR0FBaURvRSxTQUY3RDtBQUdGekQsaUNBQWMxQixFQUFFUSxNQUFGLENBQVNtQjtBQUhyQixvQkFJSHFELFFBSkcsRUFJT0ssTUFKUCxDQUljO0FBQ2hCdkUsNkJBQVNzRCxjQURPO0FBRWhCeEQsNkJBQVN5RCxjQUZPO0FBR2hCeEQsaUNBQWEsT0FBS0wsTUFBTCxDQUFZRyxPQUFaLENBQW9CRTtBQUhqQixpQkFKZCxDQUFOOztBQVVBOztBQTdGVyw0Q0ErRjBCLE9BQUtXLFNBQUwsQ0FBZWUsRUFBRU0sT0FBRixDQUFVcEIsSUFBekIsRUFBK0JtQyxPQUEvQixDQUF1QzhCLEtBQXZDLENBQTZDLEdBQTdDLENBL0YxQjs7QUFBQTs7QUFBQSxzQkErRkhDLFdBL0ZHO0FBQUEsc0JBK0ZVQyxXQS9GVjtBQWdHWDs7QUFDQSxzQkFBTUMsb0JBQW9CLGtCQUFHNUQsWUFBSCxDQUFpQixJQUFFTSxFQUFFTSxPQUFGLENBQVU4QixRQUFTLDBCQUF0QyxFQUFnRSxNQUFoRSxDQUExQjtBQUNBO0FBQ0Esc0JBQU1tQixZQUFZRCxrQkFBa0JFLEtBQWxCLENBQXdCLG9EQUF4QixFQUE4RSxDQUE5RSxDQUFsQjtBQUNBLHNCQUFNQyxZQUFhLGlDQUErQnpCLFFBQVMsTUFBR29CLFdBQVksU0FBTUMsV0FBWSxLQUE1RjtBQUNBO0FBQ0FaLHlCQUFTaUIsU0FBVCxDQUFvQixJQUFJQyxNQUFKLENBQVdMLGtCQUFrQk0sT0FBbEIsQ0FBMEJMLFNBQTFCLEVBQXFDRSxTQUFyQyxDQUFYLENBQXBCLEVBQWlGLHdCQUFqRixFQUEyRyxPQUFLeEYsTUFBTCxDQUFZWSxHQUF2SDs7QUFFQW1CLGtCQUFFTSxPQUFGLENBQVVtQyxRQUFWLEdBQXFCQSxRQUFyQjs7QUFFQSx1QkFBT2hGLEVBQUVvRyxPQUFGLENBQVVDLHFCQUFWLENBQWdDOUQsQ0FBaEMsQ0FBUDtBQTFHVztBQTJHZDs7QUFFS21CLHdCQUFOLENBQXVCbkIsQ0FBdkIsRUFBMEI7QUFBQTs7QUFBQTtBQUN0Qix1QkFBS0wsVUFBTCxDQUFnQkcsR0FBaEIsQ0FBb0I4QixHQUFwQixDQUF3QiwrQkFBeEI7QUFDQSxzQkFBTSxPQUFLbUMsaUJBQUwsQ0FBdUI7QUFDekJ0Qiw4QkFBVXpDLEVBQUVNLE9BQUYsQ0FBVW1DLFFBREs7QUFFekJ1QixrQ0FBY2hFLEVBQUVNLE9BQUYsQ0FBVXBCLElBRkM7QUFHekJvRCxvQ0FBaUIsSUFBRXRDLEVBQUVNLE9BQUYsQ0FBVThCLFFBQVM7QUFIYixpQkFBdkIsQ0FBTjs7QUFNQSxzQkFBTTZCLFVBQVUsT0FBS3RFLFVBQUwsQ0FBZ0JDLE9BQWhCLENBQXdCQyxPQUF4QixDQUFnQzRDLFFBQWhEOztBQUVBLHNCQUFNRixlQUFlLGVBQUtqRCxJQUFMLENBQVVVLEVBQUVNLE9BQUYsQ0FBVThCLFFBQXBCLEVBQThCLFVBQTlCLENBQXJCOztBQUVBLHNCQUFNLE9BQUs4QixVQUFMLENBQWdCO0FBQ2xCRCxvQ0FEa0I7QUFFbEIxQjtBQUZrQixpQkFBaEIsQ0FBTjs7QUFLQXZDLGtCQUFFTSxPQUFGLENBQVU4QixRQUFWLEdBQXFCRyxZQUFyQjtBQUNBLHVCQUFPdkMsQ0FBUDtBQWxCc0I7QUFtQnpCOztBQUVLa0Usa0JBQU4sT0FBNEM7QUFBQSxnQkFBekJELE9BQXlCLFFBQXpCQSxPQUF5QjtBQUFBLGdCQUFoQjFCLFlBQWdCLFFBQWhCQSxZQUFnQjtBQUFBO0FBQ3hDLHVCQUFPLE1BQU0sdUJBQVksVUFBQzRCLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtBQUMxQyxvQ0FBTUMsSUFBTixDQUFXSixPQUFYLEVBQW9CLEVBQUVLLGFBQWEsSUFBZixFQUFwQixFQUEyQyxVQUFDQyxHQUFELEVBQU1DLE9BQU4sRUFBa0I7QUFDekQsNEJBQUlELEdBQUosRUFBUyxNQUFNQSxHQUFOOztBQUVUQyxnQ0FBUUMsU0FBUjtBQUNBRCxnQ0FBUUUsRUFBUixDQUFXLE9BQVgsRUFBb0IsVUFBU0MsS0FBVCxFQUFnQjtBQUNoQyxnQ0FBSSxNQUFNQyxJQUFOLENBQVdELE1BQU1FLFFBQWpCLENBQUosRUFBZ0M7QUFDNUI7QUFDQSxzREFBUSxJQUFFdEMsWUFBYSxNQUFHb0MsTUFBTUUsUUFBUyxHQUF6QyxFQUE0QyxVQUFTQyxRQUFULEVBQW1CO0FBQzNELHdDQUFJQSxRQUFKLEVBQWMsTUFBTUEsUUFBTjtBQUNkTiw0Q0FBUUMsU0FBUjtBQUNILGlDQUhEO0FBSUgsNkJBTkQsTUFNTztBQUNIO0FBQ0FELHdDQUFRTyxjQUFSLENBQXVCSixLQUF2QixFQUE4QixVQUFTSyxLQUFULEVBQWdCQyxVQUFoQixFQUE0QjtBQUN0RCx3Q0FBSUQsS0FBSixFQUFXLE1BQU1BLEtBQU47QUFDWDtBQUNBLDBEQUFPLGVBQUtFLE9BQUwsQ0FBYyxJQUFFM0MsWUFBYSxNQUFHb0MsTUFBTUUsUUFBUyxHQUEvQyxDQUFQLEVBQTBELFVBQVNDLFFBQVQsRUFBbUI7QUFDekUsNENBQUlBLFFBQUosRUFBYyxNQUFNQSxRQUFOO0FBQ2RHLG1EQUFXRSxJQUFYLENBQWdCLGtCQUFHQyxpQkFBSCxDQUFzQixJQUFFN0MsWUFBYSxNQUFHb0MsTUFBTUUsUUFBUyxHQUF2RCxDQUFoQjtBQUNBSSxtREFBV1AsRUFBWCxDQUFjLEtBQWQsRUFBcUIsWUFBVztBQUM1QkYsb0RBQVFDLFNBQVI7QUFDSCx5Q0FGRDtBQUdILHFDQU5EO0FBT0gsaUNBVkQ7QUFXSDtBQUNKLHlCQXJCRDs7QUF1QkFELGdDQUFRYSxJQUFSLENBQWEsS0FBYixFQUFvQixZQUFXO0FBQzNCYixvQ0FBUWMsS0FBUjtBQUNBbkI7QUFDSCx5QkFIRDtBQUlILHFCQS9CRDtBQWdDSCxpQkFqQ1ksQ0FBYjtBQUR3QztBQW1DM0M7O0FBR0Q7OztBQUdNSix5QkFBTixRQUFvRTtBQUFBOztBQUFBLGdCQUExQ3RCLFFBQTBDLFNBQTFDQSxRQUEwQztBQUFBLGdCQUFoQ3VCLFlBQWdDLFNBQWhDQSxZQUFnQztBQUFBLGdCQUFsQjFCLGNBQWtCLFNBQWxCQSxjQUFrQjtBQUFBO0FBQ2hFO0FBQ0Esb0JBQUssQ0FBRSxPQUFLckUsTUFBTCxDQUFZc0gsSUFBbkIsRUFDSSxNQUFNLGtCQUFHQyxhQUFILENBQWlCbEQsY0FBakIsQ0FBTjs7QUFFSixzQkFBTTJCLFVBQVUsZUFBS0UsT0FBTCxDQUFhN0IsY0FBYixFQUE4QixNQUFJLE9BQUszQyxVQUFMLENBQWdCQyxPQUFoQixDQUF3QkEsT0FBUSxNQUFHb0UsWUFBYSxNQUFHLElBQUl5QixJQUFKLEdBQVdDLE9BQVgsRUFBcUIsT0FBMUcsQ0FBaEI7O0FBRUEsc0JBQU0sdUJBQVksVUFBQ3ZCLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtBQUNuQzNCLDZCQUFTa0QsWUFBVCxDQUFzQlIsSUFBdEIsQ0FBNEIsa0JBQUdDLGlCQUFILENBQXFCbkIsT0FBckIsQ0FBNUIsRUFDQ1MsRUFERCxDQUNJLE9BREosRUFDYU4sTUFEYixFQUVDTSxFQUZELENBRUksT0FGSixFQUVhUCxPQUZiOztBQUlBMUIsNkJBQVNtRCxHQUFUO0FBQ0gsaUJBTkssQ0FBTjs7QUFRQSx1QkFBS2pHLFVBQUwsQ0FBZ0JDLE9BQWhCLENBQXdCQyxPQUF4QixDQUFnQzRDLFFBQWhDLEdBQTJDd0IsT0FBM0M7O0FBRUE7QUFDQSxvQkFBSyxDQUFFLE9BQUtoRyxNQUFMLENBQVlzSCxJQUFuQixFQUNJLE1BQU0sa0JBQUdDLGFBQUgsQ0FBaUIsT0FBS25ELFdBQXRCLENBQU47QUFuQjREO0FBb0JuRTs7QUE5VWdEOztBQWtWckQsV0FBT3hFLHFCQUFQO0FBQ0gsQzs7QUF2V0Q7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7OztBQUVBLG1CQUFRZ0ksWUFBUjs7QUFFQTtBQUNBQyxRQUFRQyxPQUFSLEdBQWtCLFVBQUNDLEdBQUQ7QUFBQSxzQ0FBU0MsSUFBVDtBQUFTQSxZQUFUO0FBQUE7O0FBQUEsV0FBa0JILFFBQVFsRSxHQUFSLENBQWFqRSxRQUFRLE1BQVIsRUFBZ0JvSSxPQUFoQixDQUF3QkMsR0FBeEIsYUFBK0JFLE9BQU8sQ0FBdEMsRUFBeUNDLFFBQVEsSUFBakQsSUFBMERGLElBQTFELEVBQWIsQ0FBbEI7QUFBQSxDQUFsQiIsImZpbGUiOiJTZXJ2ZXJsZXNzQnVpbGRQbHVnaW4tMC41LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFByb21pc2UgZnJvbSAnYmx1ZWJpcmQnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IFlhemwgZnJvbSAneWF6bCdcbmltcG9ydCBZYXV6bCBmcm9tICd5YXV6bCdcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzLWV4dHJhJ1xuaW1wb3J0IHsgdHlwZU9mIH0gZnJvbSAnbHV0aWxzJ1xuaW1wb3J0IFlhbWwgZnJvbSAnanMteWFtbCdcblxuaW1wb3J0IE1vZHVsZUJ1bmRsZXIgZnJvbSAnLi9Nb2R1bGVCdW5kbGVyJ1xuaW1wb3J0IFNvdXJjZUJ1bmRsZXIgZnJvbSAnLi9Tb3VyY2VCdW5kbGVyJ1xuaW1wb3J0IEZpbGVCdWlsZCBmcm9tICcuL0ZpbGVCdWlsZCdcblxuUHJvbWlzZS5wcm9taXNpZnlBbGwoZnMpXG5cbi8vIEZJWE1FOiBmb3IgZGVidWdnaW5nLCByZW1vdmUgbGF0ZXJcbmNvbnNvbGUuaW5zcGVjdCA9ICh2YWwsIC4uLmFyZ3MpID0+IGNvbnNvbGUubG9nKCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdCh2YWwsIHsgZGVwdGg6IDYsIGNvbG9yczogdHJ1ZSwgLi4uYXJncyB9KSApXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChTKSB7XG4gICAgY29uc3QgU0NsaSA9IHJlcXVpcmUoUy5nZXRTZXJ2ZXJsZXNzUGF0aCgndXRpbHMvY2xpJykpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cbiAgICBjbGFzcyBTZXJ2ZXJsZXNzQnVpbGRQbHVnaW4gZXh0ZW5kcyBTLmNsYXNzZXMuUGx1Z2luIHtcblxuXG4gICAgICAgIGNvbmZpZyA9IHtcbiAgICAgICAgICAgIHRyeUZpbGVzICAgIDogWyBcIndlYnBhY2suY29uZmlnLmpzXCIgXSxcbiAgICAgICAgICAgIGJhc2VFeGNsdWRlIDogWyAvXFxibm9kZV9tb2R1bGVzXFxiLyBdLFxuXG4gICAgICAgICAgICBtb2R1bGVzOiB7XG4gICAgICAgICAgICAgICAgZXhjbHVkZSAgICAgOiBbICdhd3Mtc2RrJyBdLCAvLyBUaGVzZSBtYXRjaCByb290IGRlcGVuZGVuY2llc1xuICAgICAgICAgICAgICAgIGRlZXBFeGNsdWRlIDogWyAnYXdzLXNkaycgXSwgLy8gVGhlc2UgbWF0Y2ggZGVlcCBkZXBlbmRlbmNpZXNcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGV4Y2x1ZGUgOiBbXSxcbiAgICAgICAgICAgIGluY2x1ZGUgOiBbXSxcblxuICAgICAgICAgICAgdWdsaWZ5ICAgICAgICA6IHRydWUsXG4gICAgICAgICAgICB1Z2xpZnlTb3VyY2UgIDogZmFsc2UsXG4gICAgICAgICAgICB1Z2xpZnlNb2R1bGVzIDogdHJ1ZSxcblxuICAgICAgICAgICAgYmFiZWwgICAgICA6IG51bGwsXG4gICAgICAgICAgICBzb3VyY2VNYXBzIDogdHJ1ZSxcblxuICAgICAgICAgICAgLy8gUGFzc2VkIHRvIGB5YXpsYCBhcyBvcHRpb25zXG4gICAgICAgICAgICB6aXA6IHsgY29tcHJlc3M6IHRydWUgfSxcblxuICAgICAgICAgICAgbWV0aG9kIDogJ2J1bmRsZScsXG4gICAgICAgICAgICBmaWxlICAgOiBudWxsLFxuXG4gICAgICAgICAgICBmdW5jdGlvbnM6IHt9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFRoaXMgaXMgaW50ZW5kZWQgdG8gb3BlcmF0ZSBhcyBhIGJhc2UgY29uZmlndXJhdGlvbiBwYXNzZWQgdG8gZWFjaCBzdWIgY2xhc3MuXG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBTRVJWRVJMRVNTXG4gICAgICAgICAgICAvL1xuXG4gICAgICAgICAgICBzdXBlcigpXG4gICAgICAgICAgICB0aGlzLm5hbWUgPSAnU2VydmVybGVzc0J1aWxkUGx1Z2luJ1xuXG4gICAgICAgICAgICAvLyBQTFVHSU4gQ09ORklHIEdFTkVSQVRJT05cblxuICAgICAgICAgICAgY29uc3Qgc2VydmljZVBhdGggICAgID0gUy5jb25maWcucHJvamVjdFBhdGhcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkQ29uZmlnUGF0aCA9IHBhdGguam9pbihzZXJ2aWNlUGF0aCwgJy4vc2VydmVybGVzcy5idWlsZC55bWwnKVxuXG4gICAgICAgICAgICBjb25zdCBidWlsZENvbmZpZyA9IGZzLmV4aXN0c1N5bmMoYnVpbGRDb25maWdQYXRoKVxuICAgICAgICAgICAgICAgID8gWWFtbC5sb2FkKCBmcy5yZWFkRmlsZVN5bmMoYnVpbGRDb25maWdQYXRoKSApXG4gICAgICAgICAgICAgICAgOiB7fVxuXG4gICAgICAgICAgICB0aGlzLnNlcnZlcmxlc3MgPSB7XG4gICAgICAgICAgICAgICAgY29uZmlnOiB7IHNlcnZpY2VQYXRoOiBzZXJ2aWNlUGF0aCB9LFxuICAgICAgICAgICAgICAgIHNlcnZpY2U6IHsgcGFja2FnZToge30gfSxcbiAgICAgICAgICAgICAgICBjbGk6IFNDbGlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRoZSBjb25maWcgaW5oZXJpdHMgZnJvbSBtdWx0aXBsZSBzb3VyY2VzXG4gICAgICAgICAgICB0aGlzLmNvbmZpZyAgICA9IHtcbiAgICAgICAgICAgICAgICAuLi50aGlzLmNvbmZpZyxcbiAgICAgICAgICAgICAgICAuLi5idWlsZENvbmZpZyxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGluaXQoZSkge1xuICAgICAgICAgICAgY29uc3QgcHJvamVjdCA9IFMuZ2V0UHJvamVjdCgpXG5cbiAgICAgICAgICAgIGNvbnN0IHsgZnVuY3Rpb25zIH0gPSBwcm9qZWN0XG5cbiAgICAgICAgICAgIHRoaXMuc2VydmVybGVzcy5zZXJ2aWNlLnNlcnZpY2UgPSBwcm9qZWN0Lm5hbWVcblxuICAgICAgICAgICAgbGV0IHNlbGVjdGVkRnVuY3Rpb25zID0gdHlwZU9mLkFycmF5KHByb2plY3QuZ2V0RnVuY3Rpb24oZS5vcHRpb25zLm5hbWUpKVxuICAgICAgICAgICAgICAgID8gcHJvamVjdC5nZXRGdW5jdGlvbihlLm9wdGlvbnMubmFtZSlcbiAgICAgICAgICAgICAgICA6IFsgcHJvamVjdC5nZXRGdW5jdGlvbihlLm9wdGlvbnMubmFtZSkgXVxuXG5cbiAgICAgICAgICAgIHNlbGVjdGVkRnVuY3Rpb25zID0gc2VsZWN0ZWRGdW5jdGlvbnMuZmlsdGVyKChrZXkpID0+IGtleSBpbiBmdW5jdGlvbnMgKVxuICAgICAgICAgICAgc2VsZWN0ZWRGdW5jdGlvbnMgPSBzZWxlY3RlZEZ1bmN0aW9ucy5sZW5ndGggPyBzZWxlY3RlZEZ1bmN0aW9ucyA6IE9iamVjdC5rZXlzKGZ1bmN0aW9ucylcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiAgQW4gYXJyYXkgb2YgZnVsbCByZWFsaXplZCBmdW5jdGlvbnMgY29uZmlncyB0byBidWlsZCBhZ2FpbnN0LlxuICAgICAgICAgICAgICogIEluaGVyaXRzIGZyb21cbiAgICAgICAgICAgICAqICAtIHNlcnZlcmxlc3MueW1sIGZ1bmN0aW9ucy48Zm4+LnBhY2thZ2VcbiAgICAgICAgICAgICAqICAtIHNlcnZlcmxlc3MuYnVpbGQueW1sIGZ1bmN0aW9ucy48Zm4+XG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogIGluIG9yZGVyIHRvIGdlbmVyYXRlIGBpbmNsdWRlYCwgYGV4Y2x1ZGVgXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuZnVuY3Rpb25zID0gc2VsZWN0ZWRGdW5jdGlvbnMucmVkdWNlKChvYmosIGZuS2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZm5DZmcgICAgICA9IGZ1bmN0aW9uc1tmbktleV1cbiAgICAgICAgICAgICAgICBjb25zdCBmbkJ1aWxkQ2ZnID0gdGhpcy5jb25maWcuZnVuY3Rpb25zW2ZuS2V5XSB8fCB7fVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5jbHVkZSA9IFtcbiAgICAgICAgICAgICAgICAgICAgLi4uKCB0aGlzLmNvbmZpZy5pbmNsdWRlIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggKCBmbkNmZy5wYWNrYWdlICYmIGZuQ2ZnLnBhY2thZ2UuaW5jbHVkZSApIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggZm5CdWlsZENmZy5pbmNsdWRlIHx8IFtdIClcbiAgICAgICAgICAgICAgICBdXG5cbiAgICAgICAgICAgICAgICBjb25zdCBleGNsdWRlID0gW1xuICAgICAgICAgICAgICAgICAgICAuLi4oIHRoaXMuY29uZmlnLmJhc2VFeGNsdWRlIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggdGhpcy5jb25maWcuZXhjbHVkZSB8fCBbXSApLFxuICAgICAgICAgICAgICAgICAgICAuLi4oICggZm5DZmcucGFja2FnZSAmJiBmbkNmZy5wYWNrYWdlLmV4Y2x1ZGUgKSB8fCBbXSApLFxuICAgICAgICAgICAgICAgICAgICAuLi4oIGZuQnVpbGRDZmcuZXhjbHVkZSB8fCBbXSApXG4gICAgICAgICAgICAgICAgXVxuXG4gICAgICAgICAgICAgICAgLy8gVXRpbGl6ZSB0aGUgcHJvcG9zZWQgYHBhY2thZ2VgIGNvbmZpZ3VyYXRpb24gZm9yIGZ1bmN0aW9uc1xuICAgICAgICAgICAgICAgIG9ialtmbktleV0gPSB7XG4gICAgICAgICAgICAgICAgICAgIC4uLmZuQ2ZnLFxuXG4gICAgICAgICAgICAgICAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLiggZm5DZmcucGFja2FnZSB8fCB7fSApLFxuICAgICAgICAgICAgICAgICAgICAgICAgLi4uKCB0aGlzLmNvbmZpZy5mdW5jdGlvbnNbZm5LZXldIHx8IHt9ICksXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlLCBleGNsdWRlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqXG4gICAgICAgICAgICB9LCB7fSlcblxuICAgICAgICAgICAgLy8gY29uc29sZS5pbnNwZWN0KHsgb3B0aW9uczogdGhpcy5jb25maWcgfSlcbiAgICAgICAgICAgIC8vIGNvbnNvbGUuaW5zcGVjdCh7IGZ1bmN0aW9uczogdGhpcy5mdW5jdGlvbnMgfSlcblxuICAgICAgICAgICAgcmV0dXJuIGVcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIHJlZ2lzdGVyQWN0aW9ucygpIHtcbiAgICAgICAgICAgIFMuYWRkQWN0aW9uKHRoaXMuY29tcGxldGVBcnRpZmFjdC5iaW5kKHRoaXMpLCB7XG4gICAgICAgICAgICAgICAgaGFuZGxlcjogICAgICdidWlsZENvbXBsZXRlQXJ0aWZhY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQnVpbGRzIGFydGlmYWN0IGZvciBkZXBsb3ltZW50J1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgcmVnaXN0ZXJIb29rcygpIHtcbiAgICAgICAgICAgIFMuYWRkSG9vayh0aGlzLmluaXQuYmluZCh0aGlzKSwge1xuICAgICAgICAgICAgICAgIGFjdGlvbjogJ2Z1bmN0aW9uRGVwbG95JyxcbiAgICAgICAgICAgICAgICBldmVudDogJ3ByZSdcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBTLmFkZEhvb2sodGhpcy5idWlsZC5iaW5kKHRoaXMpLCB7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiAnY29kZURlcGxveUxhbWJkYScsXG4gICAgICAgICAgICAgICAgZXZlbnQ6ICdwcmUnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgYnVpbGQoZSkge1xuXG4gICAgICAgICAgICAvLyBUT0RPIGluIHRoZSBmdXR1cmU6XG4gICAgICAgICAgICAvLyAtIGNyZWF0ZSBzZXBlcmF0ZSB6aXBzXG4gICAgICAgICAgICAvLyAtIG1vZGlmeSBhcnRpZmFjdCBjb21wbGV0aW9uIHByb2Nlc3MsIHNwbGl0dGluZyBidWlsZHMgdXAgaW50byBzZXBlcmF0ZSBhcnRpZmFjdHNcblxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXJsZXNzLmNsaS5sb2coYFNlcnZlcmxlc3MgQnVpbGQgdHJpZ2dlcmVkIGZvciAke2Uub3B0aW9ucy5uYW1lfS4uLmApXG5cbiAgICAgICAgICAgIGNvbnN0IHsgbWV0aG9kIH0gICA9IHRoaXMuY29uZmlnXG4gICAgICAgICAgICBsZXQgbW9kdWxlSW5jbHVkZXMgPSBbXVxuICAgICAgICAgICAgbGV0IG1vZHVsZUV4Y2x1ZGVzID0gW11cblxuICAgICAgICAgICAgY29uc3QgZnVuY09iaiA9IFMuZ2V0UHJvamVjdCgpLmdldEZ1bmN0aW9uKGUub3B0aW9ucy5uYW1lKVxuICAgICAgICAgICAgY29uc3QgZnVuY1BhdGggPSBwYXRoLnJlbGF0aXZlKFMuY29uZmlnLnByb2plY3RQYXRoLCBmdW5jT2JqLmdldFJvb3RQYXRoKCkpXG5cbiAgICAgICAgICAgIC8vIFNldCBidWlsZCBwYXRoc1xuICAgICAgICAgICAgdGhpcy50bXBEaXIgICAgICAgICA9IGUub3B0aW9ucy5wYXRoRGlzdFxuICAgICAgICAgICAgdGhpcy5idWlsZFRtcERpciAgICA9IHBhdGguam9pbih0aGlzLnRtcERpciwgJy4vYnVpbGQnKVxuICAgICAgICAgICAgdGhpcy5hcnRpZmFjdFRtcERpciA9IHBhdGguam9pbihlLm9wdGlvbnMucGF0aERpc3QsICcuL2FydGlmYWN0cycpXG4gICAgICAgICAgICB0aGlzLmRlcGxveVRtcERpciAgID0gcGF0aC5qb2luKGUub3B0aW9ucy5wYXRoRGlzdCwgJy4vZGVwbG95JylcblxuICAgICAgICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyQXN5bmModGhpcy5idWlsZFRtcERpcilcbiAgICAgICAgICAgIGF3YWl0IGZzLmVuc3VyZURpckFzeW5jKHRoaXMuYXJ0aWZhY3RUbXBEaXIpXG5cbiAgICAgICAgICAgIGNvbnN0IGFydGlmYWN0ID0gbmV3IFlhemwuWmlwRmlsZSgpXG5cbiAgICAgICAgICAgIGlmICggbWV0aG9kID09PSAnYnVuZGxlJyApIHtcbiAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgIC8vIFNPVVJDRSBCVU5ETEVSXG4gICAgICAgICAgICAgICAgLy9cblxuICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZUJ1bmRsZXIgPSBuZXcgU291cmNlQnVuZGxlcih7XG4gICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29uZmlnLFxuICAgICAgICAgICAgICAgICAgICB1Z2xpZnkgICAgICA6IHRoaXMuY29uZmlnLnVnbGlmeVNvdXJjZSA/IHRoaXMuY29uZmlnLnVnbGlmeSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgc2VydmljZVBhdGggOiBTLmNvbmZpZy5wcm9qZWN0UGF0aFxuICAgICAgICAgICAgICAgIH0sIGFydGlmYWN0KVxuXG4gICAgICAgICAgICAgICAgZm9yICggY29uc3QgZm5LZXkgaW4gdGhpcy5mdW5jdGlvbnMgKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmbktleSA9PT0gZS5vcHRpb25zLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuZnVuY3Rpb25zW2ZuS2V5XVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNlcnZlcmxlc3MuY2xpLmxvZyhgQnVuZGxpbmcgJHtmbktleX0uLi5gKVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTeW5jaHJvbm91cyBmb3Igbm93LCBidXQgY2FuIGJlIHBhcmVsbGVsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWcucGFja2FnZS5leGNsdWRlLnB1c2goJ19tZXRhJylcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgbm8gaW5jbHVkZXMgYXJlIHNwZWNpZmllZCBmb3IgZnVuY3Rpb24sIHRoZW4gZGVmYXVsdCB0byB1c2luZyB0aGUgZnVuY3Rpb24gZm9sZGVyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlnLnBhY2thZ2UuaW5jbHVkZS5sZW5ndGggPCAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLnBhY2thZ2UuaW5jbHVkZS5wdXNoKGAke2Z1bmNQYXRofS8qKmApXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNvdXJjZUJ1bmRsZXIuYnVuZGxlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGNsdWRlIDogY29uZmlnLnBhY2thZ2UuZXhjbHVkZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlIDogY29uZmlnLnBhY2thZ2UuaW5jbHVkZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBtZXRob2QgPT09ICdmaWxlJyApIHtcbiAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgIC8vIEJVSUxEIEZJTEVcbiAgICAgICAgICAgICAgICAvL1xuXG4gICAgICAgICAgICAgICAgLy8gVGhpcyBidWlsZHMgYWxsIGZ1bmN0aW9uc1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVCdWlsZCA9IGF3YWl0IG5ldyBGaWxlQnVpbGQoe1xuICAgICAgICAgICAgICAgICAgICAuLi50aGlzLmNvbmZpZyxcbiAgICAgICAgICAgICAgICAgICAgc2VydmljZVBhdGggOiBTLmNvbmZpZy5wcm9qZWN0UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRUbXBEaXIgOiB0aGlzLmJ1aWxkVG1wRGlyLFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbnMgICA6IHRoaXMuZnVuY3Rpb25zLFxuICAgICAgICAgICAgICAgICAgICBzZXJ2ZXJsZXNzICA6IHRoaXMuc2VydmVybGVzc1xuICAgICAgICAgICAgICAgIH0sIGFydGlmYWN0KS5idWlsZCgpXG5cbiAgICAgICAgICAgICAgICBtb2R1bGVJbmNsdWRlcyA9IFsgLi4uZmlsZUJ1aWxkLmV4dGVybmFscyBdIC8vIFNwcmVhZCwgZm9yIGFuIGl0ZXJhdG9yXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gYnVpbGQgbWV0aG9kIHVuZGVyIGBjdXN0b20uYnVpbGQubWV0aG9kYFwiKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZnVuY01vZHVsZUV4Y2x1ZGVzID0gW11cbiAgICAgICAgICAgIGlmICh0aGlzLmZ1bmN0aW9uc1tlLm9wdGlvbnMubmFtZV0ucGFja2FnZS5tb2R1bGVzKSB7XG4gICAgICAgICAgICAgICAgZnVuY01vZHVsZUV4Y2x1ZGVzID0gdGhpcy5mdW5jdGlvbnNbZS5vcHRpb25zLm5hbWVdLnBhY2thZ2UubW9kdWxlcy5leGNsdWRlIHx8IFtdXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1vZHVsZUV4Y2x1ZGVzID0gWyAuLi50aGlzLmNvbmZpZy5tb2R1bGVzLmV4Y2x1ZGUsIC4uLmZ1bmNNb2R1bGVFeGNsdWRlcyBdXG5cbiAgICAgICAgICAgIGF3YWl0IG5ldyBNb2R1bGVCdW5kbGVyKHtcbiAgICAgICAgICAgICAgICAuLi50aGlzLmNvbmZpZyxcbiAgICAgICAgICAgICAgICB1Z2xpZnkgICAgICA6IHRoaXMuY29uZmlnLnVnbGlmeU1vZHVsZXMgPyB0aGlzLmNvbmZpZy51Z2xpZnkgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgc2VydmljZVBhdGggOiBTLmNvbmZpZy5wcm9qZWN0UGF0aFxuICAgICAgICAgICAgfSwgYXJ0aWZhY3QpLmJ1bmRsZSh7XG4gICAgICAgICAgICAgICAgaW5jbHVkZTogbW9kdWxlSW5jbHVkZXMsXG4gICAgICAgICAgICAgICAgZXhjbHVkZTogbW9kdWxlRXhjbHVkZXMsXG4gICAgICAgICAgICAgICAgZGVlcEV4Y2x1ZGU6IHRoaXMuY29uZmlnLm1vZHVsZXMuZGVlcEV4Y2x1ZGVcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIFNlcnZlcmxlc3MgMC41IGhhY2ssIHJlYnVpbGQgYSBfc2VydmVybGVzc19oYW5kbGVyLmpzIGZpbGUgd2hpbGUgc3RpbGwga2VlcGluZyBlbnYgdmFyc1xuXG4gICAgICAgICAgICBjb25zdCBbIGhhbmRsZXJGaWxlLCBoYW5kbGVyRnVuYyBdID0gdGhpcy5mdW5jdGlvbnNbZS5vcHRpb25zLm5hbWVdLmhhbmRsZXIuc3BsaXQoJy4nKVxuICAgICAgICAgICAgLy8gUmVhZCBleGlzdGluZyBoYW5kbGVyIGZyb20gZnNcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlcmxlc3NIYW5kbGVyID0gZnMucmVhZEZpbGVTeW5jKGAke2Uub3B0aW9ucy5wYXRoRGlzdH0vX3NlcnZlcmxlc3NfaGFuZGxlci5qc2AsICd1dGY4JylcbiAgICAgICAgICAgIC8vLyBSZXBsYWNlIGV4cG9ydGVkIGhhbmRsZXIgd2l0aCBjb3JyZWN0IHBhdGggYXMgcGVyIGJ1aWxkIHByb2Nlc3NcbiAgICAgICAgICAgIGNvbnN0IG9sZEV4cG9ydCA9IHNlcnZlcmxlc3NIYW5kbGVyLm1hdGNoKC9leHBvcnRzXFwuaGFuZGxlciA9IHJlcXVpcmVcXChcIiguKilcIlxcKVxcW1wiKC4qKVwiXFxdOy9pbWcpWzBdXG4gICAgICAgICAgICBjb25zdCBuZXdFeHBvcnQgPSBgZXhwb3J0cy5oYW5kbGVyID0gcmVxdWlyZShcIi4vJHtmdW5jUGF0aH0vJHtoYW5kbGVyRmlsZX1cIilbXCIke2hhbmRsZXJGdW5jfVwiXWBcbiAgICAgICAgICAgIC8vIEFkZCBoYW5kbGVyIHRvIHppcFxuICAgICAgICAgICAgYXJ0aWZhY3QuYWRkQnVmZmVyKCBuZXcgQnVmZmVyKHNlcnZlcmxlc3NIYW5kbGVyLnJlcGxhY2Uob2xkRXhwb3J0LCBuZXdFeHBvcnQpKSwgJ19zZXJ2ZXJsZXNzX2hhbmRsZXIuanMnLCB0aGlzLmNvbmZpZy56aXAgKVxuXG4gICAgICAgICAgICBlLm9wdGlvbnMuYXJ0aWZhY3QgPSBhcnRpZmFjdFxuXG4gICAgICAgICAgICByZXR1cm4gUy5hY3Rpb25zLmJ1aWxkQ29tcGxldGVBcnRpZmFjdChlKVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgY29tcGxldGVBcnRpZmFjdChlKSB7XG4gICAgICAgICAgICB0aGlzLnNlcnZlcmxlc3MuY2xpLmxvZygnQ29tcGlsaW5nIGRlcGxveW1lbnQgYXJ0aWZhY3QnKVxuICAgICAgICAgICAgYXdhaXQgdGhpcy5fY29tcGxldGVBcnRpZmFjdCh7XG4gICAgICAgICAgICAgICAgYXJ0aWZhY3Q6IGUub3B0aW9ucy5hcnRpZmFjdCxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbk5hbWU6IGUub3B0aW9ucy5uYW1lLFxuICAgICAgICAgICAgICAgIGFydGlmYWN0VG1wRGlyOiBgJHtlLm9wdGlvbnMucGF0aERpc3R9L2FydGlmYWN0c2BcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIGNvbnN0IHppcFBhdGggPSB0aGlzLnNlcnZlcmxlc3Muc2VydmljZS5wYWNrYWdlLmFydGlmYWN0XG5cbiAgICAgICAgICAgIGNvbnN0IGRlcGxveVRtcERpciA9IHBhdGguam9pbihlLm9wdGlvbnMucGF0aERpc3QsICcuL2RlcGxveScpXG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuX3VucGFja1ppcCh7XG4gICAgICAgICAgICAgICAgemlwUGF0aCxcbiAgICAgICAgICAgICAgICBkZXBsb3lUbXBEaXJcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIGUub3B0aW9ucy5wYXRoRGlzdCA9IGRlcGxveVRtcERpclxuICAgICAgICAgICAgcmV0dXJuIGVcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIF91bnBhY2taaXAoeyB6aXBQYXRoLCBkZXBsb3lUbXBEaXIgfSkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBZYXV6bC5vcGVuKHppcFBhdGgsIHsgbGF6eUVudHJpZXM6IHRydWUgfSwgKGVyciwgemlwZmlsZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB0aHJvdyBlcnJcblxuICAgICAgICAgICAgICAgICAgICB6aXBmaWxlLnJlYWRFbnRyeSgpXG4gICAgICAgICAgICAgICAgICAgIHppcGZpbGUub24oXCJlbnRyeVwiLCBmdW5jdGlvbihlbnRyeSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKC9cXC8kLy50ZXN0KGVudHJ5LmZpbGVOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRpcmVjdG9yeSBmaWxlIG5hbWVzIGVuZCB3aXRoICcvJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1rZGlycChgJHtkZXBsb3lUbXBEaXJ9LyR7ZW50cnkuZmlsZU5hbWV9YCwgZnVuY3Rpb24obWtkaXJFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1rZGlyRXJyKSB0aHJvdyBta2RpckVyclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB6aXBmaWxlLnJlYWRFbnRyeSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmlsZSBlbnRyeVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHppcGZpbGUub3BlblJlYWRTdHJlYW0oZW50cnksIGZ1bmN0aW9uKHJzRXJyLCByZWFkU3RyZWFtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyc0VycikgdGhyb3cgcnNFcnJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIHBhcmVudCBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1rZGlycChwYXRoLmRpcm5hbWUoYCR7ZGVwbG95VG1wRGlyfS8ke2VudHJ5LmZpbGVOYW1lfWApLCBmdW5jdGlvbihta2RpckVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1rZGlyRXJyKSB0aHJvdyBta2RpckVyclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVhZFN0cmVhbS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKGAke2RlcGxveVRtcERpcn0vJHtlbnRyeS5maWxlTmFtZX1gKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYWRTdHJlYW0ub24oXCJlbmRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgemlwZmlsZS5yZWFkRW50cnkoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgIHppcGZpbGUub25jZShcImVuZFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHppcGZpbGUuY2xvc2UoKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgV3JpdGVzIHRoZSBgYXJ0aWZhY3RgIGFuZCBhdHRhY2hlcyBpdCB0byBzZXJ2ZXJsZXNzXG4gICAgICAgICAqL1xuICAgICAgICBhc3luYyBfY29tcGxldGVBcnRpZmFjdCh7IGFydGlmYWN0LCBmdW5jdGlvbk5hbWUsIGFydGlmYWN0VG1wRGlyIH0pIHtcbiAgICAgICAgICAgIC8vIFB1cmdlIGV4aXN0aW5nIGFydGlmYWN0c1xuICAgICAgICAgICAgaWYgKCAhIHRoaXMuY29uZmlnLmtlZXAgKVxuICAgICAgICAgICAgICAgIGF3YWl0IGZzLmVtcHR5RGlyQXN5bmMoYXJ0aWZhY3RUbXBEaXIpXG5cbiAgICAgICAgICAgIGNvbnN0IHppcFBhdGggPSBwYXRoLnJlc29sdmUoYXJ0aWZhY3RUbXBEaXIsIGAuLyR7dGhpcy5zZXJ2ZXJsZXNzLnNlcnZpY2Uuc2VydmljZX0tJHtmdW5jdGlvbk5hbWV9LSR7bmV3IERhdGUoKS5nZXRUaW1lKCl9LnppcGApXG5cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBhcnRpZmFjdC5vdXRwdXRTdHJlYW0ucGlwZSggZnMuY3JlYXRlV3JpdGVTdHJlYW0oemlwUGF0aCkgKVxuICAgICAgICAgICAgICAgIC5vbihcImVycm9yXCIsIHJlamVjdClcbiAgICAgICAgICAgICAgICAub24oXCJjbG9zZVwiLCByZXNvbHZlKVxuXG4gICAgICAgICAgICAgICAgYXJ0aWZhY3QuZW5kKClcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIHRoaXMuc2VydmVybGVzcy5zZXJ2aWNlLnBhY2thZ2UuYXJ0aWZhY3QgPSB6aXBQYXRoXG5cbiAgICAgICAgICAgIC8vIFB1cmdlIGJ1aWxkIGRpclxuICAgICAgICAgICAgaWYgKCAhIHRoaXMuY29uZmlnLmtlZXAgKVxuICAgICAgICAgICAgICAgIGF3YWl0IGZzLmVtcHR5RGlyQXN5bmModGhpcy5idWlsZFRtcERpcilcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgcmV0dXJuIFNlcnZlcmxlc3NCdWlsZFBsdWdpblxufVxuIl19