import Promise from 'bluebird'
import path from 'path'
import Yazl from 'yazl'
import Yauzl from 'yauzl'
import mkdirp from 'mkdirp'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import Yaml from 'js-yaml'

import ModuleBundler from './ModuleBundler'
import SourceBundler from './SourceBundler'
import FileBuild from './FileBuild'

Promise.promisifyAll(fs)

// FIXME: for debugging, remove later
console.inspect = (val, ...args) => console.log( require('util').inspect(val, { depth: 6, colors: true, ...args }) )

export default function (S) {
    const SCli = require(S.getServerlessPath('utils/cli')); // eslint-disable-line

    class ServerlessBuildPlugin extends S.classes.Plugin {


        config = {
            tryFiles          : [ "webpack.config.js" ],
            excludedExternals : [ 'aws-sdk' ],
            baseExcludes      : [ /\bnode_modules\b/ ],

            excludes : [],
            includes : [],

            uglify: true,
            babel: null,
            sourceMaps : true,

            // Passed to `yazl` as options
            zip: { compress: true },

            method : 'file',
            file   : null,

            functions: {}
        }

        /**
         *  This is intended to operate as a base configuration passed to each sub class.
         */
        constructor() {
            //
            // SERVERLESS
            //

            super()
            this.name = 'ServerlessBuildPlugin'

            // PLUGIN CONFIG GENERATION

            const servicePath     = S.config.projectPath
            const buildConfigPath = path.join(servicePath, './serverless.build.yml')

            const buildConfig = fs.existsSync(buildConfigPath)
                ? Yaml.load( fs.readFileSync(buildConfigPath) )
                : {}

            this.serverless = {
                config: { servicePath: servicePath },
                service: { package: {} },
                cli: SCli
            }
            // The config inherits from multiple sources
            this.config    = {
                ...this.config,
                ...buildConfig,
            }
        }

        async init(e) {
            const project = S.getProject()

            const { functions } = project

            this.serverless.service.service = project.name

            let selectedFunctions = typeOf.Array(project.getFunction(e.options.name))
                ? project.getFunction(e.options.name)
                : [ project.getFunction(e.options.name) ]


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

            console.inspect({ options: this.config })
            console.inspect({ functions: this.functions })

            return e
        }

        async registerHooks() {
            S.addHook(this.init.bind(this), {
                action: 'functionDeploy',
                event: 'pre'
            })
            S.addHook(this.build.bind(this), {
                action: 'codeDeployLambda',
                event: 'pre',
            })
            return
        }

        async build(e) {
            // TODO in the future:
            // - create seperate zips
            // - modify artifact completion process, splitting builds up into seperate artifacts

            const { method } = this.config

            let moduleIncludes = []

            // Set build paths
            this.tmpDir         = e.options.pathDist
            this.buildTmpDir    = path.join(this.tmpDir, './build')
            this.artifactTmpDir = path.join(e.options.pathDist, './artifacts')
            this.deployTmpDir = path.join(e.options.pathDist, './deploy')

            await fs.ensureDirAsync(this.buildTmpDir)
            await fs.ensureDirAsync(this.artifactTmpDir)

            const artifact = new Yazl.ZipFile()

            if ( method === 'copy' || method === 'babel' ) {
                //
                // SOURCE BUNDLER
                //

                const sourceBundler = new SourceBundler(this, artifact)

                for ( const fnKey in this.functions ) {
                    if (fnKey === e.options.name) {
                        const config = this.functions[fnKey]

                        console.inspect(`Bundling ${fnKey}...`)

                        // Synchronous for now, but can be parellel
                        config.package.excludes.push('_meta')

                        await sourceBundler.bundle({
                            excludes : config.package.excludes,
                            includes : config.package.includes,
                        })
                    }
                }
            } else if ( method === 'file' ) {
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

            // await new ServerlessBundler(this, artifact).bundle({
            //     includes: [ '*' ],
            //     excludes: [ 'build/**', 'artifacts/**' ]
            // })


            await this._completeArtifact(artifact, e)

            const zipPath = this.serverless.service.package.artifact

            await this._unpackZip(zipPath, e)

            const funcObj = this.functions[e.options.name]

            // Serverless 0.5 hack, rebuild a _serverless_handler.js file while still keeping env vars
            const [ handlerFile, handlerFunc ] = funcObj.handler.split('.')
            const deployTmpDir = path.join(e.options.pathDist, './deploy');

            const serverlessHandler = fs.readFileSync(`${e.options.pathDist}/_serverless_handler.js`, 'utf8')
            const oldExport = serverlessHandler.match(/exports\.handler = require\("(.*)"\)\["(.*)"\];/img)[0]
            const newExport = `exports.handler = require("./${funcObj.name}/${handlerFile}")["${handlerFunc}"]`
            fs.writeFileSync(`${deployTmpDir}/_serverless_handler.js`, serverlessHandler.replace(oldExport, newExport))

            e.options.pathDist = deployTmpDir
            return e
        }

        async _unpackZip(zipPath, e) {
            const deployTmpDir = `${e.options.pathDist}/deploy`

            return await new Promise((resolve, reject) => {
                Yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                    if (err) throw err

                    zipfile.readEntry()
                    zipfile.on("entry", function(entry) {
                        if (/\/$/.test(entry.fileName)) {
                            // directory file names end with '/'
                            mkdirp(`${deployTmpDir}/${entry.fileName}`, function(mkdirErr) {
                                if (mkdirErr) throw mkdirErr
                                zipfile.readEntry()
                            })
                        } else {
                            // file entry
                            zipfile.openReadStream(entry, function(rsErr, readStream) {
                                if (rsErr) throw rsErr
                                // ensure parent directory exists
                                mkdirp(path.dirname(`${deployTmpDir}/${entry.fileName}`), function(mkdirErr) {
                                    if (mkdirErr) throw mkdirErr
                                    readStream.pipe(fs.createWriteStream(`${deployTmpDir}/${entry.fileName}`))
                                    readStream.on("end", function() {
                                        zipfile.readEntry()
                                    })
                                })
                            })
                        }
                    })

                    zipfile.once("end", function() {
                        zipfile.close()
                        resolve()
                    })
                })
            })
        }


        /**
         *  Writes the `artifact` and attaches it to serverless
         */
        async _completeArtifact(artifact, e) {
            const artifactTmpDir = `${e.options.pathDist}/artifacts`
            // Purge existing artifacts
            if ( ! this.config.keep )
                await fs.emptyDirAsync(artifactTmpDir)

            const zipPath = path.resolve(artifactTmpDir, `./${this.serverless.service.service}-${e.options.name}-${new Date().getTime()}.zip`)

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

    return ServerlessBuildPlugin
}
