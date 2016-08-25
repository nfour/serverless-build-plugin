require('babel-register') // FIXME: testing only
var fs = require('fs')

let slsVersion

try {
    fs.accessSync('s-project.json', fs.R_OK)
    slsVersion = '0.5'
} catch (e) {
    slsVersion = '1.0'
}

let exported

if (slsVersion === '1.0') {
    exported = require('./lib/ServerlessBuildPlugin')
} else {
    exported = function(S) {
        return require('./lib/ServerlessBuildPlugin-0.5')(S)
    }
}
module.exports = exported
