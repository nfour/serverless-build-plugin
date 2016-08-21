import Promise from 'bluebird'
import fs from 'memory-fs'
import path from 'path'

Promise.promisifyAll(fs)

export default class WebpackOptimizeTransform {
    constructor(config) {
        this.config = {
            ...config,
            output: {
                libraryTarget : 'commonjs',
                path          : '/',
                filename      : "output.js"
            }
        }

        this.webpack = require('webpack')
        this.outputPath = path.join(this.config.output.path, this.config.output.filename)
    }

    async transform(file) {
        const filename   = new Date().getTime() + Math.random() + ''
        const outputPath = `/${filename}`

        const compiler = this.webpack({
            ...this.config,
            output: { ...this.config.output, filename }
        })

        compiler.outputFileSytem = fs

        await new Promise((resolve, reject) => {
            compiler.run((err, stats) => {
                if ( err ) return reject(err)
                resolve(  )
            })
        })

        // TODO: this may be stupid as fuck, should just not read into memory and scrap the babel optimizer as well
        // just use webpack for babel

        const optimizedFile = await fs.readFileAsync(outputPath, 'utf8')
        await fs.unlinkAsync(outputPath)

        return optimizedFile
    }
}
