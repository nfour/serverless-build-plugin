import Promise from 'bluebird'
import webpack from 'webpack'

export default class WebpackRunner {
    constructor(config) {
        // this.webpack = require('webpack')
        this.config = config
    }

    build() {
        const { config } = this

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
}
