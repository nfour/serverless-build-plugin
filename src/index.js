import path from 'path'
import semver from 'semver'

const serverlessVersion = require( path.join( path.dirname(process.mainModule.filename), '../package.json' ) ).version

module.exports = semver.satisfies(serverlessVersion, '^0.5.0')
    ? (S) => require('./lib/ServerlessBuildPlugin-0.5')(S)
    : require('./lib/ServerlessBuildPlugin')
