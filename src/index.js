import 'source-map-support/register';
import path from 'path';

const serverlessVersion = require(
  path.join(path.dirname(process.mainModule.filename), '../package.json')
).version;

module.exports = /0\.5\./.test(serverlessVersion)
  ? (S) => require('./lib/ServerlessBuildPlugin-0.5')(S)
  : require('./lib/ServerlessBuildPlugin');
