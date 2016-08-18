import Promise from 'bluebird'
import path, { sep } from 'path'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import { walker } from './utils'
import glob from 'minimatch'

Promise.promisifyAll(fs)

/**
 *  This is intended to handle the inclusion of node_modules
 */
export default class SourceBundler {
    constructor(plugin) {
        this.plugin = plugin
    }

    /**
     *  Walks through, transforms, and zips any source content not ignored.
     *  Also allows for arbitrary includes.
     *
     *  @param {Yazl} artifactZip - Instance of Yazl
     *  @param {Array} whiteList
     *      [ "bluebird", ... ]
     */
    async bundle(artifactZip, { ignores = [], includes = [], transforms } = []) {
        const { servicePath } = this.plugin.serverless.config

        const onFile = (root, stats, next) => {
            const zipPath = path.join(root.split(servicePath)[1], stats.name).replace(/\/$/, '')
            const filePath = path.join(root, stats.name)

            const testPattern = (pattern) =>
                typeOf.RegExp(pattern) ? pattern.test(filePath) : glob(filePath, pattern)

            if ( includes.length ) {
                const isIncluded = includes.some(testPattern)

                if ( ! isIncluded ) {
                    console.log("--- NOT INCLUDED", filePath)
                    return null
                }
            }

            if ( ignores.length ) {
                const isIgnored = ignores.some(testPattern)

                if ( isIgnored ) {
                    console.log("--- IGNORED", filePath)
                    return null
                }
            }

            console.inspect({ zipPath })

            // TODO: create a buffer to add to the zip instead of filePath
            // in order for transforms to work.

            if ( transforms )
                for ( const transform of transforms ) transform(filePath)


            // artifactZip.addFile(filePath, zipPath, this.plugin.config.zip)
            next()
        }

        await walker(servicePath)
            .on('file', onFile)
            .end()

        return artifactZip
    }

    /**
     *  Finds both .serverless-include and .serverless-ignore files
     *  Generates a concatenated ignores and includes list.
     *
     *  All pathing is resolved to the servicePath, so that "*" in <servicePath>/lib/.serverless-ignore
     *  will be converted to "./lib/*", a relative path.
     *
     *  @returns {Object}
     *      {
     *          includes: [ "../../lib/**", ... ],
                ignores: [ ".git", "*", ... ]
     *      }
     */
    async _findConfigFiles(rootPath) {
        const includes = []
        const ignores = []

        const parseFile = (filePath) =>
            fs.readFileAsync(filePath).then((content) =>
                content.split('\n').map((line) => line.trim())
            )

        await walker(rootPath)
            .on('file', async (root, { name }, next) => {
                if ( name === '.serverless-ignore' ) {
                    const lines = await parseFile(root)
                    ignores.push(...lines)
                } else
                if ( name === '.serverless-include' ) {
                    const lines = await parseFile(root)
                    includes.push(...lines)
                }

                next()
            })
            .end()

        return { includes, ignores }
    }

}
