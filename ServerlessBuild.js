import Promise from 'bluebird'
import path from 'path'
import Yazl from 'yazl'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import isStream from 'is-stream'
import WebpackBuilder from './Webpack'

Promise.promisifyAll(fs)

export default class ServerlessBuild {
    config = {
        tryFiles: [
            "gulpfile.babel.js",
            "webpack.config.js",
            "gulpfile.js",
        ],

        artifact: 'handler.js'
    }

    constructor(serverless, options = {}) {
        this.serverless = serverless
        this.options    = options

        if ( ! this.serverless.getVersion().startsWith('1') )
            throw new this.serverless.classes.Error(
                'serverless-build-plugin requires serverless@1.x.x'
            )

        this.hooks = {
            'before:deploy:createDeploymentPackage': (...args) => this.build(...args)
        }
    }

    async tryFiles() {
        for ( let fileName of this.config.tryFiles ) {
            const exists = await fs.statAsync(fileName).then((stat) => stat.isFile())

            if ( exists ) return fileName
        }

        return null
    }

    async build(...args) {
        console.log({ args }) // TODO: capture --function

        const {
            service: { functions = [], service },
            config: { servicePath }
        } = this.serverless

        const tmpDir = path.join(servicePath, './.serverless')

        let builderFilePath = await this.tryFiles()

        if ( ! builderFilePath )
            throw new Error("Unrecognized build file path")

        builderFilePath = path.resolve(servicePath, builderFilePath)

        let result = require(builderFilePath)

        // Resolve any functions...
        if ( typeOf.Function(result) )
            result = await Promise.try(() => result(this))

        const zipPath = path.resolve(tmpDir, `./${service}-${new Date().getTime()}.zip`)
        const zip = new Yazl.ZipFile()
        const zipOptions = { compress: true }

        // Use String or buffers
        if ( typeOf.String(result) || result instanceof Buffer ) {
            if ( typeOf.String(result) ) result = new Buffer(result)

            zip.addBuffer(result, 'handler.js', zipOptions)
        } else
        // Use streams
        if ( isStream(result) )
            zip.addReadStream(result, 'handler.js', zipOptions)
        else
        // Use webpack
        if ( typeOf.Object(result) ) {
            let entryPoints = []
            for ( let fnName in functions ) {
                const entry = functions[fnName].handler.split('.')[0]
                if ( entryPoints.indexOf(entry) < 0 ) entryPoints.push(entry)
            }

            entryPoints = entryPoints.map((filePath) => `./${filePath}.js`)

            result.context = servicePath
            result.entry = [ ...result.entry, ...entryPoints ]
            result.output = {
                ...result.output,
                libraryTarget : 'commonjs',
                path          : tmpDir,
                filename      : 'handler.js'
            }

            const logging = await new WebpackBuilder(result).build()
            this.serverless.cli.log(logging)

            ;[ 'handler.js', `handler.js.map`].forEach((fileName) => {
                const filePath = path.resolve(tmpDir, fileName)

                zip.addFile(filePath, fileName, zipOptions)
            })

        } else {
            throw new Error("Unrecognized build output")
        }

        const output = new Promise((resolve, reject) =>
            zip.outputStream.pipe( fs.createWriteStream(zipPath) )
                .on("error", reject)
                .on("close", resolve)
        )

        zip.end()

        throw new Error("Debugging, dont cont")

        return output

    }
}
