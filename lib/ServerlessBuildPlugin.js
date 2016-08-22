import Promise from 'bluebird'
import path from 'path'
import Yazl from 'yazl'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import Yaml from 'js-yaml'

import ModuleBundler from './ModuleBundler'
import SourceBundler from './SourceBundler'
import FileBuild from './FileBuild'

Promise.promisifyAll(fs)

// FIXME: for debugging, remove later
console.inspect = (val, ...args) => console.log( require('util').inspect(val, { depth: 6, colors: true, ...args }) )

export default class ServerlessBuildPlugin {
    config = {
        tryFiles          : [ "webpack.config.js" ],
        excludedExternals : [ 'aws-sdk' ],
        baseExcludes      : [ /\bnode_modules\b/ ],

        excludes : [],
        includes : [],

        uglify: true,
        babel: null,

        // Passed to `yazl` as options
        zip: { compress: true },

        method : 'file',
        file   : null,

        functions: {}
    }

    /**
     *  This is intended to operate as a base configuration passed to each sub class.
     */
    constructor(serverless, options = {}) {
        //
        // SERVERLESS
        //

        this.serverless = serverless

        if ( ! this.serverless.getVersion().startsWith('1') )
            throw new this.serverless.classes.Error(
                'serverless-build-plugin requires serverless@1.x.x'
            )

        this.hooks = {
            'before:deploy:createDeploymentPackage': (...args) => this.build(...args)
        }

        //
        // PLUGIN CONFIG GENERATION
        //

        const { servicePath } = this.serverless.config
        const buildConfigPath = path.join(servicePath, './serverless.build.yml')

        const buildConfig = fs.existsSync(buildConfigPath)
            ? Yaml.load( fs.readFileSync(buildConfigPath) )
            : {}

        // The config inherits from multiple sources
        this.config    = {
            ...this.config,
            ...(this.serverless.service.custom.build || {}),
            ...buildConfig,
            ...options,
        }

        const { functions } = this.serverless.service

        let selectedFunctions = typeOf.Array(this.config.function)
            ? this.config.function
            : [ this.config.function ]

        selectedFunctions = selectedFunctions.filter((key) => key in functions )
        selectedFunctions = selectedFunctions.length ? selectedFunctions : Object.keys(functions)

        /**
         *  An array of full realized functions configs to build against.
         *  Inherits from
         *  - serverless.yml functions.<fn>.package
         *  - serverless.build.yml functions.<fn>
         *
         *  to generate includes, excludes
         */
        this.functions = selectedFunctions.reduce((obj, fnKey) => {
            const fnCfg      = functions[fnKey]
            const fnBuildCfg = this.config.functions[fnKey] || {}

            const includes = [
                ...( this.config.includes || [] ),
                ...( ( fnCfg.package && fnCfg.package.includes ) || [] ),
                ...( fnBuildCfg.includes || [] )
            ]

            const excludes = [
                ...( this.config.baseExcludes || [] ),
                ...( this.config.excludes || [] ),
                ...( ( fnCfg.package && fnCfg.package.excludes ) || [] ),
                ...( fnBuildCfg.excludes || [] )
            ]

            // Utilize the proposed `package` configuration for functions
            obj[fnKey] = {
                ...fnCfg,

                package: {
                    ...( fnCfg.package || {} ),
                    ...( this.config.functions[fnKey] || {} ),
                    includes, excludes
                }
            }

            return obj
        }, {})

        this.tmpDir         = path.join(servicePath, './.serverless')
        this.buildTmpDir    = path.join(this.tmpDir, './build')
        this.artifactTmpDir = path.join(this.tmpDir, './artifacts')

        console.inspect({ options: this.config })
        console.inspect({ functions: this.functions })
    }

    /**
     *  Builds either from file or through the babel optimizer.
     */
    async build() {
        // TODO in the future:
        // - create seperate zips
        // - modify artifact completion process, splitting builds up into seperate artifacts

        const { method }   = this.config
        let moduleIncludes = []

        await fs.ensureDirAsync(this.buildTmpDir)
        await fs.ensureDirAsync(this.artifactTmpDir)

        const artifact = new Yazl.ZipFile()

        if ( method === 'copy' || method === 'babel' ) {
            //
            // SOURCE BUNDLER
            //

            const sourceBundler = new SourceBundler(this, artifact)

            for ( const fnKey in this.functions ) {
                const config = this.functions[fnKey]

                console.inspect(`Bundling ${fnKey}...`)

                // Synchronous for now, but can be parellel
                await sourceBundler.bundle({
                    excludes : config.package.excludes,
                    includes : config.package.includes,
                })
            }
        } else
        if ( method === 'file' ) {
            //
            // BUILD FILE
            //

            // This builds all functions
            const fileBuild = await new FileBuild(this, artifact).build()

            moduleIncludes = fileBuild.externals
        } else {
            throw new Error("Unknown build method under `custom.build.method`")
        }

        await new ModuleBundler(this, artifact).bundle({
            includes: moduleIncludes,
            excludes: this.config.excludedExternals
        })

        await this._completeArtifact(artifact)

        if ( this.config.test )
            throw new Error("--test mode, DEBUGGING STOP")
    }

    /**
     *  Writes the `artifact` and attaches it to serverless
     */
    async _completeArtifact(artifact) {
        // Purge existing artifacts
        if ( ! this.config.keep )
            await fs.emptyDirAsync(this.artifactTmpDir)

        const zipPath = path.resolve(this.artifactTmpDir, `./${this.serverless.service.service}-${new Date().getTime()}.zip`)

        await new Promise((resolve, reject) => {
            artifact.outputStream.pipe( fs.createWriteStream(zipPath) )
                .on("error", reject)
                .on("close", resolve)

            artifact.end()
        })

        this.serverless.service.package.artifact = zipPath

        // Purge build dir
        if ( ! this.config.keep )
            await fs.emptyDirAsync(this.buildTmpDir)
    }
}
