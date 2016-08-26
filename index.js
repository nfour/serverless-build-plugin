require('babel-register') // FIXME: testing only
var path = require('path')
var semver = require('semver')

const serverlessVersion = require(path.join(path.dirname(process.mainModule.filename), '../package.json')).version

let exported

if (semver.satisfies(serverlessVersion, '^0.5.0')) {
    exported = function(S) {
        return require('./lib/ServerlessBuildPlugin-0.5')(S)
    }
} else {
    exported = require('./lib/ServerlessBuildPlugin')
}
module.exports = exported
