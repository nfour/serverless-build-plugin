'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class UglifyTransform {
    constructor() {
        let config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
        let options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        this.options = _extends({
            skipOnError: true, // When false, errors will halt execution
            logErrors: false
        }, options);

        this.config = _extends({
            dead_code: true,
            unsafe: false

        }, config);

        this.uglify = require('uglify-js');
    }

    run(_ref) {
        let code = _ref.code;
        let map = _ref.map;
        let filePath = _ref.filePath;

        const fileName = _path2.default.basename(filePath);

        let result = { code: code, map: map };

        try {
            result = this.uglify.minify({ [fileName]: code }, _extends({}, this.config, {

                // Must pass through any previous source maps
                inSourceMap: map ? map : null,

                outSourceMap: `${ fileName }.map`,
                fromString: true
            }));
        } catch (err) {
            if (this.options.logErrors) console.error(err);
            if (!this.options.skipOnError) throw err;
        }

        return result;
    }
}
exports.default = UglifyTransform;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvdHJhbnNmb3Jtcy9VZ2xpZnkuanMiXSwibmFtZXMiOlsiVWdsaWZ5VHJhbnNmb3JtIiwiY29uc3RydWN0b3IiLCJjb25maWciLCJvcHRpb25zIiwic2tpcE9uRXJyb3IiLCJsb2dFcnJvcnMiLCJkZWFkX2NvZGUiLCJ1bnNhZmUiLCJ1Z2xpZnkiLCJyZXF1aXJlIiwicnVuIiwiY29kZSIsIm1hcCIsImZpbGVQYXRoIiwiZmlsZU5hbWUiLCJiYXNlbmFtZSIsInJlc3VsdCIsIm1pbmlmeSIsImluU291cmNlTWFwIiwib3V0U291cmNlTWFwIiwiZnJvbVN0cmluZyIsImVyciIsImNvbnNvbGUiLCJlcnJvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTs7Ozs7O0FBRWUsTUFBTUEsZUFBTixDQUFzQjtBQUNqQ0Msa0JBQXVDO0FBQUEsWUFBM0JDLE1BQTJCLHlEQUFsQixFQUFrQjtBQUFBLFlBQWRDLE9BQWMseURBQUosRUFBSTs7QUFDbkMsYUFBS0EsT0FBTDtBQUNJQyx5QkFBYyxJQURsQixFQUN3QjtBQUNwQkMsdUJBQWM7QUFGbEIsV0FHT0YsT0FIUDs7QUFNQSxhQUFLRCxNQUFMO0FBQ0lJLHVCQUFZLElBRGhCO0FBRUlDLG9CQUFZOztBQUZoQixXQUlPTCxNQUpQOztBQU9BLGFBQUtNLE1BQUwsR0FBY0MsUUFBUSxXQUFSLENBQWQ7QUFDSDs7QUFFREMsY0FBNkI7QUFBQSxZQUF2QkMsSUFBdUIsUUFBdkJBLElBQXVCO0FBQUEsWUFBakJDLEdBQWlCLFFBQWpCQSxHQUFpQjtBQUFBLFlBQVpDLFFBQVksUUFBWkEsUUFBWTs7QUFDekIsY0FBTUMsV0FBVyxlQUFLQyxRQUFMLENBQWNGLFFBQWQsQ0FBakI7O0FBRUEsWUFBSUcsU0FBUyxFQUFFTCxVQUFGLEVBQVFDLFFBQVIsRUFBYjs7QUFFQSxZQUFJO0FBQ0FJLHFCQUFTLEtBQUtSLE1BQUwsQ0FBWVMsTUFBWixDQUFtQixFQUFFLENBQUNILFFBQUQsR0FBWUgsSUFBZCxFQUFuQixlQUNGLEtBQUtULE1BREg7O0FBR0w7QUFDQWdCLDZCQUFlTixNQUNUQSxHQURTLEdBRVQsSUFORDs7QUFRTE8sOEJBQWdCLElBQUVMLFFBQVMsT0FSdEI7QUFTTE0sNEJBQWU7QUFUVixlQUFUO0FBV0gsU0FaRCxDQVlFLE9BQU9DLEdBQVAsRUFBWTtBQUNWLGdCQUFLLEtBQUtsQixPQUFMLENBQWFFLFNBQWxCLEVBQThCaUIsUUFBUUMsS0FBUixDQUFjRixHQUFkO0FBQzlCLGdCQUFLLENBQUUsS0FBS2xCLE9BQUwsQ0FBYUMsV0FBcEIsRUFBa0MsTUFBTWlCLEdBQU47QUFDckM7O0FBRUQsZUFBT0wsTUFBUDtBQUNIO0FBekNnQztrQkFBaEJoQixlIiwiZmlsZSI6IlVnbGlmeS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVnbGlmeVRyYW5zZm9ybSB7XG4gICAgY29uc3RydWN0b3IoY29uZmlnID0ge30sIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICAgICAgICBza2lwT25FcnJvciA6IHRydWUsIC8vIFdoZW4gZmFsc2UsIGVycm9ycyB3aWxsIGhhbHQgZXhlY3V0aW9uXG4gICAgICAgICAgICBsb2dFcnJvcnMgICA6IGZhbHNlLFxuICAgICAgICAgICAgLi4ub3B0aW9uc1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25maWcgPSB7XG4gICAgICAgICAgICBkZWFkX2NvZGUgOiB0cnVlLFxuICAgICAgICAgICAgdW5zYWZlICAgIDogZmFsc2UsXG5cbiAgICAgICAgICAgIC4uLmNvbmZpZ1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51Z2xpZnkgPSByZXF1aXJlKCd1Z2xpZnktanMnKVxuICAgIH1cblxuICAgIHJ1bih7IGNvZGUsIG1hcCwgZmlsZVBhdGggfSkge1xuICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpXG5cbiAgICAgICAgbGV0IHJlc3VsdCA9IHsgY29kZSwgbWFwIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy51Z2xpZnkubWluaWZ5KHsgW2ZpbGVOYW1lXTogY29kZSB9LCB7XG4gICAgICAgICAgICAgICAgLi4udGhpcy5jb25maWcsXG5cbiAgICAgICAgICAgICAgICAvLyBNdXN0IHBhc3MgdGhyb3VnaCBhbnkgcHJldmlvdXMgc291cmNlIG1hcHNcbiAgICAgICAgICAgICAgICBpblNvdXJjZU1hcCAgOiBtYXBcbiAgICAgICAgICAgICAgICAgICAgPyBtYXBcbiAgICAgICAgICAgICAgICAgICAgOiBudWxsLFxuXG4gICAgICAgICAgICAgICAgb3V0U291cmNlTWFwIDogYCR7ZmlsZU5hbWV9Lm1hcGAsXG4gICAgICAgICAgICAgICAgZnJvbVN0cmluZyAgIDogdHJ1ZSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgaWYgKCB0aGlzLm9wdGlvbnMubG9nRXJyb3JzICkgY29uc29sZS5lcnJvcihlcnIpXG4gICAgICAgICAgICBpZiAoICEgdGhpcy5vcHRpb25zLnNraXBPbkVycm9yICkgdGhyb3cgZXJyXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgfVxufVxuIl19