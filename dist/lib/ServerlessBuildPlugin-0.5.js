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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvU2VydmVybGVzc0J1aWxkUGx1Z2luLTAuNS5qcyJdLCJuYW1lcyI6WyJTIiwiU0NsaSIsInJlcXVpcmUiLCJnZXRTZXJ2ZXJsZXNzUGF0aCIsIlNlcnZlcmxlc3NCdWlsZFBsdWdpbiIsImNsYXNzZXMiLCJQbHVnaW4iLCJjb25zdHJ1Y3RvciIsImNvbmZpZyIsInRyeUZpbGVzIiwiYmFzZUV4Y2x1ZGUiLCJtb2R1bGVzIiwiZXhjbHVkZSIsImluY2x1ZGUiLCJ1Z2xpZnkiLCJ1Z2xpZnlTb3VyY2UiLCJ1Z2xpZnlNb2R1bGVzIiwiYmFiZWwiLCJzb3VyY2VNYXBzIiwiemlwIiwiY29tcHJlc3MiLCJtZXRob2QiLCJmaWxlIiwiZnVuY3Rpb25zIiwibmFtZSIsInNlcnZpY2VQYXRoIiwicHJvamVjdFBhdGgiLCJidWlsZENvbmZpZ1BhdGgiLCJqb2luIiwiYnVpbGRDb25maWciLCJleGlzdHNTeW5jIiwibG9hZCIsInJlYWRGaWxlU3luYyIsInNlcnZlcmxlc3MiLCJzZXJ2aWNlIiwicGFja2FnZSIsImNsaSIsImluaXQiLCJlIiwicHJvamVjdCIsImdldFByb2plY3QiLCJzZWxlY3RlZEZ1bmN0aW9ucyIsIkFycmF5IiwiZ2V0RnVuY3Rpb24iLCJvcHRpb25zIiwiZmlsdGVyIiwia2V5IiwibGVuZ3RoIiwiT2JqZWN0Iiwia2V5cyIsInJlZHVjZSIsIm9iaiIsImZuS2V5IiwiZm5DZmciLCJmbkJ1aWxkQ2ZnIiwicmVnaXN0ZXJBY3Rpb25zIiwiYWRkQWN0aW9uIiwiY29tcGxldGVBcnRpZmFjdCIsImJpbmQiLCJoYW5kbGVyIiwiZGVzY3JpcHRpb24iLCJyZWdpc3Rlckhvb2tzIiwiYWRkSG9vayIsImFjdGlvbiIsImV2ZW50IiwiYnVpbGQiLCJsb2ciLCJtb2R1bGVJbmNsdWRlcyIsIm1vZHVsZUV4Y2x1ZGVzIiwidG1wRGlyIiwicGF0aERpc3QiLCJidWlsZFRtcERpciIsImFydGlmYWN0VG1wRGlyIiwiZGVwbG95VG1wRGlyIiwiZW5zdXJlRGlyQXN5bmMiLCJhcnRpZmFjdCIsIlppcEZpbGUiLCJzb3VyY2VCdW5kbGVyIiwidW5kZWZpbmVkIiwicHVzaCIsImJ1bmRsZSIsImZpbGVCdWlsZCIsImV4dGVybmFscyIsIkVycm9yIiwiZnVuY01vZHVsZUV4Y2x1ZGVzIiwiZnVuY09iaiIsImZ1bmNQYXRoIiwicmVsYXRpdmUiLCJnZXRSb290UGF0aCIsInNwbGl0IiwiaGFuZGxlckZpbGUiLCJoYW5kbGVyRnVuYyIsInNlcnZlcmxlc3NIYW5kbGVyIiwib2xkRXhwb3J0IiwibWF0Y2giLCJuZXdFeHBvcnQiLCJhZGRCdWZmZXIiLCJCdWZmZXIiLCJyZXBsYWNlIiwiYWN0aW9ucyIsImJ1aWxkQ29tcGxldGVBcnRpZmFjdCIsIl9jb21wbGV0ZUFydGlmYWN0IiwiZnVuY3Rpb25OYW1lIiwiemlwUGF0aCIsIl91bnBhY2taaXAiLCJyZXNvbHZlIiwicmVqZWN0Iiwib3BlbiIsImxhenlFbnRyaWVzIiwiZXJyIiwiemlwZmlsZSIsInJlYWRFbnRyeSIsIm9uIiwiZW50cnkiLCJ0ZXN0IiwiZmlsZU5hbWUiLCJta2RpckVyciIsIm9wZW5SZWFkU3RyZWFtIiwicnNFcnIiLCJyZWFkU3RyZWFtIiwiZGlybmFtZSIsInBpcGUiLCJjcmVhdGVXcml0ZVN0cmVhbSIsIm9uY2UiLCJjbG9zZSIsImtlZXAiLCJlbXB0eURpckFzeW5jIiwiRGF0ZSIsImdldFRpbWUiLCJvdXRwdXRTdHJlYW0iLCJlbmQiLCJwcm9taXNpZnlBbGwiLCJjb25zb2xlIiwiaW5zcGVjdCIsInZhbCIsImFyZ3MiLCJkZXB0aCIsImNvbG9ycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7a0JBa0JlLFVBQVVBLENBQVYsRUFBYTtBQUN4QixVQUFNQyxPQUFPQyxRQUFRRixFQUFFRyxpQkFBRixDQUFvQixXQUFwQixDQUFSLENBQWIsQ0FEd0IsQ0FDZ0M7O0FBRXhELFVBQU1DLHFCQUFOLFNBQW9DSixFQUFFSyxPQUFGLENBQVVDLE1BQTlDLENBQXFEOztBQThC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Ozs7QUFDQTs7Ozs7Ozs7QUFFQSxtQkFBUStILFlBQVI7O0FBRUE7QUFDQUMsUUFBUUMsT0FBUixHQUFrQixVQUFDQyxHQUFEO0FBQUEsc0NBQVNDLElBQVQ7QUFBU0EsWUFBVDtBQUFBOztBQUFBLFdBQWtCSCxRQUFRbEUsR0FBUixDQUFhaEUsUUFBUSxNQUFSLEVBQWdCbUksT0FBaEIsQ0FBd0JDLEdBQXhCLGFBQStCRSxPQUFPLENBQXRDLEVBQXlDQyxRQUFRLElBQWpELElBQTBERixJQUExRCxFQUFiLENBQWxCO0FBQUEsQ0FBbEIiLCJmaWxlIjoiU2VydmVybGVzc0J1aWxkUGx1Z2luLTAuNS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQcm9taXNlIGZyb20gJ2JsdWViaXJkJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBZYXpsIGZyb20gJ3lhemwnXG5pbXBvcnQgWWF1emwgZnJvbSAneWF1emwnXG5pbXBvcnQgbWtkaXJwIGZyb20gJ21rZGlycCdcbmltcG9ydCBmcyBmcm9tICdmcy1leHRyYSdcbmltcG9ydCB7IHR5cGVPZiB9IGZyb20gJ2x1dGlscydcbmltcG9ydCBZYW1sIGZyb20gJ2pzLXlhbWwnXG5cbmltcG9ydCBNb2R1bGVCdW5kbGVyIGZyb20gJy4vTW9kdWxlQnVuZGxlcidcbmltcG9ydCBTb3VyY2VCdW5kbGVyIGZyb20gJy4vU291cmNlQnVuZGxlcidcbmltcG9ydCBGaWxlQnVpbGQgZnJvbSAnLi9GaWxlQnVpbGQnXG5cblByb21pc2UucHJvbWlzaWZ5QWxsKGZzKVxuXG4vLyBGSVhNRTogZm9yIGRlYnVnZ2luZywgcmVtb3ZlIGxhdGVyXG5jb25zb2xlLmluc3BlY3QgPSAodmFsLCAuLi5hcmdzKSA9PiBjb25zb2xlLmxvZyggcmVxdWlyZSgndXRpbCcpLmluc3BlY3QodmFsLCB7IGRlcHRoOiA2LCBjb2xvcnM6IHRydWUsIC4uLmFyZ3MgfSkgKVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoUykge1xuICAgIGNvbnN0IFNDbGkgPSByZXF1aXJlKFMuZ2V0U2VydmVybGVzc1BhdGgoJ3V0aWxzL2NsaScpKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXG4gICAgY2xhc3MgU2VydmVybGVzc0J1aWxkUGx1Z2luIGV4dGVuZHMgUy5jbGFzc2VzLlBsdWdpbiB7XG5cblxuICAgICAgICBjb25maWcgPSB7XG4gICAgICAgICAgICB0cnlGaWxlcyAgICA6IFsgXCJ3ZWJwYWNrLmNvbmZpZy5qc1wiIF0sXG4gICAgICAgICAgICBiYXNlRXhjbHVkZSA6IFsgL1xcYm5vZGVfbW9kdWxlc1xcYi8gXSxcblxuICAgICAgICAgICAgbW9kdWxlczoge1xuICAgICAgICAgICAgICAgIGV4Y2x1ZGU6IFsgJ2F3cy1zZGsnIF1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGV4Y2x1ZGUgOiBbXSxcbiAgICAgICAgICAgIGluY2x1ZGUgOiBbXSxcblxuICAgICAgICAgICAgdWdsaWZ5ICAgICAgICA6IHRydWUsXG4gICAgICAgICAgICB1Z2xpZnlTb3VyY2UgIDogZmFsc2UsXG4gICAgICAgICAgICB1Z2xpZnlNb2R1bGVzIDogdHJ1ZSxcblxuICAgICAgICAgICAgYmFiZWwgICAgICA6IG51bGwsXG4gICAgICAgICAgICBzb3VyY2VNYXBzIDogdHJ1ZSxcblxuICAgICAgICAgICAgLy8gUGFzc2VkIHRvIGB5YXpsYCBhcyBvcHRpb25zXG4gICAgICAgICAgICB6aXA6IHsgY29tcHJlc3M6IHRydWUgfSxcblxuICAgICAgICAgICAgbWV0aG9kIDogJ2J1bmRsZScsXG4gICAgICAgICAgICBmaWxlICAgOiBudWxsLFxuXG4gICAgICAgICAgICBmdW5jdGlvbnM6IHt9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogIFRoaXMgaXMgaW50ZW5kZWQgdG8gb3BlcmF0ZSBhcyBhIGJhc2UgY29uZmlndXJhdGlvbiBwYXNzZWQgdG8gZWFjaCBzdWIgY2xhc3MuXG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBTRVJWRVJMRVNTXG4gICAgICAgICAgICAvL1xuXG4gICAgICAgICAgICBzdXBlcigpXG4gICAgICAgICAgICB0aGlzLm5hbWUgPSAnU2VydmVybGVzc0J1aWxkUGx1Z2luJ1xuXG4gICAgICAgICAgICAvLyBQTFVHSU4gQ09ORklHIEdFTkVSQVRJT05cblxuICAgICAgICAgICAgY29uc3Qgc2VydmljZVBhdGggICAgID0gUy5jb25maWcucHJvamVjdFBhdGhcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkQ29uZmlnUGF0aCA9IHBhdGguam9pbihzZXJ2aWNlUGF0aCwgJy4vc2VydmVybGVzcy5idWlsZC55bWwnKVxuXG4gICAgICAgICAgICBjb25zdCBidWlsZENvbmZpZyA9IGZzLmV4aXN0c1N5bmMoYnVpbGRDb25maWdQYXRoKVxuICAgICAgICAgICAgICAgID8gWWFtbC5sb2FkKCBmcy5yZWFkRmlsZVN5bmMoYnVpbGRDb25maWdQYXRoKSApXG4gICAgICAgICAgICAgICAgOiB7fVxuXG4gICAgICAgICAgICB0aGlzLnNlcnZlcmxlc3MgPSB7XG4gICAgICAgICAgICAgICAgY29uZmlnOiB7IHNlcnZpY2VQYXRoOiBzZXJ2aWNlUGF0aCB9LFxuICAgICAgICAgICAgICAgIHNlcnZpY2U6IHsgcGFja2FnZToge30gfSxcbiAgICAgICAgICAgICAgICBjbGk6IFNDbGlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRoZSBjb25maWcgaW5oZXJpdHMgZnJvbSBtdWx0aXBsZSBzb3VyY2VzXG4gICAgICAgICAgICB0aGlzLmNvbmZpZyAgICA9IHtcbiAgICAgICAgICAgICAgICAuLi50aGlzLmNvbmZpZyxcbiAgICAgICAgICAgICAgICAuLi5idWlsZENvbmZpZyxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGluaXQoZSkge1xuICAgICAgICAgICAgY29uc3QgcHJvamVjdCA9IFMuZ2V0UHJvamVjdCgpXG5cbiAgICAgICAgICAgIGNvbnN0IHsgZnVuY3Rpb25zIH0gPSBwcm9qZWN0XG5cbiAgICAgICAgICAgIHRoaXMuc2VydmVybGVzcy5zZXJ2aWNlLnNlcnZpY2UgPSBwcm9qZWN0Lm5hbWVcblxuICAgICAgICAgICAgbGV0IHNlbGVjdGVkRnVuY3Rpb25zID0gdHlwZU9mLkFycmF5KHByb2plY3QuZ2V0RnVuY3Rpb24oZS5vcHRpb25zLm5hbWUpKVxuICAgICAgICAgICAgICAgID8gcHJvamVjdC5nZXRGdW5jdGlvbihlLm9wdGlvbnMubmFtZSlcbiAgICAgICAgICAgICAgICA6IFsgcHJvamVjdC5nZXRGdW5jdGlvbihlLm9wdGlvbnMubmFtZSkgXVxuXG5cbiAgICAgICAgICAgIHNlbGVjdGVkRnVuY3Rpb25zID0gc2VsZWN0ZWRGdW5jdGlvbnMuZmlsdGVyKChrZXkpID0+IGtleSBpbiBmdW5jdGlvbnMgKVxuICAgICAgICAgICAgc2VsZWN0ZWRGdW5jdGlvbnMgPSBzZWxlY3RlZEZ1bmN0aW9ucy5sZW5ndGggPyBzZWxlY3RlZEZ1bmN0aW9ucyA6IE9iamVjdC5rZXlzKGZ1bmN0aW9ucylcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiAgQW4gYXJyYXkgb2YgZnVsbCByZWFsaXplZCBmdW5jdGlvbnMgY29uZmlncyB0byBidWlsZCBhZ2FpbnN0LlxuICAgICAgICAgICAgICogIEluaGVyaXRzIGZyb21cbiAgICAgICAgICAgICAqICAtIHNlcnZlcmxlc3MueW1sIGZ1bmN0aW9ucy48Zm4+LnBhY2thZ2VcbiAgICAgICAgICAgICAqICAtIHNlcnZlcmxlc3MuYnVpbGQueW1sIGZ1bmN0aW9ucy48Zm4+XG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogIGluIG9yZGVyIHRvIGdlbmVyYXRlIGBpbmNsdWRlYCwgYGV4Y2x1ZGVgXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuZnVuY3Rpb25zID0gc2VsZWN0ZWRGdW5jdGlvbnMucmVkdWNlKChvYmosIGZuS2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZm5DZmcgICAgICA9IGZ1bmN0aW9uc1tmbktleV1cbiAgICAgICAgICAgICAgICBjb25zdCBmbkJ1aWxkQ2ZnID0gdGhpcy5jb25maWcuZnVuY3Rpb25zW2ZuS2V5XSB8fCB7fVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5jbHVkZSA9IFtcbiAgICAgICAgICAgICAgICAgICAgLi4uKCB0aGlzLmNvbmZpZy5pbmNsdWRlIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggKCBmbkNmZy5wYWNrYWdlICYmIGZuQ2ZnLnBhY2thZ2UuaW5jbHVkZSApIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggZm5CdWlsZENmZy5pbmNsdWRlIHx8IFtdIClcbiAgICAgICAgICAgICAgICBdXG5cbiAgICAgICAgICAgICAgICBjb25zdCBleGNsdWRlID0gW1xuICAgICAgICAgICAgICAgICAgICAuLi4oIHRoaXMuY29uZmlnLmJhc2VFeGNsdWRlIHx8IFtdICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggdGhpcy5jb25maWcuZXhjbHVkZSB8fCBbXSApLFxuICAgICAgICAgICAgICAgICAgICAuLi4oICggZm5DZmcucGFja2FnZSAmJiBmbkNmZy5wYWNrYWdlLmV4Y2x1ZGUgKSB8fCBbXSApLFxuICAgICAgICAgICAgICAgICAgICAuLi4oIGZuQnVpbGRDZmcuZXhjbHVkZSB8fCBbXSApXG4gICAgICAgICAgICAgICAgXVxuXG4gICAgICAgICAgICAgICAgLy8gVXRpbGl6ZSB0aGUgcHJvcG9zZWQgYHBhY2thZ2VgIGNvbmZpZ3VyYXRpb24gZm9yIGZ1bmN0aW9uc1xuICAgICAgICAgICAgICAgIG9ialtmbktleV0gPSB7XG4gICAgICAgICAgICAgICAgICAgIC4uLmZuQ2ZnLFxuXG4gICAgICAgICAgICAgICAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLiggZm5DZmcucGFja2FnZSB8fCB7fSApLFxuICAgICAgICAgICAgICAgICAgICAgICAgLi4uKCB0aGlzLmNvbmZpZy5mdW5jdGlvbnNbZm5LZXldIHx8IHt9ICksXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlLCBleGNsdWRlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqXG4gICAgICAgICAgICB9LCB7fSlcblxuICAgICAgICAgICAgLy8gY29uc29sZS5pbnNwZWN0KHsgb3B0aW9uczogdGhpcy5jb25maWcgfSlcbiAgICAgICAgICAgIC8vIGNvbnNvbGUuaW5zcGVjdCh7IGZ1bmN0aW9uczogdGhpcy5mdW5jdGlvbnMgfSlcblxuICAgICAgICAgICAgcmV0dXJuIGVcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIHJlZ2lzdGVyQWN0aW9ucygpIHtcbiAgICAgICAgICAgIFMuYWRkQWN0aW9uKHRoaXMuY29tcGxldGVBcnRpZmFjdC5iaW5kKHRoaXMpLCB7XG4gICAgICAgICAgICAgICAgaGFuZGxlcjogICAgICdidWlsZENvbXBsZXRlQXJ0aWZhY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQnVpbGRzIGFydGlmYWN0IGZvciBkZXBsb3ltZW50J1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgcmVnaXN0ZXJIb29rcygpIHtcbiAgICAgICAgICAgIFMuYWRkSG9vayh0aGlzLmluaXQuYmluZCh0aGlzKSwge1xuICAgICAgICAgICAgICAgIGFjdGlvbjogJ2Z1bmN0aW9uRGVwbG95JyxcbiAgICAgICAgICAgICAgICBldmVudDogJ3ByZSdcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBTLmFkZEhvb2sodGhpcy5idWlsZC5iaW5kKHRoaXMpLCB7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiAnY29kZURlcGxveUxhbWJkYScsXG4gICAgICAgICAgICAgICAgZXZlbnQ6ICdwcmUnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgYnVpbGQoZSkge1xuXG4gICAgICAgICAgICAvLyBUT0RPIGluIHRoZSBmdXR1cmU6XG4gICAgICAgICAgICAvLyAtIGNyZWF0ZSBzZXBlcmF0ZSB6aXBzXG4gICAgICAgICAgICAvLyAtIG1vZGlmeSBhcnRpZmFjdCBjb21wbGV0aW9uIHByb2Nlc3MsIHNwbGl0dGluZyBidWlsZHMgdXAgaW50byBzZXBlcmF0ZSBhcnRpZmFjdHNcblxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXJsZXNzLmNsaS5sb2coYFNlcnZlcmxlc3MgQnVpbGQgdHJpZ2dlcmVkIGZvciAke2Uub3B0aW9ucy5uYW1lfS4uLmApXG5cbiAgICAgICAgICAgIGNvbnN0IHsgbWV0aG9kIH0gICA9IHRoaXMuY29uZmlnXG4gICAgICAgICAgICBsZXQgbW9kdWxlSW5jbHVkZXMgPSBbXVxuICAgICAgICAgICAgbGV0IG1vZHVsZUV4Y2x1ZGVzID0gW11cblxuICAgICAgICAgICAgLy8gU2V0IGJ1aWxkIHBhdGhzXG4gICAgICAgICAgICB0aGlzLnRtcERpciAgICAgICAgID0gZS5vcHRpb25zLnBhdGhEaXN0XG4gICAgICAgICAgICB0aGlzLmJ1aWxkVG1wRGlyICAgID0gcGF0aC5qb2luKHRoaXMudG1wRGlyLCAnLi9idWlsZCcpXG4gICAgICAgICAgICB0aGlzLmFydGlmYWN0VG1wRGlyID0gcGF0aC5qb2luKGUub3B0aW9ucy5wYXRoRGlzdCwgJy4vYXJ0aWZhY3RzJylcbiAgICAgICAgICAgIHRoaXMuZGVwbG95VG1wRGlyICAgPSBwYXRoLmpvaW4oZS5vcHRpb25zLnBhdGhEaXN0LCAnLi9kZXBsb3knKVxuXG4gICAgICAgICAgICBhd2FpdCBmcy5lbnN1cmVEaXJBc3luYyh0aGlzLmJ1aWxkVG1wRGlyKVxuICAgICAgICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyQXN5bmModGhpcy5hcnRpZmFjdFRtcERpcilcblxuICAgICAgICAgICAgY29uc3QgYXJ0aWZhY3QgPSBuZXcgWWF6bC5aaXBGaWxlKClcblxuICAgICAgICAgICAgaWYgKCBtZXRob2QgPT09ICdidW5kbGUnICkge1xuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gU09VUkNFIEJVTkRMRVJcbiAgICAgICAgICAgICAgICAvL1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc291cmNlQnVuZGxlciA9IG5ldyBTb3VyY2VCdW5kbGVyKHtcbiAgICAgICAgICAgICAgICAgICAgLi4udGhpcy5jb25maWcsXG4gICAgICAgICAgICAgICAgICAgIHVnbGlmeSAgICAgIDogdGhpcy5jb25maWcudWdsaWZ5U291cmNlID8gdGhpcy5jb25maWcudWdsaWZ5IDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICBzZXJ2aWNlUGF0aCA6IFMuY29uZmlnLnByb2plY3RQYXRoXG4gICAgICAgICAgICAgICAgfSwgYXJ0aWZhY3QpXG5cbiAgICAgICAgICAgICAgICBmb3IgKCBjb25zdCBmbktleSBpbiB0aGlzLmZ1bmN0aW9ucyApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZuS2V5ID09PSBlLm9wdGlvbnMubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29uZmlnID0gdGhpcy5mdW5jdGlvbnNbZm5LZXldXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VydmVybGVzcy5jbGkubG9nKGBCdW5kbGluZyAke2ZuS2V5fS4uLmApXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN5bmNocm9ub3VzIGZvciBub3csIGJ1dCBjYW4gYmUgcGFyZWxsZWxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5wYWNrYWdlLmV4Y2x1ZGUucHVzaCgnX21ldGEnKVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzb3VyY2VCdW5kbGVyLmJ1bmRsZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhjbHVkZSA6IGNvbmZpZy5wYWNrYWdlLmV4Y2x1ZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZSA6IGNvbmZpZy5wYWNrYWdlLmluY2x1ZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICggbWV0aG9kID09PSAnZmlsZScgKSB7XG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBCVUlMRCBGSUxFXG4gICAgICAgICAgICAgICAgLy9cblxuICAgICAgICAgICAgICAgIC8vIFRoaXMgYnVpbGRzIGFsbCBmdW5jdGlvbnNcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlQnVpbGQgPSBhd2FpdCBuZXcgRmlsZUJ1aWxkKHtcbiAgICAgICAgICAgICAgICAgICAgLi4udGhpcy5jb25maWcsXG4gICAgICAgICAgICAgICAgICAgIHNlcnZpY2VQYXRoIDogUy5jb25maWcucHJvamVjdFBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkVG1wRGlyIDogdGhpcy5idWlsZFRtcERpcixcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb25zICAgOiB0aGlzLmZ1bmN0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgc2VydmVybGVzcyAgOiB0aGlzLnNlcnZlcmxlc3NcbiAgICAgICAgICAgICAgICB9LCBhcnRpZmFjdCkuYnVpbGQoKVxuXG4gICAgICAgICAgICAgICAgbW9kdWxlSW5jbHVkZXMgPSBbIC4uLmZpbGVCdWlsZC5leHRlcm5hbHMgXSAvLyBTcHJlYWQsIGZvciBhbiBpdGVyYXRvclxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIGJ1aWxkIG1ldGhvZCB1bmRlciBgY3VzdG9tLmJ1aWxkLm1ldGhvZGBcIilcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGZ1bmNNb2R1bGVFeGNsdWRlcyA9IFtdXG4gICAgICAgICAgICBpZiAodGhpcy5mdW5jdGlvbnNbZS5vcHRpb25zLm5hbWVdLnBhY2thZ2UubW9kdWxlcykge1xuICAgICAgICAgICAgICAgIGZ1bmNNb2R1bGVFeGNsdWRlcyA9IHRoaXMuZnVuY3Rpb25zW2Uub3B0aW9ucy5uYW1lXS5wYWNrYWdlLm1vZHVsZXMuZXhjbHVkZSB8fCBbXVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtb2R1bGVFeGNsdWRlcyA9IFsgLi4udGhpcy5jb25maWcubW9kdWxlcy5leGNsdWRlLCAuLi5mdW5jTW9kdWxlRXhjbHVkZXMgXVxuXG4gICAgICAgICAgICBhd2FpdCBuZXcgTW9kdWxlQnVuZGxlcih7XG4gICAgICAgICAgICAgICAgLi4udGhpcy5jb25maWcsXG4gICAgICAgICAgICAgICAgdWdsaWZ5ICAgICAgOiB0aGlzLmNvbmZpZy51Z2xpZnlNb2R1bGVzID8gdGhpcy5jb25maWcudWdsaWZ5IDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIHNlcnZpY2VQYXRoIDogUy5jb25maWcucHJvamVjdFBhdGhcbiAgICAgICAgICAgIH0sIGFydGlmYWN0KS5idW5kbGUoe1xuICAgICAgICAgICAgICAgIGluY2x1ZGU6IG1vZHVsZUluY2x1ZGVzLFxuICAgICAgICAgICAgICAgIGV4Y2x1ZGU6IG1vZHVsZUV4Y2x1ZGVzXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLyBTZXJ2ZXJsZXNzIDAuNSBoYWNrLCByZWJ1aWxkIGEgX3NlcnZlcmxlc3NfaGFuZGxlci5qcyBmaWxlIHdoaWxlIHN0aWxsIGtlZXBpbmcgZW52IHZhcnNcblxuICAgICAgICAgICAgY29uc3QgZnVuY09iaiA9IFMuZ2V0UHJvamVjdCgpLmdldEZ1bmN0aW9uKGUub3B0aW9ucy5uYW1lKVxuICAgICAgICAgICAgY29uc3QgZnVuY1BhdGggPSBwYXRoLnJlbGF0aXZlKFMuY29uZmlnLnByb2plY3RQYXRoLCBmdW5jT2JqLmdldFJvb3RQYXRoKCkpXG5cbiAgICAgICAgICAgIGNvbnN0IFsgaGFuZGxlckZpbGUsIGhhbmRsZXJGdW5jIF0gPSB0aGlzLmZ1bmN0aW9uc1tlLm9wdGlvbnMubmFtZV0uaGFuZGxlci5zcGxpdCgnLicpXG4gICAgICAgICAgICAvLyBSZWFkIGV4aXN0aW5nIGhhbmRsZXIgZnJvbSBmc1xuICAgICAgICAgICAgY29uc3Qgc2VydmVybGVzc0hhbmRsZXIgPSBmcy5yZWFkRmlsZVN5bmMoYCR7ZS5vcHRpb25zLnBhdGhEaXN0fS9fc2VydmVybGVzc19oYW5kbGVyLmpzYCwgJ3V0ZjgnKVxuICAgICAgICAgICAgLy8vIFJlcGxhY2UgZXhwb3J0ZWQgaGFuZGxlciB3aXRoIGNvcnJlY3QgcGF0aCBhcyBwZXIgYnVpbGQgcHJvY2Vzc1xuICAgICAgICAgICAgY29uc3Qgb2xkRXhwb3J0ID0gc2VydmVybGVzc0hhbmRsZXIubWF0Y2goL2V4cG9ydHNcXC5oYW5kbGVyID0gcmVxdWlyZVxcKFwiKC4qKVwiXFwpXFxbXCIoLiopXCJcXF07L2ltZylbMF1cbiAgICAgICAgICAgIGNvbnN0IG5ld0V4cG9ydCA9IGBleHBvcnRzLmhhbmRsZXIgPSByZXF1aXJlKFwiLi8ke2Z1bmNQYXRofS8ke2hhbmRsZXJGaWxlfVwiKVtcIiR7aGFuZGxlckZ1bmN9XCJdYFxuICAgICAgICAgICAgLy8gQWRkIGhhbmRsZXIgdG8gemlwXG4gICAgICAgICAgICBhcnRpZmFjdC5hZGRCdWZmZXIoIG5ldyBCdWZmZXIoc2VydmVybGVzc0hhbmRsZXIucmVwbGFjZShvbGRFeHBvcnQsIG5ld0V4cG9ydCkpLCAnX3NlcnZlcmxlc3NfaGFuZGxlci5qcycsIHRoaXMuY29uZmlnLnppcCApXG5cbiAgICAgICAgICAgIGUub3B0aW9ucy5hcnRpZmFjdCA9IGFydGlmYWN0XG5cbiAgICAgICAgICAgIHJldHVybiBTLmFjdGlvbnMuYnVpbGRDb21wbGV0ZUFydGlmYWN0KGUpXG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBjb21wbGV0ZUFydGlmYWN0KGUpIHtcbiAgICAgICAgICAgIHRoaXMuc2VydmVybGVzcy5jbGkubG9nKCdDb21waWxpbmcgZGVwbG95bWVudCBhcnRpZmFjdCcpXG4gICAgICAgICAgICBhd2FpdCB0aGlzLl9jb21wbGV0ZUFydGlmYWN0KHtcbiAgICAgICAgICAgICAgICBhcnRpZmFjdDogZS5vcHRpb25zLmFydGlmYWN0LFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uTmFtZTogZS5vcHRpb25zLm5hbWUsXG4gICAgICAgICAgICAgICAgYXJ0aWZhY3RUbXBEaXI6IGAke2Uub3B0aW9ucy5wYXRoRGlzdH0vYXJ0aWZhY3RzYFxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgY29uc3QgemlwUGF0aCA9IHRoaXMuc2VydmVybGVzcy5zZXJ2aWNlLnBhY2thZ2UuYXJ0aWZhY3RcblxuICAgICAgICAgICAgY29uc3QgZGVwbG95VG1wRGlyID0gcGF0aC5qb2luKGUub3B0aW9ucy5wYXRoRGlzdCwgJy4vZGVwbG95JylcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5fdW5wYWNrWmlwKHtcbiAgICAgICAgICAgICAgICB6aXBQYXRoLFxuICAgICAgICAgICAgICAgIGRlcGxveVRtcERpclxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgZS5vcHRpb25zLnBhdGhEaXN0ID0gZGVwbG95VG1wRGlyXG4gICAgICAgICAgICByZXR1cm4gZVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgX3VucGFja1ppcCh7IHppcFBhdGgsIGRlcGxveVRtcERpciB9KSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIFlhdXpsLm9wZW4oemlwUGF0aCwgeyBsYXp5RW50cmllczogdHJ1ZSB9LCAoZXJyLCB6aXBmaWxlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHRocm93IGVyclxuXG4gICAgICAgICAgICAgICAgICAgIHppcGZpbGUucmVhZEVudHJ5KClcbiAgICAgICAgICAgICAgICAgICAgemlwZmlsZS5vbihcImVudHJ5XCIsIGZ1bmN0aW9uKGVudHJ5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoL1xcLyQvLnRlc3QoZW50cnkuZmlsZU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGlyZWN0b3J5IGZpbGUgbmFtZXMgZW5kIHdpdGggJy8nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWtkaXJwKGAke2RlcGxveVRtcERpcn0vJHtlbnRyeS5maWxlTmFtZX1gLCBmdW5jdGlvbihta2RpckVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWtkaXJFcnIpIHRocm93IG1rZGlyRXJyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHppcGZpbGUucmVhZEVudHJ5KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmaWxlIGVudHJ5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgemlwZmlsZS5vcGVuUmVhZFN0cmVhbShlbnRyeSwgZnVuY3Rpb24ocnNFcnIsIHJlYWRTdHJlYW0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJzRXJyKSB0aHJvdyByc0VyclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgcGFyZW50IGRpcmVjdG9yeSBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWtkaXJwKHBhdGguZGlybmFtZShgJHtkZXBsb3lUbXBEaXJ9LyR7ZW50cnkuZmlsZU5hbWV9YCksIGZ1bmN0aW9uKG1rZGlyRXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWtkaXJFcnIpIHRocm93IG1rZGlyRXJyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWFkU3RyZWFtLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oYCR7ZGVwbG95VG1wRGlyfS8ke2VudHJ5LmZpbGVOYW1lfWApKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVhZFN0cmVhbS5vbihcImVuZFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB6aXBmaWxlLnJlYWRFbnRyeSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgemlwZmlsZS5vbmNlKFwiZW5kXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgemlwZmlsZS5jbG9zZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKClcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBXcml0ZXMgdGhlIGBhcnRpZmFjdGAgYW5kIGF0dGFjaGVzIGl0IHRvIHNlcnZlcmxlc3NcbiAgICAgICAgICovXG4gICAgICAgIGFzeW5jIF9jb21wbGV0ZUFydGlmYWN0KHsgYXJ0aWZhY3QsIGZ1bmN0aW9uTmFtZSwgYXJ0aWZhY3RUbXBEaXIgfSkge1xuICAgICAgICAgICAgLy8gUHVyZ2UgZXhpc3RpbmcgYXJ0aWZhY3RzXG4gICAgICAgICAgICBpZiAoICEgdGhpcy5jb25maWcua2VlcCApXG4gICAgICAgICAgICAgICAgYXdhaXQgZnMuZW1wdHlEaXJBc3luYyhhcnRpZmFjdFRtcERpcilcblxuICAgICAgICAgICAgY29uc3QgemlwUGF0aCA9IHBhdGgucmVzb2x2ZShhcnRpZmFjdFRtcERpciwgYC4vJHt0aGlzLnNlcnZlcmxlc3Muc2VydmljZS5zZXJ2aWNlfS0ke2Z1bmN0aW9uTmFtZX0tJHtuZXcgRGF0ZSgpLmdldFRpbWUoKX0uemlwYClcblxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIGFydGlmYWN0Lm91dHB1dFN0cmVhbS5waXBlKCBmcy5jcmVhdGVXcml0ZVN0cmVhbSh6aXBQYXRoKSApXG4gICAgICAgICAgICAgICAgLm9uKFwiZXJyb3JcIiwgcmVqZWN0KVxuICAgICAgICAgICAgICAgIC5vbihcImNsb3NlXCIsIHJlc29sdmUpXG5cbiAgICAgICAgICAgICAgICBhcnRpZmFjdC5lbmQoKVxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgdGhpcy5zZXJ2ZXJsZXNzLnNlcnZpY2UucGFja2FnZS5hcnRpZmFjdCA9IHppcFBhdGhcblxuICAgICAgICAgICAgLy8gUHVyZ2UgYnVpbGQgZGlyXG4gICAgICAgICAgICBpZiAoICEgdGhpcy5jb25maWcua2VlcCApXG4gICAgICAgICAgICAgICAgYXdhaXQgZnMuZW1wdHlEaXJBc3luYyh0aGlzLmJ1aWxkVG1wRGlyKVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICByZXR1cm4gU2VydmVybGVzc0J1aWxkUGx1Z2luXG59XG4iXX0=