import Promise from 'bluebird'
import path from 'path'
import Yazl from 'yazl'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import isStream from 'is-stream'
import WebpackBuilder from './Webpack'
import Bundler from './Bundler'

Promise.promisifyAll(fs)

// FIXME: for debugging
console.inspect = (val, ...args) => console.log( require('util').inspect(val, { depth: 6, colors: true, ...args }) )


export default class ServerlessBuild {
    config = {
        tryFiles: [
            "webpack.config.js",
            "build.js",
        ],

        artifact: 'handler.js'
    }

    constructor(serverless, options = {}) {
        this.serverless = serverless
        if ( ! this.serverless.getVersion().startsWith('1') )
            throw new this.serverless.classes.Error(
                'serverless-build-plugin requires serverless@1.x.x'
            )

        this.config    = {
            ...this.config,
            ...(this.serverless.service.custom.build || {}),
            ...options
        }

        this.hooks = {
            'before:deploy:createDeploymentPackage': (...args) => this.build(...args)
        }

        this.tmpDir         = path.join(this.serverless.config.servicePath, './.serverless')
        this.buildTmpDir    = path.join(this.tmpDir, './build')
        this.artifactTmpDir = path.join(this.tmpDir, './artifacts')

        console.log({ options: this.config })
    }

    /**
     *  Builds either from file or through the babel optimizer.
     */
    async build(...args) {
        console.log({ args }) // TODO: capture these

        if ( this.config.bundle )
            return this.bundle()
        else
            return this.buildFromFile()
    }

    /**
     *  Bundles the project, maintaining the same structure and minifying.
     *  Also includes all node_modules and their dependencies, also minified. No dev deps.
     */
    async bundle() {
        return new Bundler(this, this.buildTmpDir).bundle() // TODO: improve these params, too brittle
    }

    /**
     *  Handles building from a build file's output.
     */
    async buildFromFile() {
        const {
            service : { service },
            config  : { servicePath }
        } = this.serverless

        //
        // RESOLVE BUILD FILE
        //

        let builderFilePath = await this.tryBuildFiles()

        if ( ! builderFilePath )
            throw new Error("Unrecognized build file path")

        builderFilePath = path.resolve(servicePath, builderFilePath)

        let result = require(builderFilePath)

        // Resolve any functions...
        if ( typeOf.Function(result) )
            result = await Promise.try(() => result(this))

        // Ensure directories
        await fs.mkdirsAsync(this.buildTmpDir)
        await fs.mkdirsAsync(this.artifactTmpDir)

        // Prepare zip instance
        const zipPath    = path.resolve(this.artifactTmpDir, `./${service}-${new Date().getTime()}.zip`)
        const zip        = new Yazl.ZipFile()
        const zipOptions = { compress: true }

        //
        // HANDLE RESULT OUTPUT:
        // - String, Buffer or Stream:   piped as 'handler.js' into zip
        // - Webpack Config:             executed and output files are zipped
        //

        if ( typeOf.Object(result) ) {
            //
            // WEBPACK CONFIG
            //

            const logging = await this.buildWebpack(result)
            this.serverless.cli.log(logging)

            ;[ 'handler.js', `handler.js.map`].forEach((fileName) => {
                const filePath = path.resolve(this.buildTmpDir, fileName)

                zip.addFile(filePath, fileName, zipOptions)
            })

        } else
        if ( typeOf.String(result) || result instanceof Buffer ) {
            //
            // STRINGS, BUFFERS
            //

            if ( typeOf.String(result) ) result = new Buffer(result)

            zip.addBuffer(result, 'handler.js', zipOptions)

        } else
        if ( isStream(result) ) {
            //
            // STREAMS
            //

            zip.addReadStream(result, 'handler.js', zipOptions)

        } else {
            throw new Error("Unrecognized build output")
        }

        const output = new Promise((resolve, reject) =>
            zip.outputStream.pipe( fs.createWriteStream(zipPath) )
                .on("error", reject)
                .on("close", resolve)
        )

        zip.end()

        await output

        throw new Error("---- serverless-build-plugin buildFile finished")

        return output
    }


    async tryBuildFiles() {
        for ( let fileName of this.config.tryFiles ) {
            const exists = await fs.statAsync(fileName).then((stat) => stat.isFile())

            if ( exists ) return fileName
        }

        return null
    }


    /**
     *  Uses and extends a webpack config and runs it.
     */
    async buildWebpack(config) {
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

        return await new WebpackBuilder(config).build()
    }
}
