import Promise from 'bluebird'
import path, { sep } from 'path'
import fs from 'fs-extra'

const resolve = Promise.promisify( require('resolve') )
Promise.promisifyAll(fs)

/**
 *  This is intended to handle the inclusion of node_modules
 */
export default class Bundler {
    constructor(plugin) {
        this.plugin      = plugin
        this.serverless  = plugin.serverless
        this.buildTmpDir = plugin.buildTmpDir
    }

    async bundle() {
        const deps = await this._resolveDependencies(this.serverless.config.servicePath)

        await fs.mkdirsAsync(path.join(this.buildTmpDir, './node_modules'))

        console.inspect(deps)

        await Promise.map(deps, ({ name, packagePath }) => {
            console.log(`Copying ${name}...`)

            return this._copyPackage(packagePath, name)
        })

        throw new Error("---- serverless-build-plugin bundler finished")
    }

    /**
     *  Resolves a packages dependencies to an array of paths.
     *
     *  @returns {Array}
     *      [ { name, packagePath, mainPath }, ... ]
     */
    async _resolveDependencies(initialPackageDir) {
        const resolvedDeps = []
        const cache = {}

        /**
         *  Resolves paths first to their mainFile via require('resolve')()
         *  Then finds their package root directory & also resolves its packages recursively.
         */
        async function recurse(packageDir) {
            const packageJson = require( path.join(packageDir, './package.json') )

            const { name, dependencies } = packageJson

            for ( let packageName in dependencies ) {
                const mainFile      = await resolve(packageName, { basedir: packageDir })
                const folderlessMatch = `${sep}node_modules${sep}${packageName}.js`

                // Handle folderless modules by checking whether it ends like `/node_modules/file.js`
                if ( mainFile.indexOf(folderlessMatch, mainFile.length - folderlessMatch) !== -1 ) {
                    resolvedDeps.push({ name: packageName, mainPath: mainFile, packagePath: mainFile })
                    continue
                }

                const dirKey      = `${sep}node_modules${sep}${packageName}${sep}`
                const resolvedDir = path.normalize( mainFile.split(dirKey)[0] + dirKey )

                if ( resolvedDir in cache ) continue

                cache[resolvedDir] = true

                const result = await recurse(resolvedDir)
                resolvedDeps.push({ ...result, mainPath: mainFile })
            }

            return {
                name, packagePath: packageDir,
            }
        }

        await recurse(initialPackageDir)

        // We dont need the initial dep
        return resolvedDeps
    }

    async _copyPackage(packagePath, packageName) {
        // TODO: generate a better path that considers ./node_modules/package/node_modules/package
        // This will mean checking for multiple node_modules parents, as dependencies could be pathed
        // outside of the source directory, such as globals, parent projects etc.
        const saveToPath = path.join(this.buildTmpDir, path.join('./node_modules', packageName))
        console.log({ saveToPath })

        return fs.copyAsync(packagePath, saveToPath)
    }

}
