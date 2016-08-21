import Promise from 'bluebird'
import path, { sep } from 'path'
import fs from 'fs-extra'
import { walker } from './utils'

const requireResolve = Promise.promisify( require('resolve') )
Promise.promisifyAll(fs)

/**
 *  This is intended to handle the inclusion of node_modules
 */
export default class ModuleBundler {
    constructor(plugin, artifact) {
        this.plugin   = plugin
        this.artifact = artifact
    }

    /**
     *  Determines module locations, copies them into ./node_modules inside the zip
     *
     *  @param {Array} includes
     *      [ "bluebird", ... ]
     */
    async bundle({ includes = [], excludes = [] }) {
        console.inspect({ includes })

        includes = includes.filter((packageName) => excludes.indexOf(packageName) > -1)

        const modules = await this._resolveDependencies(this.plugin.serverless.config.servicePath, { includes })

        await Promise.map(modules, async ({ packagePath, relativePath }) => {
            console.inspect(`Adding module ${relativePath}...`)

            const onFile = (root, stats, next) => {
                const zipPath = path.join('./node_modules', relativePath, root.split(relativePath)[1], stats.name).replace(/\/$/, '')
                const filePath = path.join(root, stats.name)

                console.inspect({ zipPath })

                // TODO: run optimizer here

                this.artifact.addFile(filePath, zipPath, this.plugin.config.zip)
                next()
            }

            await walker(packagePath)
                .on('file', onFile)
                .end()
        })

        return this.artifact
    }

    /**
     *  Resolves a packages dependencies to an array of paths.
     *
     *  @returns {Array}
     *      [ { name, packagePath, mainPath }, ... ]
     */
    async _resolveDependencies(initialPackageDir, { includes } = {}) {
        const resolvedDeps = []
        const cache        = {}
        const seperator    = `${sep}node_modules${sep}`

        /**
         *  Resolves paths first to their mainFile via require('resolve')()
         *  Then finds their package root directory & also resolves its packages recursively.
         *  - Will also ignore root package for results
         */
        async function recurse(packageDir) {
            const packageJson = require( path.join(packageDir, './package.json') )

            const { name, dependencies } = packageJson

            for ( let packageName in dependencies ) {
                if ( includes && includes.indexOf(packageName) === -1 ) continue

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
