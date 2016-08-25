import Promise from 'bluebird'
import path, { sep } from 'path'
import fs from 'fs-extra'
import resolvePackage from 'resolve-pkg'

import { walker } from './utils'
import UglifyTransform from './transforms/Uglify'

Promise.promisifyAll(fs)

/**
 *  @class ModuleBundler
 *
 *  Handles the inclusion of node_modules.
 */
export default class ModuleBundler {
    constructor(config = {}, artifact) {
        this.config = {
            servicePath : '',   // serverless.config.servicePath
            uglify      : null, // UglifyJS config
            zip         : null, // Yazl zip config
            ...config,
        }

        this.artifact = artifact
    }

    /**
     *  Determines module locations then adds them into ./node_modules
     *  inside the artifact.
     */
    async bundle({ includes = [], excludes = [] }) {
        includes = includes.filter((packageName) => excludes.indexOf(packageName) < 0)

        const modules = await this._resolveDependencies(this.config.servicePath, { includes })

        const transforms = await this._createTransforms()

        await Promise.map(modules, async ({ packagePath, relativePath }) => {
            const onFile = async (root, stats, next) => {
                const relPath = path.join(
                    relativePath, root.split(relativePath)[1], stats.name
                ).replace(/^\/|\/$/g, '')

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

                    this.artifact.addBuffer( new Buffer(code), relPath, this.config.zip )
                } else {
                    //
                    // ARBITRARY FILES
                    //

                    this.artifact.addFile(filePath, relPath, this.config.zip)
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

        let uglifyConfig = this.config.uglify

        if ( uglifyConfig ) {
            if ( uglifyConfig === true ) uglifyConfig = null

            transforms.push( new UglifyTransform(uglifyConfig) )
        }

        return transforms
    }

    /**
     *  Resolves a package's dependencies to an array of paths.
     *
     *  @returns {Array}
     *      [ { name, packagePath, packagePath } ]
     */
    async _resolveDependencies(initialPackageDir, { includes = [] } = {}) {
        const resolvedDeps = []
        const cache        = {}
        const seperator    = `${sep}node_modules${sep}`

        /**
         *  Resolves packages to their package root directory & also resolves dependant packages recursively.
         *  - Will also ignore the input package in the results
         */
        async function recurse(packageDir, _includes = []) {
            const packageJson = require( path.join(packageDir, './package.json') )

            const { name, dependencies } = packageJson

            for ( let packageName in dependencies ) {
                if ( _includes.length && _includes.indexOf(packageName) === -1 ) continue

                const resolvedDir  = resolvePackage(packageName, { cwd: packageDir })
                const relativePath = path.join( 'node_modules', resolvedDir.split(`${seperator}`).slice(1).join(seperator) )

                if ( relativePath in cache ) continue

                cache[relativePath] = true

                const result = await recurse(resolvedDir)

                resolvedDeps.push({ ...result, relativePath })
            }

            return {
                name, packagePath: packageDir,
            }
        }

        await recurse(initialPackageDir, includes)

        return resolvedDeps
    }
}
