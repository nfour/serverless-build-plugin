import path, { sep } from 'path'
import Promise from 'bluebird'
import fs from 'fs-extra'

const resolve = Promise.promisify( require('resolve') )
Promise.promisifyAll(fs)

/**
 *  This is intended to handle the inclusion of node_modules
 */
export default class Bundler {
    constructor(plugin, destination) {
        console.log(plugin.serverless.serverlessPath)
        this.servicePath = plugin.serverless.config.servicePath
        this.destination = destination
    }

    /**
     *  Resolves a packages dependencies to an array of paths.
     *
     *  @returns {Array}
     *      [ { name, package, main }, ... ]
     */
    async resolveDependencies(initialPackageDir) {
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

    async copyPackage(packagePath, packageName) {
        // TODO: generate a better path that considers ./node_modules/package/node_modules/package
        const dest = path.join(this.destination, path.join('./node_modules', packageName))
        console.log(dest)

        return fs.copyAsync(packagePath, dest)
    }

    async bundle() {
        const deps = await this.resolveDependencies(this.servicePath)

        await fs.mkdirsAsync(path.join(this.destination, './node_modules'))

        console.inspect(deps)

        await Promise.map(deps, ({ name, packagePath }) => {
            console.log(`Copying ${name}...`)

            return this.copyPackage(packagePath, name)
        })

        throw new Error()
    }
}
