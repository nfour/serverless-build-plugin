'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lutils = require('lutils');

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _isStream = require('is-stream');

var _isStream2 = _interopRequireDefault(_isStream);

var _Webpack = require('./Webpack');

var _Webpack2 = _interopRequireDefault(_Webpack);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

_bluebird2.default.promisifyAll(_fsExtra2.default);

class FileBuild {
    constructor(config, artifact) {
        this.config = _extends({
            servicePath: '', // ./
            buildTmpDir: '', // ./.serverless/build
            zip: null, // Yazl zip options
            functions: {}, // Realized function configs
            tryFiles: [], // Array of relative paths to test for a build file
            serverless: null }, config);
        this.artifact = artifact;
        this.externals = new Set();
    }

    /**
     *  Handles building from a build file's output.
     */
    build() {
        var _this = this;

        return (0, _bluebird.coroutine)(function* () {
            //
            // RESOLVE BUILD FILE
            //

            let builderFilePath = yield _this._tryBuildFiles();

            if (!builderFilePath) throw new Error("Unrecognized build file path");

            builderFilePath = _path2.default.resolve(_this.config.servicePath, builderFilePath);

            let result = require(builderFilePath);

            // Resolve any functions...
            if (_lutils.typeOf.Function(result)) result = yield _bluebird2.default.try(function () {
                return result(_this);
            });

            //
            // HANDLE RESULT OUTPUT:
            //
            // - String, Buffer or Stream:   piped as 'handler.js' into zip
            // - Webpack Config:             executed and output files are zipped
            //

            if (_lutils.typeOf.Object(result)) {
                //
                // WEBPACK CONFIG
                //

                const functions = _this.config.functions;


                let entryPoints = [];
                for (let fnName in functions) {
                    const entry = functions[fnName].handler.split(/\.[^\.]+$/)[0] || '';

                    if (entryPoints.indexOf(entry) < 0) entryPoints.push(entry);
                }

                // TODO: loop over each function and build seperately.
                // Set result.output.path and filename

                entryPoints = entryPoints.map(function (filePath) {
                    return `./${ filePath }.js`;
                });

                result.entry = [].concat(_toConsumableArray(result.entry || []), _toConsumableArray(entryPoints));

                var _ref = yield new _Webpack2.default(_this.config).build(result);

                const externals = _ref.externals;


                for (let ext of externals) _this.externals.add(ext);['handler.js', `handler.js.map`].map((() => {
                    var _ref2 = (0, _bluebird.coroutine)(function* (relPath) {
                        const filePath = _path2.default.resolve(_this.config.buildTmpDir, relPath);

                        const stats = yield _fsExtra2.default.statAsync(filePath);

                        // Ensure file exists first
                        if (stats.isFile()) _this.artifact.addFile(filePath, relPath, _this.config.zip);
                    });

                    return function (_x) {
                        return _ref2.apply(this, arguments);
                    };
                })());
            } else if (_lutils.typeOf.String(result) || result instanceof Buffer) {
                //
                // STRINGS, BUFFERS
                //

                if (_lutils.typeOf.String(result)) result = new Buffer(result);

                _this.artifact.addBuffer(result, 'handler.js', _this.config.zip);
            } else if ((0, _isStream2.default)(result)) {
                //
                // STREAMS
                //

                _this.artifact.addReadStream(result, 'handler.js', _this.config.zip);
            } else {
                throw new Error("Unrecognized build output");
            }

            // TODO: read from serverless.yml -> package.includes for extenerals as well as excludes

            return _this;
        })();
    }

