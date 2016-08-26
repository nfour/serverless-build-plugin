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
                excludedExternals: ['aws-sdk'],
                baseExclude: [/\bnode_modules\b/],

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
                 *  to generate includes, excludes
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

                yield new _ModuleBundler2.default(_extends({}, _this4.config, {
                    uglify: _this4.config.uglifyModules ? _this4.config.uglify : undefined,
                    servicePath: S.config.projectPath
                }), artifact).bundle({
                    include: moduleIncludes,
                    exclude: _this4.config.excludedExternals
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