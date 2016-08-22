import Promise from 'bluebird'
import path, { sep } from 'path'
import fs from 'fs-extra'

import { walker } from './utils'
import UglifyTransform from './transforms/Uglify'

const requireResolve = Promise.promisify( require('resolve') )
Promise.promisifyAll(fs)

/**
 *  @class ModuleBundler
 *
 *  Handles the inclusion of node_modules.
 */
export default class ModuleBundler {
    constructor(plugin, artifact) {
        this.plugin   = plugin
        this.artifact = artifact
    }

    /**
     *  Determines module locations then adds them into ./node_modules
     *  inside the artifact.
     */
    async bundle({ includes = [], excludes = [] }) {
        includes = includes.filter((packageName) => excludes.indexOf(packageName) > -1)

        const modules = await this._resolveDependencies(this.plugin.serverless.config.servicePath, { includes })

        const transforms = await this._createTransforms()

        await Promise.map(modules, async ({ packagePath, relativePath }) => {
            console.inspect(`Adding module ${relativePath}...`)

            const onFile = async (root, stats, next) => {
                const relPath = path.join('./node_modules', relativePath, root.split(relativePath)[1], stats.name)
                    .replace(/^\/|\/$/g, '')

                const filePath = path.join(root, stats.name)

                if ( /\.js$/.test(filePath) ) {
                    //
                    // JAVASCRIPT MODULES, transformable
                    //

                    let code = await fs.readFileAsync(filePath, 'utf8')
                    let map = ''

                    /**
                     *  Runs transforms against the code, mutating it.
                     *  Excludes source maps for modules.
                     */
                    if ( transforms.length )
                        for ( let transformer of transforms ) {
                            let result = transformer.run({ code, map, filePath })

                            if ( result.code )
                                code = result.code
                        }

                    console.inspect({ code, filePath })

                    this.artifact.addBuffer( new Buffer(code), relPath, this.plugin.config.zip )
                } else {
                    //
                    // ARBITRARY FILES
                    //

                    this.artifact.addFile(filePath, relPath, this.plugin.config.zip)
                }

                next()
            }

            await walker(packagePath)
                .on('file', onFile)
                .end()
        })

        return this
    }

    async _createTransforms() {
        const transforms = []

        let uglifyConfig = this.plugin.config.uglify

        if ( uglifyConfig ) {
            if ( uglifyConfig === true ) uglifyConfig = null

            transforms.push( new UglifyTransform(this.plugin, uglifyConfig) )
        }

        return transforms
    }


    /**
     *  Resolves a package's dependencies to an array of paths.
     *
     *  @returns {Array}
     *      [ { name, packagePath, mainPath } ]
     */
    async _resolveDependencies(initialPackageDir, { includes = [] } = {}) {
        const resolvedDeps = []
        const cache        = {}
        const seperator    = `${sep}node_modules${sep}`

        const useIncludes = !! includes.length

        /**
         *  Resolves paths first to their mainFile via require('resolve')()
         *  Then finds their package root directory & also resolves its packages recursively.
         *  - Will also ignore root package for results
         */
        async function recurse(packageDir) {
            const packageJson = require( path.join(packageDir, './package.json') )

            const { name, dependencies } = packageJson

            for ( let packageName in dependencies ) {
                if ( useIncludes && includes.indexOf(packageName) === -1 ) continue

                const mainFile      = await requireResolve(packageName, { basedir: packageDir })
                const folderlessMatch = `${seperator}${packageName}.js`

                // Handle folderless modules by checking whether it ends like `/node_modules/file.js`
                if ( mainFile.indexOf(folderlessMatch, mainFile.length - folderlessMatch) !== -1 ) {
                    resolvedDeps.push({ name: packageName, mainPath: mainFile, packagePath: mainFile })
                    continue
                }

                const dirKey       = `${seperator}${packageName}${sep}`
                const resolvedDir  = path.normalize( mainFile.split(dirKey)[0] + dirKey )
                const relativePath = resolvedDir.split(seperator).slice(1).join(seperator)

                if ( relativePath in cache ) continue

                cache[relativePath] = true

                const result = await recurse(resolvedDir)

                resolvedDeps.push({ ...result, mainPath: mainFile, relativePath })
            }

            return {
                name, packagePath: packageDir,
            }
        }

        await recurse(initialPackageDir)

        return resolvedDeps
    }
}