    /**
     *  Allows for build files to be auto selected
     */
    _tryBuildFiles() {
        var _this2 = this;

        return (0, _bluebird.coroutine)(function* () {
            for (let fileName of _this2.config.tryFiles) {
                const exists = yield _fsExtra2.default.statAsync(fileName).then(function (stat) {
                    return stat.isFile();
                });

                if (exists) return fileName;
            }

            return null;
        })();
    }
}
exports.default = FileBuild;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvRmlsZUJ1aWxkLmpzIl0sIm5hbWVzIjpbInByb21pc2lmeUFsbCIsIkZpbGVCdWlsZCIsImNvbnN0cnVjdG9yIiwiY29uZmlnIiwiYXJ0aWZhY3QiLCJzZXJ2aWNlUGF0aCIsImJ1aWxkVG1wRGlyIiwiemlwIiwiZnVuY3Rpb25zIiwidHJ5RmlsZXMiLCJzZXJ2ZXJsZXNzIiwiZXh0ZXJuYWxzIiwiU2V0IiwiYnVpbGQiLCJidWlsZGVyRmlsZVBhdGgiLCJfdHJ5QnVpbGRGaWxlcyIsIkVycm9yIiwicmVzb2x2ZSIsInJlc3VsdCIsInJlcXVpcmUiLCJGdW5jdGlvbiIsInRyeSIsIk9iamVjdCIsImVudHJ5UG9pbnRzIiwiZm5OYW1lIiwiZW50cnkiLCJoYW5kbGVyIiwic3BsaXQiLCJpbmRleE9mIiwicHVzaCIsIm1hcCIsImZpbGVQYXRoIiwiZXh0IiwiYWRkIiwicmVsUGF0aCIsInN0YXRzIiwic3RhdEFzeW5jIiwiaXNGaWxlIiwiYWRkRmlsZSIsIlN0cmluZyIsIkJ1ZmZlciIsImFkZEJ1ZmZlciIsImFkZFJlYWRTdHJlYW0iLCJmaWxlTmFtZSIsImV4aXN0cyIsInRoZW4iLCJzdGF0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7O0FBQ0E7Ozs7QUFFQTs7Ozs7Ozs7QUFFQSxtQkFBUUEsWUFBUjs7QUFFZSxNQUFNQyxTQUFOLENBQWdCO0FBQzNCQyxnQkFBWUMsTUFBWixFQUFvQkMsUUFBcEIsRUFBOEI7QUFDMUIsYUFBS0QsTUFBTDtBQUNJRSx5QkFBaUIsRUFEckIsRUFDMkI7QUFDdkJDLHlCQUFpQixFQUZyQixFQUUyQjtBQUN2QkMsaUJBQWlCLElBSHJCLEVBRzJCO0FBQ3ZCQyx1QkFBaUIsRUFKckIsRUFJMkI7QUFDdkJDLHNCQUFpQixFQUxyQixFQUsyQjtBQUN2QkMsd0JBQWlCLElBTnJCLElBT09QLE1BUFA7QUFTQSxhQUFLQyxRQUFMLEdBQWlCQSxRQUFqQjtBQUNBLGFBQUtPLFNBQUwsR0FBaUIsSUFBSUMsR0FBSixFQUFqQjtBQUNIOztBQUVEOzs7QUFHTUMsU0FBTixHQUFjO0FBQUE7O0FBQUE7QUFDVjtBQUNBO0FBQ0E7O0FBRUEsZ0JBQUlDLGtCQUFrQixNQUFNLE1BQUtDLGNBQUwsRUFBNUI7O0FBRUEsZ0JBQUssQ0FBRUQsZUFBUCxFQUNJLE1BQU0sSUFBSUUsS0FBSixDQUFVLDhCQUFWLENBQU47O0FBRUpGLDhCQUFrQixlQUFLRyxPQUFMLENBQWEsTUFBS2QsTUFBTCxDQUFZRSxXQUF6QixFQUFzQ1MsZUFBdEMsQ0FBbEI7O0FBRUEsZ0JBQUlJLFNBQVNDLFFBQVFMLGVBQVIsQ0FBYjs7QUFFQTtBQUNBLGdCQUFLLGVBQU9NLFFBQVAsQ0FBZ0JGLE1BQWhCLENBQUwsRUFDSUEsU0FBUyxNQUFNLG1CQUFRRyxHQUFSLENBQVk7QUFBQSx1QkFBTUgsYUFBTjtBQUFBLGFBQVosQ0FBZjs7QUFFSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsZ0JBQUssZUFBT0ksTUFBUCxDQUFjSixNQUFkLENBQUwsRUFBNkI7QUFDekI7QUFDQTtBQUNBOztBQUh5QixzQkFLakJWLFNBTGlCLEdBS0gsTUFBS0wsTUFMRixDQUtqQkssU0FMaUI7OztBQU96QixvQkFBSWUsY0FBYyxFQUFsQjtBQUNBLHFCQUFNLElBQUlDLE1BQVYsSUFBb0JoQixTQUFwQixFQUFnQztBQUM1QiwwQkFBTWlCLFFBQVVqQixVQUFVZ0IsTUFBVixFQUFrQkUsT0FBbEIsQ0FBMEJDLEtBQTFCLENBQWdDLFdBQWhDLEVBQTZDLENBQTdDLEtBQW1ELEVBQW5FOztBQUVBLHdCQUFLSixZQUFZSyxPQUFaLENBQW9CSCxLQUFwQixJQUE2QixDQUFsQyxFQUFzQ0YsWUFBWU0sSUFBWixDQUFpQkosS0FBakI7QUFDekM7O0FBRUQ7QUFDQTs7QUFFQUYsOEJBQWNBLFlBQVlPLEdBQVosQ0FBZ0IsVUFBQ0MsUUFBRDtBQUFBLDJCQUFlLE1BQUlBLFFBQVMsTUFBNUI7QUFBQSxpQkFBaEIsQ0FBZDs7QUFFQWIsdUJBQU9PLEtBQVAsZ0NBQXFCUCxPQUFPTyxLQUFQLElBQWdCLEVBQXJDLHNCQUE2Q0YsV0FBN0M7O0FBbkJ5QiwyQkFxQkgsTUFBTSxzQkFBbUIsTUFBS3BCLE1BQXhCLEVBQWdDVSxLQUFoQyxDQUFzQ0ssTUFBdEMsQ0FyQkg7O0FBQUEsc0JBcUJqQlAsU0FyQmlCLFFBcUJqQkEsU0FyQmlCOzs7QUF1QnpCLHFCQUFNLElBQUlxQixHQUFWLElBQWlCckIsU0FBakIsRUFDSSxNQUFLQSxTQUFMLENBQWVzQixHQUFmLENBQW1CRCxHQUFuQixFQUVILENBQUUsWUFBRixFQUFpQixnQkFBakIsRUFBbUNGLEdBQW5DO0FBQUEseURBQXVDLFdBQU9JLE9BQVAsRUFBbUI7QUFDdkQsOEJBQU1ILFdBQVcsZUFBS2QsT0FBTCxDQUFhLE1BQUtkLE1BQUwsQ0FBWUcsV0FBekIsRUFBc0M0QixPQUF0QyxDQUFqQjs7QUFFQSw4QkFBTUMsUUFBUSxNQUFNLGtCQUFHQyxTQUFILENBQWFMLFFBQWIsQ0FBcEI7O0FBRUE7QUFDQSw0QkFBS0ksTUFBTUUsTUFBTixFQUFMLEVBQ0ksTUFBS2pDLFFBQUwsQ0FBY2tDLE9BQWQsQ0FBc0JQLFFBQXRCLEVBQWdDRyxPQUFoQyxFQUF5QyxNQUFLL0IsTUFBTCxDQUFZSSxHQUFyRDtBQUNQLHFCQVJBOztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBU0osYUFuQ0QsTUFvQ0EsSUFBSyxlQUFPZ0MsTUFBUCxDQUFjckIsTUFBZCxLQUF5QkEsa0JBQWtCc0IsTUFBaEQsRUFBeUQ7QUFDckQ7QUFDQTtBQUNBOztBQUVBLG9CQUFLLGVBQU9ELE1BQVAsQ0FBY3JCLE1BQWQsQ0FBTCxFQUE2QkEsU0FBUyxJQUFJc0IsTUFBSixDQUFXdEIsTUFBWCxDQUFUOztBQUU3QixzQkFBS2QsUUFBTCxDQUFjcUMsU0FBZCxDQUF3QnZCLE1BQXhCLEVBQWdDLFlBQWhDLEVBQThDLE1BQUtmLE1BQUwsQ0FBWUksR0FBMUQ7QUFFSCxhQVRELE1BVUEsSUFBSyx3QkFBU1csTUFBVCxDQUFMLEVBQXdCO0FBQ3BCO0FBQ0E7QUFDQTs7QUFFQSxzQkFBS2QsUUFBTCxDQUFjc0MsYUFBZCxDQUE0QnhCLE1BQTVCLEVBQW9DLFlBQXBDLEVBQWtELE1BQUtmLE1BQUwsQ0FBWUksR0FBOUQ7QUFFSCxhQVBELE1BT087QUFDSCxzQkFBTSxJQUFJUyxLQUFKLENBQVUsMkJBQVYsQ0FBTjtBQUNIOztBQUVEOztBQUVBO0FBcEZVO0FBcUZiOztBQUdEOzs7QUFHTUQsa0JBQU4sR0FBdUI7QUFBQTs7QUFBQTtBQUNuQixpQkFBTSxJQUFJNEIsUUFBVixJQUFzQixPQUFLeEMsTUFBTCxDQUFZTSxRQUFsQyxFQUE2QztBQUN6QyxzQkFBTW1DLFNBQVMsTUFBTSxrQkFBR1IsU0FBSCxDQUFhTyxRQUFiLEVBQXVCRSxJQUF2QixDQUE0QixVQUFDQyxJQUFEO0FBQUEsMkJBQVVBLEtBQUtULE1BQUwsRUFBVjtBQUFBLGlCQUE1QixDQUFyQjs7QUFFQSxvQkFBS08sTUFBTCxFQUFjLE9BQU9ELFFBQVA7QUFDakI7O0FBRUQsbUJBQU8sSUFBUDtBQVBtQjtBQVF0QjtBQXJIMEI7a0JBQVYxQyxTIiwiZmlsZSI6IkZpbGVCdWlsZC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQcm9taXNlIGZyb20gJ2JsdWViaXJkJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IHR5cGVPZiB9IGZyb20gJ2x1dGlscydcbmltcG9ydCBmcyBmcm9tICdmcy1leHRyYSdcbmltcG9ydCBpc1N0cmVhbSBmcm9tICdpcy1zdHJlYW0nXG5cbmltcG9ydCBXZWJwYWNrQnVpbGRlciBmcm9tICcuL1dlYnBhY2snXG5cblByb21pc2UucHJvbWlzaWZ5QWxsKGZzKVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGaWxlQnVpbGQge1xuICAgIGNvbnN0cnVjdG9yKGNvbmZpZywgYXJ0aWZhY3QpIHtcbiAgICAgICAgdGhpcy5jb25maWcgPSB7XG4gICAgICAgICAgICBzZXJ2aWNlUGF0aCAgICA6ICcnLCAgIC8vIC4vXG4gICAgICAgICAgICBidWlsZFRtcERpciAgICA6ICcnLCAgIC8vIC4vLnNlcnZlcmxlc3MvYnVpbGRcbiAgICAgICAgICAgIHppcCAgICAgICAgICAgIDogbnVsbCwgLy8gWWF6bCB6aXAgb3B0aW9uc1xuICAgICAgICAgICAgZnVuY3Rpb25zICAgICAgOiB7fSwgICAvLyBSZWFsaXplZCBmdW5jdGlvbiBjb25maWdzXG4gICAgICAgICAgICB0cnlGaWxlcyAgICAgICA6IFtdLCAgIC8vIEFycmF5IG9mIHJlbGF0aXZlIHBhdGhzIHRvIHRlc3QgZm9yIGEgYnVpbGQgZmlsZVxuICAgICAgICAgICAgc2VydmVybGVzcyAgICAgOiBudWxsLCAvLyBTZXJ2ZXJsZXNzIGluc3RhbmNlXG4gICAgICAgICAgICAuLi5jb25maWdcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFydGlmYWN0ICA9IGFydGlmYWN0XG4gICAgICAgIHRoaXMuZXh0ZXJuYWxzID0gbmV3IFNldCgpXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogIEhhbmRsZXMgYnVpbGRpbmcgZnJvbSBhIGJ1aWxkIGZpbGUncyBvdXRwdXQuXG4gICAgICovXG4gICAgYXN5bmMgYnVpbGQoKSB7XG4gICAgICAgIC8vXG4gICAgICAgIC8vIFJFU09MVkUgQlVJTEQgRklMRVxuICAgICAgICAvL1xuXG4gICAgICAgIGxldCBidWlsZGVyRmlsZVBhdGggPSBhd2FpdCB0aGlzLl90cnlCdWlsZEZpbGVzKClcblxuICAgICAgICBpZiAoICEgYnVpbGRlckZpbGVQYXRoIClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVucmVjb2duaXplZCBidWlsZCBmaWxlIHBhdGhcIilcblxuICAgICAgICBidWlsZGVyRmlsZVBhdGggPSBwYXRoLnJlc29sdmUodGhpcy5jb25maWcuc2VydmljZVBhdGgsIGJ1aWxkZXJGaWxlUGF0aClcblxuICAgICAgICBsZXQgcmVzdWx0ID0gcmVxdWlyZShidWlsZGVyRmlsZVBhdGgpXG5cbiAgICAgICAgLy8gUmVzb2x2ZSBhbnkgZnVuY3Rpb25zLi4uXG4gICAgICAgIGlmICggdHlwZU9mLkZ1bmN0aW9uKHJlc3VsdCkgKVxuICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS50cnkoKCkgPT4gcmVzdWx0KHRoaXMpKVxuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIEhBTkRMRSBSRVNVTFQgT1VUUFVUOlxuICAgICAgICAvL1xuICAgICAgICAvLyAtIFN0cmluZywgQnVmZmVyIG9yIFN0cmVhbTogICBwaXBlZCBhcyAnaGFuZGxlci5qcycgaW50byB6aXBcbiAgICAgICAgLy8gLSBXZWJwYWNrIENvbmZpZzogICAgICAgICAgICAgZXhlY3V0ZWQgYW5kIG91dHB1dCBmaWxlcyBhcmUgemlwcGVkXG4gICAgICAgIC8vXG5cbiAgICAgICAgaWYgKCB0eXBlT2YuT2JqZWN0KHJlc3VsdCkgKSB7XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gV0VCUEFDSyBDT05GSUdcbiAgICAgICAgICAgIC8vXG5cbiAgICAgICAgICAgIGNvbnN0IHsgZnVuY3Rpb25zIH0gPSB0aGlzLmNvbmZpZ1xuXG4gICAgICAgICAgICBsZXQgZW50cnlQb2ludHMgPSBbXVxuICAgICAgICAgICAgZm9yICggbGV0IGZuTmFtZSBpbiBmdW5jdGlvbnMgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50cnkgPSAoIGZ1bmN0aW9uc1tmbk5hbWVdLmhhbmRsZXIuc3BsaXQoL1xcLlteXFwuXSskLylbMF0gfHwgJycgKVxuXG4gICAgICAgICAgICAgICAgaWYgKCBlbnRyeVBvaW50cy5pbmRleE9mKGVudHJ5KSA8IDAgKSBlbnRyeVBvaW50cy5wdXNoKGVudHJ5KVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUT0RPOiBsb29wIG92ZXIgZWFjaCBmdW5jdGlvbiBhbmQgYnVpbGQgc2VwZXJhdGVseS5cbiAgICAgICAgICAgIC8vIFNldCByZXN1bHQub3V0cHV0LnBhdGggYW5kIGZpbGVuYW1lXG5cbiAgICAgICAgICAgIGVudHJ5UG9pbnRzID0gZW50cnlQb2ludHMubWFwKChmaWxlUGF0aCkgPT4gYC4vJHtmaWxlUGF0aH0uanNgKVxuXG4gICAgICAgICAgICByZXN1bHQuZW50cnkgPSBbIC4uLihyZXN1bHQuZW50cnkgfHwgW10pLCAuLi5lbnRyeVBvaW50cyBdXG5cbiAgICAgICAgICAgIGNvbnN0IHsgZXh0ZXJuYWxzIH0gPSBhd2FpdCBuZXcgV2VicGFja0J1aWxkZXIodGhpcy5jb25maWcpLmJ1aWxkKHJlc3VsdClcblxuICAgICAgICAgICAgZm9yICggbGV0IGV4dCBvZiBleHRlcm5hbHMgKVxuICAgICAgICAgICAgICAgIHRoaXMuZXh0ZXJuYWxzLmFkZChleHQpXG5cbiAgICAgICAgICAgIDtbICdoYW5kbGVyLmpzJywgYGhhbmRsZXIuanMubWFwYCBdLm1hcChhc3luYyAocmVsUGF0aCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5yZXNvbHZlKHRoaXMuY29uZmlnLmJ1aWxkVG1wRGlyLCByZWxQYXRoKVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0QXN5bmMoZmlsZVBhdGgpXG5cbiAgICAgICAgICAgICAgICAvLyBFbnN1cmUgZmlsZSBleGlzdHMgZmlyc3RcbiAgICAgICAgICAgICAgICBpZiAoIHN0YXRzLmlzRmlsZSgpIClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcnRpZmFjdC5hZGRGaWxlKGZpbGVQYXRoLCByZWxQYXRoLCB0aGlzLmNvbmZpZy56aXApXG4gICAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2VcbiAgICAgICAgaWYgKCB0eXBlT2YuU3RyaW5nKHJlc3VsdCkgfHwgcmVzdWx0IGluc3RhbmNlb2YgQnVmZmVyICkge1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIFNUUklOR1MsIEJVRkZFUlNcbiAgICAgICAgICAgIC8vXG5cbiAgICAgICAgICAgIGlmICggdHlwZU9mLlN0cmluZyhyZXN1bHQpICkgcmVzdWx0ID0gbmV3IEJ1ZmZlcihyZXN1bHQpXG5cbiAgICAgICAgICAgIHRoaXMuYXJ0aWZhY3QuYWRkQnVmZmVyKHJlc3VsdCwgJ2hhbmRsZXIuanMnLCB0aGlzLmNvbmZpZy56aXApXG5cbiAgICAgICAgfSBlbHNlXG4gICAgICAgIGlmICggaXNTdHJlYW0ocmVzdWx0KSApIHtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBTVFJFQU1TXG4gICAgICAgICAgICAvL1xuXG4gICAgICAgICAgICB0aGlzLmFydGlmYWN0LmFkZFJlYWRTdHJlYW0ocmVzdWx0LCAnaGFuZGxlci5qcycsIHRoaXMuY29uZmlnLnppcClcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5yZWNvZ25pemVkIGJ1aWxkIG91dHB1dFwiKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogcmVhZCBmcm9tIHNlcnZlcmxlc3MueW1sIC0+IHBhY2thZ2UuaW5jbHVkZXMgZm9yIGV4dGVuZXJhbHMgYXMgd2VsbCBhcyBleGNsdWRlc1xuXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiAgQWxsb3dzIGZvciBidWlsZCBmaWxlcyB0byBiZSBhdXRvIHNlbGVjdGVkXG4gICAgICovXG4gICAgYXN5bmMgX3RyeUJ1aWxkRmlsZXMoKSB7XG4gICAgICAgIGZvciAoIGxldCBmaWxlTmFtZSBvZiB0aGlzLmNvbmZpZy50cnlGaWxlcyApIHtcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IGZzLnN0YXRBc3luYyhmaWxlTmFtZSkudGhlbigoc3RhdCkgPT4gc3RhdC5pc0ZpbGUoKSlcblxuICAgICAgICAgICAgaWYgKCBleGlzdHMgKSByZXR1cm4gZmlsZU5hbWVcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxufVxuIl19