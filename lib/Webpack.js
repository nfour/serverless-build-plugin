import Promise from 'bluebird'
import webpack from 'webpack'

export default class WebpackBuilder {
    constructor(plugin) {
        this.plugin      = plugin
        this.serverless  = plugin.serverless
        this.buildTmpDir = plugin.buildTmpDir

        // this.webpack = require('webpack')
    }

    async build(config) {
        const {
            service: { functions = [] },
            config: { servicePath }
        } = this.serverless

        let entryPoints = []
        for ( let fnName in functions ) {
            const entry = functions[fnName].handler.split('.')[0]
            if ( entryPoints.indexOf(entry) < 0 ) entryPoints.push(entry)
        }

        entryPoints = entryPoints.map((filePath) => `./${filePath}.js`)

        config.context = servicePath
        config.entry   = [ ...(config.entry || []), ...entryPoints ]
        config.output  = {
            ...config.output,
            libraryTarget : 'commonjs',
            path          : this.buildTmpDir,
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

        this.serverless.cli.log(logs)

        return this
    }
}
