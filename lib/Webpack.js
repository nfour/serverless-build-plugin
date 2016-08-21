import Promise from 'bluebird'
import webpack from 'webpack'

export default class WebpackBuilder {
    constructor(plugin) {
        this.plugin      = plugin

        // this.webpack = require('webpack')
    }

    /**
     *  Builds a webpack config into the build directory.
     */
    async build(config) {
        const { servicePath } = this.plugin.serverless.config

        const { functions } = this.plugin

        // TODO: make this build on a single function basis with one entry in order to
        // allow for each function to dictate build methods

        let entryPoints = []
        for ( let fnName in functions ) {
            const entry = ( functions[fnName].handler.split(/\.[^\.]+$/)[0] || '' )
                .split('.').join('/')

            if ( entryPoints.indexOf(entry) < 0 ) entryPoints.push(entry)
        }

        entryPoints = entryPoints.map((filePath) => `./${filePath}.js`)

        config.context = servicePath
        config.entry   = [ ...(config.entry || []), ...entryPoints ]
        config.output  = {
            ...config.output,
            libraryTarget : 'commonjs',
            path          : this.plugin.buildTmpDir,
            filename      : 'handler.js'
        }

        this.externals = config.externals // TODO: normalize this due to multitude of externals structures

        const logs = await new Promise((resolve, reject) => {
            webpack(config).run((err, stats) => {
                if ( err ) return reject(err)

                resolve(stats.toString({
                    colors: true,
                    hash: false,
                    version: false,
                    chunks: false,
                    children: false,
                }))
            })
        })

        this.plugin.serverless.cli.log(logs)

        return this
    }
}
