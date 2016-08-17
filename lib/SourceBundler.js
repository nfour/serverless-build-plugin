import Promise from 'bluebird'
import path, { sep } from 'path'
import fs from 'fs-extra'
import { walker } from './utils'

Promise.promisifyAll(fs)

/**
 *  This is intended to handle the inclusion of node_modules
 */
export default class SourceBundler {
    constructor(plugin) {
        this.plugin = plugin
    }

    /**
     *  Walks through, transforms, and adds to zip any source content not ignored.
     *
     *  @param {Yazl} artifactZip - Instance of Yazl
     *  @param {Array} whiteList
     *      [ "bluebird", ... ]
     */
    async bundle(artifactZip, whiteList) {
        console.inspect({ whiteList })

        whiteList = null // FIXME: testing
        const modules = await this._resolveDependencies(this.plugin.serverless.config.servicePath, { whiteList })

        await Promise.map(modules, async ({ packagePath, relativePath }) => {
            console.inspect(`Adding module ${relativePath}...`)

            const onFile = (root, stats, next) => {
                const zipPath = path.join('./node_modules', relativePath, root.split(relativePath)[1], stats.name).replace(/\/$/, '')
                const filePath = path.join(root, stats.name)
                console.inspect({ zipPath })
                artifactZip.addFile(filePath, zipPath)
                next()
            }

            await walker(packagePath)
                .on('file', onFile)
                .end()
        })

        return artifactZip
    }


    /**
     *  Resolves a packages dependencies to an array of paths.
     *
     *  @returns {Array}
     *      [ { name, packagePath, mainPath }, ... ]
     */
    async _resolveDependencies(initialPackageDir, { whiteList } = {}) {
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
                if ( whiteList && whiteList.indexOf(packageName) === -1 ) continue

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
