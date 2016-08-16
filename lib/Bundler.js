import Promise from 'bluebird'
import path, { sep } from 'path'
import fs from 'fs-extra'
import walk from 'walk'

const requireResolve = Promise.promisify( require('resolve') )
Promise.promisifyAll(fs)

/**
 *  This is intended to handle the inclusion of node_modules
 */
export default class Bundler {
    constructor(plugin) {
        this.plugin      = plugin
        this.serverless  = plugin.serverless
        this.buildTmpDir = plugin.buildTmpDir

        this.modulesTmpDir =  path.join(this.buildTmpDir, './node_modules')
    }

    async bundle() {
        //
        // NODE_MODULES
        //

        const modules = await this._resolveDependencies(this.serverless.config.servicePath)

        await fs.mkdirsAsync(this.modulesTmpDir)

        await Promise.map(modules, ({ name, packagePath, relativePath }) => {
            console.log(`Copying ${relativePath}...`)

            return this._copyPackage(packagePath, relativePath)
        })

        //
        // BUILD SOURCE
        //

        await this._buildSource()


        // Purge
        // if ( ! this.plugin.config.keep )
        //     await fs.emptyDirAsync(this.modulesTmpDir)

        throw new Error("---- serverless-build-plugin bundler finished")
    }

    async _buildSource() {
        const { servicePath } = this.serverless.config

        // FIXME: just testing rough copy
        await fs.copyAsync(servicePath, this.buildTmpDir, {
            clobber: true,
            filter: (filePath) => {
                return ! /\/node_modules\b|\/\.serverless\b/i.test(filePath)
            }
        })

        // The below should be used to minify copied files.
        // Building, however, should be very explicit and perhaps a different module

        //
        // const files = []
        // const w     = walk.walk(this.buildTmpDir)
        //
        // const onFile = (root, { name }, next) => {
        //     console.log('FILE', name)
        //     next()
        // }
        //
        // const onDirectory = (root, stat, next) => {
        //     console.log('DIR', root, stat)
        //     next()
        // }
        //
        // w.on('file', onFile)
        // w.on('directory', onDirectory)
        //
        // // Everything has been walked (not necessarily "read")
        // await new Promise((resolve, reject) => {
        //     w.on("errors", reject)
        //     w.on("end", resolve)
        // })
    }

    /**
     *  Resolves a packages dependencies to an array of paths.
     *
     *  @returns {Array}
     *      [ { name, packagePath, mainPath }, ... ]
     */
    async _resolveDependencies(initialPackageDir) {
        const resolvedDeps = []
        const cache        = {}
        const seperator    = `${sep}node_modules${sep}`

        /**
         *  Resolves paths first to their mainFile via require('resolve')()
         *  Then finds their package root directory & also resolves its packages recursively.
         */
        async function recurse(packageDir) {
            const packageJson = require( path.join(packageDir, './package.json') )

            const { name, dependencies } = packageJson

            for ( let packageName in dependencies ) {
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

        // We dont need the initial dep
        return resolvedDeps
    }

    async _copyPackage(packagePath, packageName) {
        // TODO: generate a better path that considers ./node_modules/package/node_modules/package
        // This will mean checking for multiple node_modules parents, as dependencies could be pathed
        // outside of the source directory, such as globals, parent projects etc


        console.log({ packagePath })

        const saveToPath = path.join(this.buildTmpDir, path.join('./node_modules', packageName))
        console.log({ saveToPath })

        return fs.copyAsync(packagePath, saveToPath)
    }

}
