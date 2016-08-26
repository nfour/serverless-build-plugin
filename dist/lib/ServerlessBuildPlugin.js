'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _yazl = require('yazl');

var _yazl2 = _interopRequireDefault(_yazl);

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

class ServerlessBuildPlugin {

    constructor(serverless) {
        var _this = this;

        let options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
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

        //
        // SERVERLESS
        //

        this.serverless = serverless;

        if (!this.serverless.getVersion().startsWith('1')) throw new this.serverless.classes.Error('serverless-build-plugin requires serverless@1.x.x');

        this.hooks = {
            'deploy': function deploy() {
                return console.log('wew');
            }, // doesn't fire
            'before:deploy:createDeploymentArtifacts': function beforeDeployCreateDeploymentArtifacts() {
                return _this.build.apply(_this, arguments);
            }, // doesn't fire
            'deploy:createDeploymentArtifacts': function deployCreateDeploymentArtifacts() {
                return _this.build.apply(_this, arguments);
            }, // doesn't fire
            'before:deploy:function:deploy': function beforeDeployFunctionDeploy() {
                return _this.build.apply(_this, arguments);
            }
        };

        //
        // PLUGIN CONFIG GENERATION
        //

        this.servicePath = this.serverless.config.servicePath;
        this.tmpDir = _path2.default.join(this.servicePath, './.serverless');
        this.buildTmpDir = _path2.default.join(this.tmpDir, './build');
        this.artifactTmpDir = _path2.default.join(this.tmpDir, './artifacts');

        const buildConfigPath = _path2.default.join(this.servicePath, './serverless.build.yml');

        const buildConfig = _fsExtra2.default.existsSync(buildConfigPath) ? _jsYaml2.default.load(_fsExtra2.default.readFileSync(buildConfigPath)) : {};

        // The config inherits from multiple sources
        this.config = _extends({}, this.config, this.serverless.service.custom.build || {}, buildConfig, options);

        const functions = this.serverless.service.functions;


        let selectedFunctions = _lutils.typeOf.Array(this.config.function) ? this.config.function : [this.config.function];

        selectedFunctions = selectedFunctions.filter(key => key in functions);
        selectedFunctions = selectedFunctions.length ? selectedFunctions : Object.keys(functions);

        /**
         *  An array of full realized functions configs to build against.
         *  Inherits from
         *  - serverless.yml functions.<fn>.package
         *  - serverless.build.yml functions.<fn>
         *
         *  in order to generate `include`, `exclude`
         */
        this.functions = selectedFunctions.reduce((obj, fnKey) => {
            const fnCfg = functions[fnKey];
            const fnBuildCfg = this.config.functions[fnKey] || {};

            const include = [].concat(_toConsumableArray(this.config.include || []), _toConsumableArray(fnCfg.package && fnCfg.package.include || []), _toConsumableArray(fnBuildCfg.include || []));

            const exclude = [].concat(_toConsumableArray(this.config.baseExclude || []), _toConsumableArray(this.config.exclude || []), _toConsumableArray(fnCfg.package && fnCfg.package.exclude || []), _toConsumableArray(fnBuildCfg.exclude || []));

            // Utilize the proposed `package` configuration for functions
            obj[fnKey] = _extends({}, fnCfg, {

                package: _extends({}, fnCfg.package || {}, this.config.functions[fnKey] || {}, {
                    include: include, exclude: exclude
                })
            });

            return obj;
        }, {});

        this.serverless.cli.log(`Serverless Build config:`);
        console.inspect(this.config);
    }

    /**
     *  Builds either from file or through the babel optimizer.
     */
    build() {
        var _this2 = this;

        return (0, _bluebird.coroutine)(function* () {
            // TODO in the future:
            // - create seperate zips
            // - modify artifact completion process, splitting builds up into seperate artifacts

            _this2.serverless.cli.log("Serverless Build triggered...");

            const method = _this2.config.method;

            let moduleIncludes = [];

            yield _fsExtra2.default.ensureDirAsync(_this2.buildTmpDir);
            yield _fsExtra2.default.ensureDirAsync(_this2.artifactTmpDir);

            const artifact = new _yazl2.default.ZipFile();

            if (method === 'bundle') {
                //
                // SOURCE BUNDLER
                //

                const sourceBundler = new _SourceBundler2.default(_extends({}, _this2.config, {
                    uglify: _this2.config.uglifySource ? _this2.config.uglify : undefined,
                    servicePath: _this2.servicePath
                }), artifact);

                for (const fnKey in _this2.functions) {
                    const config = _this2.functions[fnKey];

                    _this2.serverless.cli.log(`Bundling ${ fnKey }...`);

                    // Synchronous for now, but can be parellel
                    yield sourceBundler.bundle({
                        exclude: config.package.exclude,
                        include: config.package.include
                    });
                }
            } else if (method === 'file') {
                //
                // BUILD FILE
                //

                // This builds all functions
                const fileBuild = yield new _FileBuild2.default(_extends({}, _this2.config, {
                    servicePath: _this2.servicePath,
                    buildTmpDir: _this2.buildTmpDir,
                    functions: _this2.functions,
                    serverless: _this2.serverless
                }), artifact).build();

                moduleIncludes = [].concat(_toConsumableArray(fileBuild.externals)); // Spread, for an iterator
            } else {
                throw new Error("Unknown build method under `custom.build.method`");
            }

            yield new _ModuleBundler2.default(_extends({}, _this2.config, {
                uglify: _this2.config.uglifyModules ? _this2.config.uglify : undefined,
                servicePath: _this2.servicePath
            }), artifact).bundle({
                include: moduleIncludes,
                exclude: _this2.config.excludedExternals
            });

            yield _this2._completeArtifact(artifact);

            if (_this2.config.test) throw new Error("--test mode, DEBUGGING STOP");
        })();
    }

    /**
     *  Writes the `artifact` and attaches it to serverless
     */
    _completeArtifact(artifact) {
        var _this3 = this;

        return (0, _bluebird.coroutine)(function* () {
            // Purge existing artifacts
            if (!_this3.config.keep) yield _fsExtra2.default.emptyDirAsync(_this3.artifactTmpDir);

            const zipPath = _path2.default.resolve(_this3.artifactTmpDir, `./${ _this3.serverless.service.service }-${ new Date().getTime() }.zip`);

            yield new _bluebird2.default(function (resolve, reject) {
                artifact.outputStream.pipe(_fsExtra2.default.createWriteStream(zipPath)).on("error", reject).on("close", resolve);

                artifact.end();
            });

            _this3.serverless.service.package.artifact = zipPath;

            // Purge build dir
            if (!_this3.config.keep) yield _fsExtra2.default.emptyDirAsync(_this3.buildTmpDir);
        })();
    }
}
exports.default = ServerlessBuildPlugin;
module.exports = exports['default'];