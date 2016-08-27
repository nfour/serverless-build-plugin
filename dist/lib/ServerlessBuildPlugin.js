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
            }), artifact).bundle(_extends({
                include: moduleIncludes
            }, _this2.config.modules));

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvU2VydmVybGVzc0J1aWxkUGx1Z2luLmpzIl0sIm5hbWVzIjpbInByb21pc2lmeUFsbCIsImNvbnNvbGUiLCJpbnNwZWN0IiwidmFsIiwiYXJncyIsImxvZyIsInJlcXVpcmUiLCJkZXB0aCIsImNvbG9ycyIsIlNlcnZlcmxlc3NCdWlsZFBsdWdpbiIsImNvbnN0cnVjdG9yIiwic2VydmVybGVzcyIsIm9wdGlvbnMiLCJjb25maWciLCJ0cnlGaWxlcyIsImJhc2VFeGNsdWRlIiwibW9kdWxlcyIsImV4Y2x1ZGUiLCJkZWVwRXhjbHVkZSIsImluY2x1ZGUiLCJ1Z2xpZnkiLCJ1Z2xpZnlTb3VyY2UiLCJ1Z2xpZnlNb2R1bGVzIiwiYmFiZWwiLCJzb3VyY2VNYXBzIiwiemlwIiwiY29tcHJlc3MiLCJtZXRob2QiLCJmaWxlIiwiZnVuY3Rpb25zIiwiZ2V0VmVyc2lvbiIsInN0YXJ0c1dpdGgiLCJjbGFzc2VzIiwiRXJyb3IiLCJob29rcyIsImJ1aWxkIiwic2VydmljZVBhdGgiLCJ0bXBEaXIiLCJqb2luIiwiYnVpbGRUbXBEaXIiLCJhcnRpZmFjdFRtcERpciIsImJ1aWxkQ29uZmlnUGF0aCIsImJ1aWxkQ29uZmlnIiwiZXhpc3RzU3luYyIsImxvYWQiLCJyZWFkRmlsZVN5bmMiLCJzZXJ2aWNlIiwiY3VzdG9tIiwic2VsZWN0ZWRGdW5jdGlvbnMiLCJBcnJheSIsImZ1bmN0aW9uIiwiZmlsdGVyIiwia2V5IiwibGVuZ3RoIiwiT2JqZWN0Iiwia2V5cyIsInJlZHVjZSIsIm9iaiIsImZuS2V5IiwiZm5DZmciLCJmbkJ1aWxkQ2ZnIiwicGFja2FnZSIsImNsaSIsIm1vZHVsZUluY2x1ZGVzIiwiZW5zdXJlRGlyQXN5bmMiLCJhcnRpZmFjdCIsIlppcEZpbGUiLCJzb3VyY2VCdW5kbGVyIiwidW5kZWZpbmVkIiwiYnVuZGxlIiwiZmlsZUJ1aWxkIiwiZXh0ZXJuYWxzIiwiX2NvbXBsZXRlQXJ0aWZhY3QiLCJ0ZXN0Iiwia2VlcCIsImVtcHR5RGlyQXN5bmMiLCJ6aXBQYXRoIiwicmVzb2x2ZSIsIkRhdGUiLCJnZXRUaW1lIiwicmVqZWN0Iiwib3V0cHV0U3RyZWFtIiwicGlwZSIsImNyZWF0ZVdyaXRlU3RyZWFtIiwib24iLCJlbmQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7OztBQUVBLG1CQUFRQSxZQUFSOztBQUVBO0FBQ0FDLFFBQVFDLE9BQVIsR0FBa0IsVUFBQ0MsR0FBRDtBQUFBLHNDQUFTQyxJQUFUO0FBQVNBLFlBQVQ7QUFBQTs7QUFBQSxXQUFrQkgsUUFBUUksR0FBUixDQUFhQyxRQUFRLE1BQVIsRUFBZ0JKLE9BQWhCLENBQXdCQyxHQUF4QixhQUErQkksT0FBTyxDQUF0QyxFQUF5Q0MsUUFBUSxJQUFqRCxJQUEwREosSUFBMUQsRUFBYixDQUFsQjtBQUFBLENBQWxCOztBQUVlLE1BQU1LLHFCQUFOLENBQTRCOztBQTZCdkNDLGdCQUFZQyxVQUFaLEVBQXNDO0FBQUE7O0FBQUEsWUFBZEMsT0FBYyx5REFBSixFQUFJO0FBQUEsYUE1QnRDQyxNQTRCc0MsR0E1QjdCO0FBQ0xDLHNCQUFjLENBQUUsbUJBQUYsQ0FEVDtBQUVMQyx5QkFBYyxDQUFFLGtCQUFGLENBRlQ7O0FBSUxDLHFCQUFTO0FBQ0xDLHlCQUFjLENBQUUsU0FBRixDQURULEVBQ3dCO0FBQzdCQyw2QkFBYyxDQUFFLFNBQUYsQ0FGVCxFQUpKOztBQVNMRCxxQkFBVSxFQVRMO0FBVUxFLHFCQUFVLEVBVkw7O0FBWUxDLG9CQUFnQixJQVpYO0FBYUxDLDBCQUFnQixLQWJYO0FBY0xDLDJCQUFnQixJQWRYOztBQWdCTEMsbUJBQWEsSUFoQlI7QUFpQkxDLHdCQUFhLElBakJSOztBQW1CTDtBQUNBQyxpQkFBSyxFQUFFQyxVQUFVLElBQVosRUFwQkE7O0FBc0JMQyxvQkFBUyxRQXRCSjtBQXVCTEMsa0JBQVMsSUF2Qko7O0FBeUJMQyx1QkFBVztB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WyJpbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCdcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgWWF6bCBmcm9tICd5YXpsJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzLWV4dHJhJ1xuaW1wb3J0IHsgdHlwZU9mIH0gZnJvbSAnbHV0aWxzJ1xuaW1wb3J0IFlhbWwgZnJvbSAnanMteWFtbCdcblxuaW1wb3J0IE1vZHVsZUJ1bmRsZXIgZnJvbSAnLi9Nb2R1bGVCdW5kbGVyJ1xuaW1wb3J0IFNvdXJjZUJ1bmRsZXIgZnJvbSAnLi9Tb3VyY2VCdW5kbGVyJ1xuaW1wb3J0IEZpbGVCdWlsZCBmcm9tICcuL0ZpbGVCdWlsZCdcblxuUHJvbWlzZS5wcm9taXNpZnlBbGwoZnMpXG5cbi8vIEZJWE1FOiBmb3IgZGVidWdnaW5nLCByZW1vdmUgbGF0ZXJcbmNvbnNvbGUuaW5zcGVjdCA9ICh2YWwsIC4uLmFyZ3MpID0+IGNvbnNvbGUubG9nKCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdCh2YWwsIHsgZGVwdGg6IDYsIGNvbG9yczogdHJ1ZSwgLi4uYXJncyB9KSApXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNlcnZlcmxlc3NCdWlsZFBsdWdpbiB7XG4gICAgY29uZmlnID0ge1xuICAgICAgICB0cnlGaWxlcyAgICA6IFsgXCJ3ZWJwYWNrLmNvbmZpZy5qc1wiIF0sXG4gICAgICAgIGJhc2VFeGNsdWRlIDogWyAvXFxibm9kZV9tb2R1bGVzXFxiLyBdLFxuXG4gICAgICAgIG1vZHVsZXM6IHtcbiAgICAgICAgICAgIGV4Y2x1ZGUgICAgIDogWyAnYXdzLXNkaycgXSwgLy8gVGhlc2UgbWF0Y2ggcm9vdCBkZXBlbmRlbmNpZXNcbiAgICAgICAgICAgIGRlZXBFeGNsdWRlIDogWyAnYXdzLXNkaycgXSwgLy8gVGhlc2UgbWF0Y2ggZGVlcCBkZXBlbmRlbmNpZXNcbiAgICAgICAgfSxcblxuICAgICAgICBleGNsdWRlIDogW10sXG4gICAgICAgIGluY2x1ZGUgOiBbXSxcblxuICAgICAgICB1Z2xpZnkgICAgICAgIDogdHJ1ZSxcbiAgICAgICAgdWdsaWZ5U291cmNlICA6IGZhbHNlLFxuICAgICAgICB1Z2xpZnlNb2R1bGVzIDogdHJ1ZSxcblxuICAgICAgICBiYWJlbCAgICAgIDogbnVsbCxcbiAgICAgICAgc291cmNlTWFwcyA6IHRydWUsXG5cbiAgICAgICAgLy8gUGFzc2VkIHRvIGB5YXpsYCBhcyBvcHRpb25zXG4gICAgICAgIHppcDogeyBjb21wcmVzczogdHJ1ZSB9LFxuXG4gICAgICAgIG1ldGhvZCA6ICdidW5kbGUnLFxuICAgICAgICBmaWxlICAgOiBudWxsLFxuXG4gICAgICAgIGZ1bmN0aW9uczoge31cbiAgICB9XG5cbiAgICBjb25zdHJ1Y3RvcihzZXJ2ZXJsZXNzLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgLy9cbiAgICAgICAgLy8gU0VSVkVSTEVTU1xuICAgICAgICAvL1xuXG4gICAgICAgIHRoaXMuc2VydmVybGVzcyA9IHNlcnZlcmxlc3NcblxuICAgICAgICBpZiAoICEgdGhpcy5zZXJ2ZXJsZXNzLmdldFZlcnNpb24oKS5zdGFydHNXaXRoKCcxJykgKVxuICAgICAgICAgICAgdGhyb3cgbmV3IHRoaXMuc2VydmVybGVzcy5jbGFzc2VzLkVycm9yKFxuICAgICAgICAgICAgICAgICdzZXJ2ZXJsZXNzLWJ1aWxkLXBsdWdpbiByZXF1aXJlcyBzZXJ2ZXJsZXNzQDEueC54J1xuICAgICAgICAgICAgKVxuXG4gICAgICAgIHRoaXMuaG9va3MgPSB7XG4gICAgICAgICAgICAnZGVwbG95JyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6ICguLi5hcmdzKSA9PiBjb25zb2xlLmxvZygnd2V3JyksIC8vIGRvZXNuJ3QgZmlyZVxuICAgICAgICAgICAgJ2JlZm9yZTpkZXBsb3k6Y3JlYXRlRGVwbG95bWVudEFydGlmYWN0cycgOiAoLi4uYXJncykgPT4gdGhpcy5idWlsZCguLi5hcmdzKSwgLy8gZG9lc24ndCBmaXJlXG4gICAgICAgICAgICAnZGVwbG95OmNyZWF0ZURlcGxveW1lbnRBcnRpZmFjdHMnICAgICAgICA6ICguLi5hcmdzKSA9PiB0aGlzLmJ1aWxkKC4uLmFyZ3MpLCAvLyBkb2Vzbid0IGZpcmVcbiAgICAgICAgICAgICdiZWZvcmU6ZGVwbG95OmZ1bmN0aW9uOmRlcGxveScgICAgICAgICAgIDogKC4uLmFyZ3MpID0+IHRoaXMuYnVpbGQoLi4uYXJncyksXG4gICAgICAgIH1cblxuICAgICAgICAvL1xuICAgICAgICAvLyBQTFVHSU4gQ09ORklHIEdFTkVSQVRJT05cbiAgICAgICAgLy9cblxuICAgICAgICB0aGlzLnNlcnZpY2VQYXRoICAgID0gdGhpcy5zZXJ2ZXJsZXNzLmNvbmZpZy5zZXJ2aWNlUGF0aFxuICAgICAgICB0aGlzLnRtcERpciAgICAgICAgID0gcGF0aC5qb2luKHRoaXMuc2VydmljZVBhdGgsICcuLy5zZXJ2ZXJsZXNzJylcbiAgICAgICAgdGhpcy5idWlsZFRtcERpciAgICA9IHBhdGguam9pbih0aGlzLnRtcERpciwgJy4vYnVpbGQnKVxuICAgICAgICB0aGlzLmFydGlmYWN0VG1wRGlyID0gcGF0aC5qb2luKHRoaXMudG1wRGlyLCAnLi9hcnRpZmFjdHMnKVxuXG4gICAgICAgIGNvbnN0IGJ1aWxkQ29uZmlnUGF0aCA9IHBhdGguam9pbih0aGlzLnNlcnZpY2VQYXRoLCAnLi9zZXJ2ZXJsZXNzLmJ1aWxkLnltbCcpXG5cbiAgICAgICAgY29uc3QgYnVpbGRDb25maWcgPSBmcy5leGlzdHNTeW5jKGJ1aWxkQ29uZmlnUGF0aClcbiAgICAgICAgICAgID8gWWFtbC5sb2FkKCBmcy5yZWFkRmlsZVN5bmMoYnVpbGRDb25maWdQYXRoKSApXG4gICAgICAgICAgICA6IHt9XG5cbiAgICAgICAgLy8gVGhlIGNvbmZpZyBpbmhlcml0cyBmcm9tIG11bHRpcGxlIHNvdXJjZXNcbiAgICAgICAgdGhpcy5jb25maWcgPSB7XG4gICAgICAgICAgICAuLi50aGlzLmNvbmZpZyxcbiAgICAgICAgICAgIC4uLiggdGhpcy5zZXJ2ZXJsZXNzLnNlcnZpY2UuY3VzdG9tLmJ1aWxkIHx8IHt9ICksXG4gICAgICAgICAgICAuLi5idWlsZENvbmZpZyxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGZ1bmN0aW9ucyB9ID0gdGhpcy5zZXJ2ZXJsZXNzLnNlcnZpY2VcblxuICAgICAgICBsZXQgc2VsZWN0ZWRGdW5jdGlvbnMgPSB0eXBlT2YuQXJyYXkodGhpcy5jb25maWcuZnVuY3Rpb24pXG4gICAgICAgICAgICA/IHRoaXMuY29uZmlnLmZ1bmN0aW9uXG4gICAgICAgICAgICA6IFsgdGhpcy5jb25maWcuZnVuY3Rpb24gXVxuXG4gICAgICAgIHNlbGVjdGVkRnVuY3Rpb25zID0gc2VsZWN0ZWRGdW5jdGlvbnMuZmlsdGVyKChrZXkpID0+IGtleSBpbiBmdW5jdGlvbnMgKVxuICAgICAgICBzZWxlY3RlZEZ1bmN0aW9ucyA9IHNlbGVjdGVkRnVuY3Rpb25zLmxlbmd0aCA/IHNlbGVjdGVkRnVuY3Rpb25zIDogT2JqZWN0LmtleXMoZnVuY3Rpb25zKVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgQW4gYXJyYXkgb2YgZnVsbCByZWFsaXplZCBmdW5jdGlvbnMgY29uZmlncyB0byBidWlsZCBhZ2FpbnN0LlxuICAgICAgICAgKiAgSW5oZXJpdHMgZnJvbVxuICAgICAgICAgKiAgLSBzZXJ2ZXJsZXNzLnltbCBmdW5jdGlvbnMuPGZuPi5wYWNrYWdlXG4gICAgICAgICAqICAtIHNlcnZlcmxlc3MuYnVpbGQueW1sIGZ1bmN0aW9ucy48Zm4+XG4gICAgICAgICAqXG4gICAgICAgICAqICBpbiBvcmRlciB0byBnZW5lcmF0ZSBgaW5jbHVkZWAsIGBleGNsdWRlYFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5mdW5jdGlvbnMgPSBzZWxlY3RlZEZ1bmN0aW9ucy5yZWR1Y2UoKG9iaiwgZm5LZXkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZuQ2ZnICAgICAgPSBmdW5jdGlvbnNbZm5LZXldXG4gICAgICAgICAgICBjb25zdCBmbkJ1aWxkQ2ZnID0gdGhpcy5jb25maWcuZnVuY3Rpb25zW2ZuS2V5XSB8fCB7fVxuXG4gICAgICAgICAgICBjb25zdCBpbmNsdWRlID0gW1xuICAgICAgICAgICAgICAgIC4uLiggdGhpcy5jb25maWcuaW5jbHVkZSB8fCBbXSApLFxuICAgICAgICAgICAgICAgIC4uLiggKCBmbkNmZy5wYWNrYWdlICYmIGZuQ2ZnLnBhY2thZ2UuaW5jbHVkZSApIHx8IFtdICksXG4gICAgICAgICAgICAgICAgLi4uKCBmbkJ1aWxkQ2ZnLmluY2x1ZGUgfHwgW10gKVxuICAgICAgICAgICAgXVxuXG4gICAgICAgICAgICBjb25zdCBleGNsdWRlID0gW1xuICAgICAgICAgICAgICAgIC4uLiggdGhpcy5jb25maWcuYmFzZUV4Y2x1ZGUgfHwgW10gKSxcbiAgICAgICAgICAgICAgICAuLi4oIHRoaXMuY29uZmlnLmV4Y2x1ZGUgfHwgW10gKSxcbiAgICAgICAgICAgICAgICAuLi4oICggZm5DZmcucGFja2FnZSAmJiBmbkNmZy5wYWNrYWdlLmV4Y2x1ZGUgKSB8fCBbXSApLFxuICAgICAgICAgICAgICAgIC4uLiggZm5CdWlsZENmZy5leGNsdWRlIHx8IFtdIClcbiAgICAgICAgICAgIF1cblxuICAgICAgICAgICAgLy8gVXRpbGl6ZSB0aGUgcHJvcG9zZWQgYHBhY2thZ2VgIGNvbmZpZ3VyYXRpb24gZm9yIGZ1bmN0aW9uc1xuICAgICAgICAgICAgb2JqW2ZuS2V5XSA9IHtcbiAgICAgICAgICAgICAgICAuLi5mbkNmZyxcblxuICAgICAgICAgICAgICAgIHBhY2thZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uKCBmbkNmZy5wYWNrYWdlIHx8IHt9ICksXG4gICAgICAgICAgICAgICAgICAgIC4uLiggdGhpcy5jb25maWcuZnVuY3Rpb25zW2ZuS2V5XSB8fCB7fSApLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlLCBleGNsdWRlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gb2JqXG4gICAgICAgIH0sIHt9KVxuXG4gICAgICAgIHRoaXMuc2VydmVybGVzcy5jbGkubG9nKGBTZXJ2ZXJsZXNzIEJ1aWxkIGNvbmZpZzpgKVxuICAgICAgICBjb25zb2xlLmluc3BlY3QodGhpcy5jb25maWcpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogIEJ1aWxkcyBlaXRoZXIgZnJvbSBmaWxlIG9yIHRocm91Z2ggdGhlIGJhYmVsIG9wdGltaXplci5cbiAgICAgKi9cbiAgICBhc3luYyBidWlsZCgpIHtcbiAgICAgICAgLy8gVE9ETyBpbiB0aGUgZnV0dXJlOlxuICAgICAgICAvLyAtIGNyZWF0ZSBzZXBlcmF0ZSB6aXBzXG4gICAgICAgIC8vIC0gbW9kaWZ5IGFydGlmYWN0IGNvbXBsZXRpb24gcHJvY2Vzcywgc3BsaXR0aW5nIGJ1aWxkcyB1cCBpbnRvIHNlcGVyYXRlIGFydGlmYWN0c1xuXG4gICAgICAgIHRoaXMuc2VydmVybGVzcy5jbGkubG9nKFwiU2VydmVybGVzcyBCdWlsZCB0cmlnZ2VyZWQuLi5cIilcblxuICAgICAgICBjb25zdCB7IG1ldGhvZCB9ICAgPSB0aGlzLmNvbmZpZ1xuICAgICAgICBsZXQgbW9kdWxlSW5jbHVkZXMgPSBbXVxuXG4gICAgICAgIGF3YWl0IGZzLmVuc3VyZURpckFzeW5jKHRoaXMuYnVpbGRUbXBEaXIpXG4gICAgICAgIGF3YWl0IGZzLmVuc3VyZURpckFzeW5jKHRoaXMuYXJ0aWZhY3RUbXBEaXIpXG5cbiAgICAgICAgY29uc3QgYXJ0aWZhY3QgPSBuZXcgWWF6bC5aaXBGaWxlKClcblxuICAgICAgICBpZiAoIG1ldGhvZCA9PT0gJ2J1bmRsZScgKSB7XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gU09VUkNFIEJVTkRMRVJcbiAgICAgICAgICAgIC8vXG5cbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZUJ1bmRsZXIgPSBuZXcgU291cmNlQnVuZGxlcih7XG4gICAgICAgICAgICAgICAgLi4udGhpcy5jb25maWcsXG4gICAgICAgICAgICAgICAgdWdsaWZ5ICAgICAgOiB0aGlzLmNvbmZpZy51Z2xpZnlTb3VyY2UgPyB0aGlzLmNvbmZpZy51Z2xpZnkgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgc2VydmljZVBhdGggOiB0aGlzLnNlcnZpY2VQYXRoXG4gICAgICAgICAgICB9LCBhcnRpZmFjdClcblxuICAgICAgICAgICAgZm9yICggY29uc3QgZm5LZXkgaW4gdGhpcy5mdW5jdGlvbnMgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29uZmlnID0gdGhpcy5mdW5jdGlvbnNbZm5LZXldXG5cbiAgICAgICAgICAgICAgICB0aGlzLnNlcnZlcmxlc3MuY2xpLmxvZyhgQnVuZGxpbmcgJHtmbktleX0uLi5gKVxuXG4gICAgICAgICAgICAgICAgLy8gU3luY2hyb25vdXMgZm9yIG5vdywgYnV0IGNhbiBiZSBwYXJlbGxlbFxuICAgICAgICAgICAgICAgIGF3YWl0IHNvdXJjZUJ1bmRsZXIuYnVuZGxlKHtcbiAgICAgICAgICAgICAgICAgICAgZXhjbHVkZSA6IGNvbmZpZy5wYWNrYWdlLmV4Y2x1ZGUsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1ZGUgOiBjb25maWcucGFja2FnZS5pbmNsdWRlLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZVxuICAgICAgICBpZiAoIG1ldGhvZCA9PT0gJ2ZpbGUnICkge1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIEJVSUxEIEZJTEVcbiAgICAgICAgICAgIC8vXG5cbiAgICAgICAgICAgIC8vIFRoaXMgYnVpbGRzIGFsbCBmdW5jdGlvbnNcbiAgICAgICAgICAgIGNvbnN0IGZpbGVCdWlsZCA9IGF3YWl0IG5ldyBGaWxlQnVpbGQoe1xuICAgICAgICAgICAgICAgIC4uLnRoaXMuY29uZmlnLFxuICAgICAgICAgICAgICAgIHNlcnZpY2VQYXRoIDogdGhpcy5zZXJ2aWNlUGF0aCxcbiAgICAgICAgICAgICAgICBidWlsZFRtcERpciA6IHRoaXMuYnVpbGRUbXBEaXIsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25zICAgOiB0aGlzLmZ1bmN0aW9ucyxcbiAgICAgICAgICAgICAgICBzZXJ2ZXJsZXNzICA6IHRoaXMuc2VydmVybGVzc1xuICAgICAgICAgICAgfSwgYXJ0aWZhY3QpLmJ1aWxkKClcblxuICAgICAgICAgICAgbW9kdWxlSW5jbHVkZXMgPSBbIC4uLmZpbGVCdWlsZC5leHRlcm5hbHMgXSAvLyBTcHJlYWQsIGZvciBhbiBpdGVyYXRvclxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBidWlsZCBtZXRob2QgdW5kZXIgYGN1c3RvbS5idWlsZC5tZXRob2RgXCIpXG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBuZXcgTW9kdWxlQnVuZGxlcih7XG4gICAgICAgICAgICAuLi50aGlzLmNvbmZpZyxcbiAgICAgICAgICAgIHVnbGlmeSAgICAgIDogdGhpcy5jb25maWcudWdsaWZ5TW9kdWxlcyA/IHRoaXMuY29uZmlnLnVnbGlmeSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHNlcnZpY2VQYXRoIDogdGhpcy5zZXJ2aWNlUGF0aFxuICAgICAgICB9LCBhcnRpZmFjdCkuYnVuZGxlKHtcbiAgICAgICAgICAgIGluY2x1ZGU6IG1vZHVsZUluY2x1ZGVzLFxuICAgICAgICAgICAgLi4udGhpcy5jb25maWcubW9kdWxlc1xuICAgICAgICB9KVxuXG4gICAgICAgIGF3YWl0IHRoaXMuX2NvbXBsZXRlQXJ0aWZhY3QoYXJ0aWZhY3QpXG5cbiAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy50ZXN0IClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIi0tdGVzdCBtb2RlLCBERUJVR0dJTkcgU1RPUFwiKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBXcml0ZXMgdGhlIGBhcnRpZmFjdGAgYW5kIGF0dGFjaGVzIGl0IHRvIHNlcnZlcmxlc3NcbiAgICAgKi9cbiAgICBhc3luYyBfY29tcGxldGVBcnRpZmFjdChhcnRpZmFjdCkge1xuICAgICAgICAvLyBQdXJnZSBleGlzdGluZyBhcnRpZmFjdHNcbiAgICAgICAgaWYgKCAhIHRoaXMuY29uZmlnLmtlZXAgKVxuICAgICAgICAgICAgYXdhaXQgZnMuZW1wdHlEaXJBc3luYyh0aGlzLmFydGlmYWN0VG1wRGlyKVxuXG4gICAgICAgIGNvbnN0IHppcFBhdGggPSBwYXRoLnJlc29sdmUodGhpcy5hcnRpZmFjdFRtcERpciwgYC4vJHt0aGlzLnNlcnZlcmxlc3Muc2VydmljZS5zZXJ2aWNlfS0ke25ldyBEYXRlKCkuZ2V0VGltZSgpfS56aXBgKVxuXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGFydGlmYWN0Lm91dHB1dFN0cmVhbS5waXBlKCBmcy5jcmVhdGVXcml0ZVN0cmVhbSh6aXBQYXRoKSApXG4gICAgICAgICAgICAgICAgLm9uKFwiZXJyb3JcIiwgcmVqZWN0KVxuICAgICAgICAgICAgICAgIC5vbihcImNsb3NlXCIsIHJlc29sdmUpXG5cbiAgICAgICAgICAgIGFydGlmYWN0LmVuZCgpXG4gICAgICAgIH0pXG5cbiAgICAgICAgdGhpcy5zZXJ2ZXJsZXNzLnNlcnZpY2UucGFja2FnZS5hcnRpZmFjdCA9IHppcFBhdGhcblxuICAgICAgICAvLyBQdXJnZSBidWlsZCBkaXJcbiAgICAgICAgaWYgKCAhIHRoaXMuY29uZmlnLmtlZXAgKVxuICAgICAgICAgICAgYXdhaXQgZnMuZW1wdHlEaXJBc3luYyh0aGlzLmJ1aWxkVG1wRGlyKVxuICAgIH1cbn1cbiJdfQ==