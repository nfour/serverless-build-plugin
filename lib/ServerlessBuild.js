import Promise from 'bluebird'
import path from 'path'
import Yazl from 'yazl'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import isStream from 'is-stream'

import WebpackBuilder from './Webpack'
import ModuleBundler from './ModuleBundler'

Promise.promisifyAll(fs)

// FIXME: for debugging, remove later
console.inspect = (val, ...args) => console.log( require('util').inspect(val, { depth: 6, colors: true, ...args }) )

export default class ServerlessBuild {
    config = {
        tryFiles: [
            "webpack.config.js",
            "build.js",
        ],

        bundle : null,
        file   : null,
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

        const { method } = this.config

        let artifactZip

        if ( method === 'copy' ) {
            1
        } else
        if ( method === 'babel' ) {
            1
        } else {
            artifactZip = await this._buildFromFile()
        }

        const moduleWhiteList = this.externals || null

        /**
         *  Includes all node_modules and their dependencies, also minifies. No dev deps.
         */
        await new ModuleBundler(this).bundle(artifactZip, moduleWhiteList)

        await this._completeArtifact(artifactZip)

        throw new Error("testing")

    }


    async _bundle() {
        return new Bundler(this, this.buildTmpDir).bundle() // TODO: improve these params, too brittle
    }

    async _buildBabel() {
        // TODO: This should build with babel on the .serverless/build directory only after _sourceCopy.
        //


    }

    async _sourceCopy() {
        // TODO: This is brittle, bringing in useless files
        // - use a module to determine require hierachy like webpack, but a "catch all" and only for source (exclude node_modules)
        // - or, use .gitignore, use .serverless-ignore etc.
        // - or, remove this completely and force a build method for this
        await fs.copyAsync(this.serverless.config.servicePath, this.buildTmpDir, {
            clobber: true,
            filter: (filePath) => {
                return ! /\/node_modules\b|\/\.serverless\b/i.test(filePath)
            }
        })
    }

    /**
     *  Handles building from a build file's output.
     */
    async _buildFromFile() {
        const {
            service : { service },
            config  : { servicePath }
        } = this.serverless

        //
        // RESOLVE BUILD FILE
        //

        let builderFilePath = await this._tryBuildFiles()

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
        const zipArtifact = new Yazl.ZipFile()
        const zipOptions  = { compress: true }

        //
        // HANDLE RESULT OUTPUT:
        // - String, Buffer or Stream:   piped as 'handler.js' into zip
        // - Webpack Config:             executed and output files are zipped
        //

        if ( typeOf.Object(result) ) {
            //
            // WEBPACK CONFIG
            //

            const { externals } = await new WebpackBuilder(this).build(result)

            this.externals = externals

            ;[ 'handler.js', `handler.js.map`].forEach(async (fileName) => {
                const filePath = path.resolve(this.buildTmpDir, fileName)

                const stats = await fs.statAsync(filePath)

                // Ensure file exists first
                if ( stats.isFile() )
                    zipArtifact.addFile(filePath, fileName, zipOptions)
            })
        } else
        if ( typeOf.String(result) || result instanceof Buffer ) {
            //
            // STRINGS, BUFFERS
            //

            if ( typeOf.String(result) ) result = new Buffer(result)

            zipArtifact.addBuffer(result, 'handler.js', zipOptions)

        } else
        if ( isStream(result) ) {
            //
            // STREAMS
            //

            zipArtifact.addReadStream(result, 'handler.js', zipOptions)

        } else {
            throw new Error("Unrecognized build output")
        }

        // TODO: read from serverless.yml -> package.includes for extenerals as well as excludes

        return zipArtifact
    }

    async _completeArtifact(artifactZip) {
        //
        // ZIP, CREATE ARTIFACT
        //

        // Purge existing artifacts
        if ( ! this.config.keep )
            await fs.emptyDirAsync(this.artifactTmpDir)

        const zipPath    = path.resolve(this.artifactTmpDir, `./${this.serverless.service.service}-${new Date().getTime()}.zip`)

        await new Promise((resolve, reject) => {
            artifactZip.outputStream.pipe( fs.createWriteStream(zipPath) )
                .on("error", reject)
                .on("close", resolve)

            artifactZip.end()
        })

        this.serverless.service.package.artifact = zipPath

        // Purge build dir
        if ( ! this.config.keep )
            await fs.emptyDirAsync(this.buildTmpDir)
    }


    async _tryBuildFiles() {
        for ( let fileName of this.config.tryFiles ) {
            const exists = await fs.statAsync(fileName).then((stat) => stat.isFile())

            if ( exists ) return fileName
        }

        return null
    }
}
