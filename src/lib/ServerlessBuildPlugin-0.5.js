/* eslint-disable */
import Promise from 'bluebird'
import path from 'path'
import Yazl from 'yazl'
import Yauzl from 'yauzl'
import mkdirp from 'mkdirp'
import fs from 'fs-extra'
import { merge, typeOf } from 'lutils'
import Yaml from 'js-yaml'

import ModuleBundler from './ModuleBundler'
import SourceBundler from './SourceBundler'
import FileBuild from './FileBuild'

Promise.promisifyAll(fs)

export default function (S) {
    const SCli = require(S.getServerlessPath('utils/cli')); // eslint-disable-line

    class ServerlessBuildPlugin extends S.classes.Plugin {


        config = {
            tryFiles    : [ "webpack.config.js" ],
            baseExclude : [ /\bnode_modules\b/ ],

            modules: {
                exclude     : [ 'aws-sdk' ], // These match root dependencies
                deepExclude : [ 'aws-sdk' ], // These match deep dependencies
            },

            exclude : [],
            include : [],

            uglify        : true,
            uglifySource  : false,
            uglifyModules : true,

            babel      : null,
            sourceMaps : true,

            // Passed to `yazl` as options
            zip: { compress: true },

            method : 'bundle',
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
             *  in order to generate `include`, `exclude`
             */
            this.functions = selectedFunctions.reduce((obj, fnKey) => {
                const fnCfg      = functions[fnKey]
                const fnBuildCfg = this.config.functions[fnKey] || {}

                const include = [
                    ...( this.config.include || [] ),
                    ...( ( fnCfg.package && fnCfg.package.include ) || [] ),
                    ...( fnBuildCfg.include || [] )
                ]

                const exclude = [
                    ...( this.config.baseExclude || [] ),
                    ...( this.config.exclude || [] ),
                    ...( ( fnCfg.package && fnCfg.package.exclude ) || [] ),
                    ...( fnBuildCfg.exclude || [] )
                ]

                // Utilize the proposed `package` configuration for functions
                obj[fnKey] = {
                    ...fnCfg,

                    package: {
                        ...( fnCfg.package || {} ),
                        ...( this.config.functions[fnKey] || {} ),
                        include, exclude
                    }
                }

                return obj
            }, {})

            return e
        }

        async registerActions() {
            S.addAction(this.completeArtifact.bind(this), {
                handler:     'buildCompleteArtifact',
                description: 'Builds artifact for deployment'
            })
            return
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

            this.serverless.cli.log(`Serverless Build triggered for ${e.options.name}...`)

            const { method }   = this.config
            let moduleIncludes = []
            let moduleExcludes = []

            const funcObj = S.getProject().getFunction(e.options.name)
            const funcPath = path.relative(S.config.projectPath, funcObj.getRootPath())

            // Set build paths
            const deployConfig = {
                tmpDir         : e.options.pathDist,
                buildTmpDir    : path.join(e.options.pathDist, './build'),
                artifactTmpDir : path.join(e.options.pathDist, './artifacts'),
                deployTmpDir   : path.join(e.options.pathDist, './deploy'),
            }

            // Merge Deploy Config into event object
            merge(e, deployConfig)

            await fs.ensureDirAsync(deployConfig.buildTmpDir)
            await fs.ensureDirAsync(deployConfig.artifactTmpDir)

            const artifact = new Yazl.ZipFile()

            if ( method === 'bundle' ) {
                //
                // SOURCE BUNDLER
                //

                const sourceBundler = new SourceBundler({
                    ...this.config,
                    uglify      : this.config.uglifySource ? this.config.uglify : undefined,
                    servicePath : S.config.projectPath
                }, artifact)

                for ( const fnKey in this.functions ) {
                    if (fnKey === e.options.name) {
                        const config = this.functions[fnKey]

                        this.serverless.cli.log(`Bundling ${fnKey}...`)

                        // Synchronous for now, but can be parellel
                        config.package.exclude.push('_meta')

                        // If no includes are specified for function, then default to using the function folder
                        if (config.package.include.length < 1) {
                            config.package.include.push(`${funcPath}/**`)
                        }

                        await sourceBundler.bundle({
                            exclude : config.package.exclude,
                            include : config.package.include,
                        })
                    }
                }
            } else if ( method === 'file' ) {
                //
                // BUILD FILE
                //

                // This builds all functions
                const fileBuild = await new FileBuild({
                    ...this.config,
                    servicePath : S.config.projectPath,
                    buildTmpDir : deployConfig.buildTmpDir,
                    functions   : this.functions,
                    serverless  : this.serverless
                }, artifact).build()

                moduleIncludes = [ ...fileBuild.externals ] // Spread, for an iterator
            } else {
                throw new Error("Unknown build method under `custom.build.method`")
            }

            let funcModuleExcludes = []
            if (this.functions[e.options.name].package.modules) {
                funcModuleExcludes = this.functions[e.options.name].package.modules.exclude || []
            }

            moduleExcludes = [ ...this.config.modules.exclude, ...funcModuleExcludes ]

            await new ModuleBundler({
                ...this.config,
                uglify      : this.config.uglifyModules ? this.config.uglify : undefined,
                servicePath : S.config.projectPath
            }, artifact).bundle({
                include: moduleIncludes,
                exclude: moduleExcludes,
                deepExclude: this.config.modules.deepExclude
            })

            // Serverless 0.5 hack, rebuild a _serverless_handler.js file while still keeping env vars

            const [ handlerFile, handlerFunc ] = this.functions[e.options.name].handler.split('.')
            // Read existing handler from fs
            const serverlessHandler = fs.readFileSync(`${e.options.pathDist}/_serverless_handler.js`, 'utf8')
            /// Replace exported handler with correct path as per build process
            const oldExport = serverlessHandler.match(/exports\.handler = require\("(.*)"\)\["(.*)"\];/img)[0]
            const newExport = `exports.handler = require("./${funcPath}/${handlerFile}")["${handlerFunc}"]`
            // Add handler to zip
            artifact.addBuffer( new Buffer(serverlessHandler.replace(oldExport, newExport)), '_serverless_handler.js', this.config.zip )

            e.options.artifact = artifact

            return S.actions.buildCompleteArtifact(e)
        }

        async completeArtifact(e) {
            this.serverless.cli.log('Compiling deployment artifact')
            const zipPath = await this._completeArtifact({
                artifact: e.options.artifact,
                functionName: e.options.name,
                artifactTmpDir: e.artifactTmpDir,
                buildTmpDir: e.buildTmpDir,
            })

            await this._unpackZip({
                zipPath,
                deployTmpDir: e.deployTmpDir,
            })

            e.options.pathDist = e.deployTmpDir
            return e
        }

        async _unpackZip({ zipPath, deployTmpDir }) {
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
        async _completeArtifact({ artifact, functionName, artifactTmpDir, buildTmpDir }) {
            // Purge existing artifacts
            if ( ! this.config.keep )
                await fs.emptyDirAsync(artifactTmpDir)

            const zipPath = path.resolve(artifactTmpDir, `./${this.serverless.service.service}-${functionName}-${new Date().getTime()}.zip`)

            await new Promise((resolve, reject) => {
                artifact.outputStream.pipe( fs.createWriteStream(zipPath) )
                .on("error", reject)
                .on("close", resolve)

                artifact.end()
            })

            // Purge build dir
            if ( ! this.config.keep )
                await fs.emptyDirAsync(buildTmpDir)

            return zipPath
        }

    }

    return ServerlessBuildPlugin
}
