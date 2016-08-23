import Promise from 'bluebird'
import path from 'path'

export default class WebpackBuilder {
    constructor(plugin) {
        this.plugin  = plugin

        this.webpack = require('webpack')
    }

    /**
     *  Builds a webpack config into the build directory.
     */
    async build(config) {
        const { servicePath } = this.plugin.serverless.config

        // TODO: make this build on a single function basis with one entry in order to
        // allow for each function to dictate build methods

        config.context = servicePath
        config.entry   = [ ...(config.entry || []) ]
        config.output  = {
            ...config.output,
            libraryTarget : 'commonjs',
            path          : this.plugin.buildTmpDir,
            filename      : 'handler.js'
        }

        /**
         *  TODO: normalize the externals to an array of module names, or else errors.
         */
        this.externals = config.externals

        const logs = await this._runWebpack(config)

        this.plugin.serverless.cli.log(logs)

        return this
    }

    _runWebpack(config, webpack = this.webpack) {
        return new Promise((resolve, reject) => {
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
    }

    /**
     *  FIXME: UNSUED
     *
     *  Declarative build method, used in bundling.
     */
    standardBuild(pathFrom, pathTo, { babel, devtool = true, optimize = false } = {}) {
        const { servicePath } = this.plugin.serverless.config

        const config = {
            entry: [ pathFrom ],
            context: servicePath,
            output: {
                libraryTarget : 'commonjs',
                path          : path.dirname(pathTo),
                filename      : path.basename(pathTo),
            }
        }

        if ( devtool )
            config.devtool = 'source-map'

        if ( optimize )
            config.plugins = [
                ...config.plugins,
                new this.webpack.optimize.DedupePlugin(),
                new this.webpack.optimize.UglifyJsPlugin({
                    compress: {
                        unused        : true,
                        dead_code     : true,
                        warnings      : false,
                        drop_debugger : true
                    }
                })
            ]

        if ( babel )
            config.module = {
                loaders: [
                    {
                        test    : /\.js$/,
                        loader  : 'babel',
                        exclude : /node_modules/,
                        query   : babel
                    },
                ]
            }

        return this._runWebpack(config)
    }

}
