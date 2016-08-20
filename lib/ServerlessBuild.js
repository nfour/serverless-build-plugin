import Promise from 'bluebird'
import path from 'path'
import Yazl from 'yazl'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import isStream from 'is-stream'

import WebpackBuilder from './Webpack'
import ModuleBundler from './ModuleBundler'
import SourceBundler from './SourceBundler'

Promise.promisifyAll(fs)

// FIXME: for debugging, remove later
console.inspect = (val, ...args) => console.log( require('util').inspect(val, { depth: 6, colors: true, ...args }) )

export default class ServerlessBuild {
    config = {
        tryFiles: [
            "webpack.config.js",
        ],

        ignoredModules: [
            'aws-sdk'
        ],

        defaultIgnores: [
            /\bnode_modules\b/
        ],

        excludes : [],
        includes : [],

        // Passed to `yazl`
        zip: {
            compress: true
        },

        method : 'file',
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
            // 'before:deploy:functions': (...args) => console.log('beforeFun', ...args),
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

        //
        // TODO:
        // - pull out function definitions from this.config.functions (allows for commandline)
        // - Split this into buildFunction
        // - Loop over each function, passing through the same artifactZip
        // - pull in the serverless.build.yml exclude/include definitions
        // - add each functions files to the zip, overwriting
        // - deploy as normal
        //
        // TODO in the future:
        // - create seperate zips
        // - modify artifact completion process, splitting builds up into seperate artifacts
        //

        console.log({ args }) // TODO: capture these

        const { method } = this.config

        const artifactZip = new Yazl.ZipFile()

        if ( method === 'copy' || method === 'babel' ) {
            //
            // SOURCE BUNDLER
            //

            const transforms = []

            if ( method === 'babel' )
                transforms.push(this._babelTransform)

            await new SourceBundler(this).bundle(artifactZip, {
                transforms,
                excludes : [ ...this.config.defaultIgnores, ...this.config.excludes ],
                includes : this.config.includes,
            })
        } else
        if ( method === 'file' ) {
            //
            // BUILD FILE
            //

            await this._buildFromFile(artifactZip)
        } else {
            throw new Error("Unknown build method under `custom.build.method`")
        }

        const whiteList = this.externals || null

        /**
         *  Includes all node_modules and their dependencies, also minifies. No dev deps.
         */
        await new ModuleBundler(this).bundle(artifactZip, { whiteList })

        await this._completeArtifact(artifactZip)

        // throw new Error("testing")

    }

    async buildFunction() {


    }

    /**
     *  Babel transformer for use in SourceBundler
     */
    async _babelTransform(filePath) {
        console.log("transform", filePath)
    }

    /**
     *  Handles building from a build file's output.
     */
    async _buildFromFile(artifactZip) {
        const {
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

        //
        // HANDLE RESULT OUTPUT:
        //
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
                    artifactZip.addFile(filePath, fileName, this.config.zip)
            })
        } else
        if ( typeOf.String(result) || result instanceof Buffer ) {
            //
            // STRINGS, BUFFERS
            //

            if ( typeOf.String(result) ) result = new Buffer(result)

            artifactZip.addBuffer(result, 'handler.js', this.config.zip)

        } else
        if ( isStream(result) ) {
            //
            // STREAMS
            //

            artifactZip.addReadStream(result, 'handler.js', this.config.zip)

        } else {
            throw new Error("Unrecognized build output")
        }

        // TODO: read from serverless.yml -> package.includes for extenerals as well as excludes

        return artifactZip
    }

    /**
     *  Writes the `artifactZip` and attaches it to serverless
     */
    async _completeArtifact(artifactZip) {
        // Purge existing artifacts
        if ( ! this.config.keep )
            await fs.emptyDirAsync(this.artifactTmpDir)

        const zipPath = path.resolve(this.artifactTmpDir, `./${this.serverless.service.service}-${new Date().getTime()}.zip`)

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

    /**
     *  Allows for build files to be auto selected
     */
    async _tryBuildFiles() {
        for ( let fileName of this.config.tryFiles ) {
            const exists = await fs.statAsync(fileName).then((stat) => stat.isFile())

            if ( exists ) return fileName
        }

        return null
    }
}
