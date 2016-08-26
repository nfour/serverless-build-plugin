'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _semver = require('semver');

var _semver2 = _interopRequireDefault(_semver);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const serverlessVersion = require(_path2.default.join(_path2.default.dirname(process.mainModule.filename), '../package.json')).version;

module.exports = _semver2.default.satisfies(serverlessVersion, '^0.5.0') ? S => require('./lib/ServerlessBuildPlugin-0.5')(S) : require('./lib/ServerlessBuildPlugin');