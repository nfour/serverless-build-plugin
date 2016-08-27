'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.handleFile = undefined;

var _bluebird = require('bluebird');

/**
 *  Normalizes transforming and zip allocation for walked files.
 *  Used by SourceBundler & ModuleBundler.
 */
let handleFile = exports.handleFile = (() => {
    var _ref = (0, _bluebird.coroutine)(function* (_ref2) {
        let filePath = _ref2.filePath;
        let relPath = _ref2.relPath;
        let artifact = _ref2.artifact;
        let zipConfig = _ref2.zipConfig;
        let useSourceMaps = _ref2.useSourceMaps;
        let transformExtensions = _ref2.transformExtensions;
        let transforms = _ref2.transforms;

        const extname = _path2.default.extname(filePath);
        const isTransformable = transformExtensions.some(function (ext) {
            return `.${ ext }` === extname.toLowerCase();
        });

        // TODO: make each transformer check extensions itself, and concat their
        // extension whitelist to check here.
        if (isTransformable) {
            //
            // JAVASCRIPT
            //

            let code = yield _fsExtra2.default.readFileAsync(filePath, 'utf8');
            let map = '';

            /**
             *  Runs transforms against the code, mutating the code & map
             *  with each iteration, optionally producing source maps
             */
            if (transforms.length) {
                for (let transformer of transforms) {
                    let result = transformer.run({ code: code, map: map, filePath: filePath, relPath: relPath });

                    if (result.code) {
                        code = result.code;
                        if (result.map) map = result.map;
                    }
                }
            }

            artifact.addBuffer(new Buffer(code), relPath, zipConfig);

            if (useSourceMaps && map) {
                if (_lutils.typeOf.Object(map)) map = JSON.stringify(map);

                artifact.addBuffer(new Buffer(map), `${ relPath }.map`, zipConfig);
            }
        } else {
            //
            // ARBITRARY FILES
            //

            artifact.addFile(filePath, relPath, zipConfig);
        }

        return artifact;
    });

    return function handleFile(_x) {
        return _ref.apply(this, arguments);
    };
})();

exports.walker = walker;

var _walk = require('walk');

var _walk2 = _interopRequireDefault(_walk);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _lutils = require('lutils');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function walker() {
    const w = _walk2.default.walk.apply(_walk2.default, arguments);

    w.end = () => new Promise((resolve, reject) => {
        w.on("error", reject);
        w.on("end", resolve);
    });

    return w;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvdXRpbHMuanMiXSwibmFtZXMiOlsiZmlsZVBhdGgiLCJyZWxQYXRoIiwiYXJ0aWZhY3QiLCJ6aXBDb25maWciLCJ1c2VTb3VyY2VNYXBzIiwidHJhbnNmb3JtRXh0ZW5zaW9ucyIsInRyYW5zZm9ybXMiLCJleHRuYW1lIiwiaXNUcmFuc2Zvcm1hYmxlIiwic29tZSIsImV4dCIsInRvTG93ZXJDYXNlIiwiY29kZSIsInJlYWRGaWxlQXN5bmMiLCJtYXAiLCJsZW5ndGgiLCJ0cmFuc2Zvcm1lciIsInJlc3VsdCIsInJ1biIsImFkZEJ1ZmZlciIsIkJ1ZmZlciIsIk9iamVjdCIsIkpTT04iLCJzdHJpbmdpZnkiLCJhZGRGaWxlIiwiaGFuZGxlRmlsZSIsIndhbGtlciIsInciLCJ3YWxrIiwiZW5kIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBZ0JBOzs7Ozt3Q0FJTyxrQkFJSjtBQUFBLFlBSENBLFFBR0QsU0FIQ0EsUUFHRDtBQUFBLFlBSFdDLE9BR1gsU0FIV0EsT0FHWDtBQUFBLFlBRkNDLFFBRUQsU0FGQ0EsUUFFRDtBQUFBLFlBRldDLFNBRVgsU0FGV0EsU0FFWDtBQUFBLFlBRnNCQyxhQUV0QixTQUZzQkEsYUFFdEI7QUFBQSxZQURDQyxtQkFDRCxTQURDQSxtQkFDRDtBQUFBLFlBRHNCQyxVQUN0QixTQURzQkEsVUFDdEI7O0FBQ0MsY0FBTUMsVUFBa0IsZUFBS0EsT0FBTCxDQUFhUCxRQUFiLENBQXhCO0FBQ0EsY0FBTVEsa0JBQWtCSCxvQkFBb0JJLElBQXBCLENBQXlCLFVBQUNDLEdBQUQ7QUFBQSxtQkFBVSxLQUFHQSxHQUFJLEdBQVIsS0FBY0gsUUFBUUksV0FBUixFQUF2QjtBQUFBLFNBQXpCLENBQXhCOztBQUVBO0FBQ0E7QUFDQSxZQUFLSCxlQUFMLEVBQXVCO0FBQ25CO0FBQ0E7QUFDQTs7QUFFQSxnQkFBSUksT0FBTyxNQUFNLGtCQUFHQyxhQUFILENBQWlCYixRQUFqQixFQUEyQixNQUEzQixDQUFqQjtBQUNBLGdCQUFJYyxNQUFPLEVBQVg7O0FBRUE7Ozs7QUFJQSxnQkFBS1IsV0FBV1MsTUFBaEIsRUFBeUI7QUFDckIscUJBQU0sSUFBSUMsV0FBVixJQUF5QlYsVUFBekIsRUFBc0M7QUFDbEMsd0JBQUlXLFNBQVNELFlBQVlFLEdBQVosQ0FBZ0IsRUFBRU4sVUFBRixFQUFRRSxRQUFSLEVBQWFkLGtCQUFiLEVBQXVCQyxnQkFBdkIsRUFBaEIsQ0FBYjs7QUFFQSx3QkFBS2dCLE9BQU9MLElBQVosRUFBbUI7QUFDZkEsK0JBQU9LLE9BQU9MLElBQWQ7QUFDQSw0QkFBS0ssT0FBT0gsR0FBWixFQUFrQkEsTUFBTUcsT0FBT0gsR0FBYjtBQUNyQjtBQUNKO0FBQ0o7O0FBRURaLHFCQUFTaUIsU0FBVCxDQUFvQixJQUFJQyxNQUFKLENBQVdSLElBQVgsQ0FBcEIsRUFBc0NYLE9BQXRDLEVBQStDRSxTQUEvQzs7QUFFQSxnQkFBS0MsaUJBQWlCVSxHQUF0QixFQUE0QjtBQUN4QixvQkFBSyxlQUFPTyxNQUFQLENBQWNQLEdBQWQsQ0FBTCxFQUEwQkEsTUFBTVEsS0FBS0MsU0FBTCxDQUFlVCxHQUFmLENBQU47O0FBRTFCWix5QkFBU2lCLFNBQVQsQ0FBb0IsSUFBSUMsTUFBSixDQUFXTixHQUFYLENBQXBCLEVBQXNDLElBQUViLE9BQVEsT0FBaEQsRUFBdURFLFNBQXZEO0FBQ0g7QUFDSixTQTlCRCxNQThCTztBQUNIO0FBQ0E7QUFDQTs7QUFFQUQscUJBQVNzQixPQUFULENBQWlCeEIsUUFBakIsRUFBMkJDLE9BQTNCLEVBQW9DRSxTQUFwQztBQUNIOztBQUVELGVBQU9ELFFBQVA7QUFDSCxLOztvQkFqRHFCdUIsVTs7Ozs7UUFmTkMsTSxHQUFBQSxNOztBQUxoQjs7OztBQUNBOzs7O0FBQ0E7O0FBQ0E7Ozs7OztBQUVPLFNBQVNBLE1BQVQsR0FBeUI7QUFDNUIsVUFBTUMsSUFBSSxlQUFLQyxJQUFMLGlDQUFWOztBQUVBRCxNQUFFRSxHQUFGLEdBQVEsTUFBTSxJQUFJQyxPQUFKLENBQVksQ0FBQ0MsT0FBRCxFQUFVQyxNQUFWLEtBQXFCO0FBQzNDTCxVQUFFTSxFQUFGLENBQUssT0FBTCxFQUFjRCxNQUFkO0FBQ0FMLFVBQUVNLEVBQUYsQ0FBSyxLQUFMLEVBQVlGLE9BQVo7QUFDSCxLQUhhLENBQWQ7O0FBS0EsV0FBT0osQ0FBUDtBQUNIIiwiZmlsZSI6InV0aWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHdhbGsgZnJvbSAnd2FsaydcbmltcG9ydCBmcyBmcm9tICdmcy1leHRyYSdcbmltcG9ydCB7IHR5cGVPZiB9IGZyb20gJ2x1dGlscydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5cbmV4cG9ydCBmdW5jdGlvbiB3YWxrZXIoLi4uYXJncykge1xuICAgIGNvbnN0IHcgPSB3YWxrLndhbGsoLi4uYXJncylcblxuICAgIHcuZW5kID0gKCkgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB3Lm9uKFwiZXJyb3JcIiwgcmVqZWN0KVxuICAgICAgICB3Lm9uKFwiZW5kXCIsIHJlc29sdmUpXG4gICAgfSlcblxuICAgIHJldHVybiB3XG59XG5cbi8qKlxuICogIE5vcm1hbGl6ZXMgdHJhbnNmb3JtaW5nIGFuZCB6aXAgYWxsb2NhdGlvbiBmb3Igd2Fsa2VkIGZpbGVzLlxuICogIFVzZWQgYnkgU291cmNlQnVuZGxlciAmIE1vZHVsZUJ1bmRsZXIuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVGaWxlKHtcbiAgICBmaWxlUGF0aCwgcmVsUGF0aCxcbiAgICBhcnRpZmFjdCwgemlwQ29uZmlnLCB1c2VTb3VyY2VNYXBzLFxuICAgIHRyYW5zZm9ybUV4dGVuc2lvbnMsIHRyYW5zZm9ybXNcbn0pIHtcbiAgICBjb25zdCBleHRuYW1lICAgICAgICAgPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGgpXG4gICAgY29uc3QgaXNUcmFuc2Zvcm1hYmxlID0gdHJhbnNmb3JtRXh0ZW5zaW9ucy5zb21lKChleHQpID0+IGAuJHtleHR9YCA9PT0gZXh0bmFtZS50b0xvd2VyQ2FzZSgpIClcblxuICAgIC8vIFRPRE86IG1ha2UgZWFjaCB0cmFuc2Zvcm1lciBjaGVjayBleHRlbnNpb25zIGl0c2VsZiwgYW5kIGNvbmNhdCB0aGVpclxuICAgIC8vIGV4dGVuc2lvbiB3aGl0ZWxpc3QgdG8gY2hlY2sgaGVyZS5cbiAgICBpZiAoIGlzVHJhbnNmb3JtYWJsZSApIHtcbiAgICAgICAgLy9cbiAgICAgICAgLy8gSkFWQVNDUklQVFxuICAgICAgICAvL1xuXG4gICAgICAgIGxldCBjb2RlID0gYXdhaXQgZnMucmVhZEZpbGVBc3luYyhmaWxlUGF0aCwgJ3V0ZjgnKVxuICAgICAgICBsZXQgbWFwICA9ICcnXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqICBSdW5zIHRyYW5zZm9ybXMgYWdhaW5zdCB0aGUgY29kZSwgbXV0YXRpbmcgdGhlIGNvZGUgJiBtYXBcbiAgICAgICAgICogIHdpdGggZWFjaCBpdGVyYXRpb24sIG9wdGlvbmFsbHkgcHJvZHVjaW5nIHNvdXJjZSBtYXBzXG4gICAgICAgICAqL1xuICAgICAgICBpZiAoIHRyYW5zZm9ybXMubGVuZ3RoICkge1xuICAgICAgICAgICAgZm9yICggbGV0IHRyYW5zZm9ybWVyIG9mIHRyYW5zZm9ybXMgKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHRyYW5zZm9ybWVyLnJ1bih7IGNvZGUsIG1hcCwgZmlsZVBhdGgsIHJlbFBhdGggfSlcblxuICAgICAgICAgICAgICAgIGlmICggcmVzdWx0LmNvZGUgKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgPSByZXN1bHQuY29kZVxuICAgICAgICAgICAgICAgICAgICBpZiAoIHJlc3VsdC5tYXAgKSBtYXAgPSByZXN1bHQubWFwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXJ0aWZhY3QuYWRkQnVmZmVyKCBuZXcgQnVmZmVyKGNvZGUpLCByZWxQYXRoLCB6aXBDb25maWcgKVxuXG4gICAgICAgIGlmICggdXNlU291cmNlTWFwcyAmJiBtYXAgKSB7XG4gICAgICAgICAgICBpZiAoIHR5cGVPZi5PYmplY3QobWFwKSApIG1hcCA9IEpTT04uc3RyaW5naWZ5KG1hcClcblxuICAgICAgICAgICAgYXJ0aWZhY3QuYWRkQnVmZmVyKCBuZXcgQnVmZmVyKG1hcCksIGAke3JlbFBhdGh9Lm1hcGAsIHppcENvbmZpZyApXG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICAvL1xuICAgICAgICAvLyBBUkJJVFJBUlkgRklMRVNcbiAgICAgICAgLy9cblxuICAgICAgICBhcnRpZmFjdC5hZGRGaWxlKGZpbGVQYXRoLCByZWxQYXRoLCB6aXBDb25maWcpXG4gICAgfVxuXG4gICAgcmV0dXJuIGFydGlmYWN0XG59XG4iXX0=