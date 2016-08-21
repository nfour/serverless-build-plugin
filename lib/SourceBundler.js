import Promise from 'bluebird'
import path from 'path'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import { walker } from './utils'
import glob from 'minimatch'

Promise.promisifyAll(fs)

/**
 *  This is intended to handle the inclusion of node_modules
 */
export default class SourceBundler {
    constructor(plugin, artifact) {
        this.plugin   = plugin
        this.artifact = artifact
    }

    /**
     *  Walks through, transforms, and zips any source content not ignored.
     *  Also allows for arbitrary includes.
     *
     *  @param {Yazl} artifact - Instance of Yazl
     *  @param {Array} whiteList
     *      [ "bluebird", ... ]
     */
    async bundle({ excludes = [], includes = [], transforms }) {
        const { servicePath } = this.plugin.serverless.config

        await this._findFilterFiles(servicePath)

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

            if ( excludes.length ) {
                const isIgnored = excludes.some(testPattern)

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


            // this.artifact.addFile(filePath, zipPath, this.plugin.config.zip)
            next()
        }

        await walker(servicePath)
            .on('file', onFile)
            .end()

        return this.artifact
    }

    /**
     *  Finds both .serverless-include and .serverless-ignore files
     *  Generates a concatenated excludes and includes list.
     *
     *  All pathing is resolved to the servicePath, so that "*" in <servicePath>/lib/.serverless-ignore
     *  will be converted to "./lib/*", a relative path.
     *
     *  @returns {Object}
     *      {
     *          includes: [ "./lib/**", ... ],
     *          excludes: [ ".git", "*", ... ]
     *      }
     */
    async _findFilterFiles(rootPath) {
        const includes = []
        const excludes = []

        const parseFile = async (filePath) => {
            const parentDir = path.dirname(filePath)

            const file = await fs.readFileAsync(filePath, 'utf8')

            return file.split('\n')
                .filter((line) => /\S/.test(line) )
                .map((line) => {
                    line = line.trim()
                    line = path.join( parentDir.split(rootPath)[1] || '', line )
                        .replace(/^\/|\/$/g, '')

                    return `./${line}`
                })
        }

        await walker(rootPath, { filters: [ 'node_modules' ] })
            .on('file', async (root, { name }, next) => {
                const filePath = path.join(root, name)

                if ( name === '.serverless-ignore' ) {
                    const lines = await parseFile(filePath)
                    excludes.push(...lines)
                } else
                if ( name === '.serverless-include' ) {
                    const lines = await parseFile(filePath)
                    includes.push(...lines)
                }

                next()
            })
            .end()

        console.log({ includes, excludes })

        return { includes, excludes }
    }

}
