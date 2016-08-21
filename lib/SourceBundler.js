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

        // await this._findFilterFiles(servicePath)

        const onFile = async (root, stats, next) => {
            const relPath  = path.join(root.split(servicePath)[1], stats.name).replace(/^\/|\/$/g, '')
            const filePath = path.join(root, stats.name)

            const testPattern = (pattern) =>
                typeOf.RegExp(pattern)
                    ? pattern.test(relPath)
                    : glob(relPath, pattern, { dot: true })

            console.log(relPath, excludes.map((pattern) => {
                return { [pattern]: testPattern(pattern) }
            }))

            if ( excludes.some(testPattern) ) return next()
            if ( ! includes.some(testPattern) ) return next()

            console.log(``)
            console.log(`---- [ SourceBundler onFile ] - [ ${relPath} ]`)

            let file = fs.readFileAsync(filePath, 'utf8')

            if ( transforms ) {
                for ( const transform of transforms )
                    file = await transform(file)
            }

            this.artifact.addBuffer( new Buffer(file), relPath, this.plugin.config.zip )

            next()
        }

        // We never want node_modules here
        await walker(servicePath, { filters: [ /\/node_modules\//i ] })
            .on('file', onFile)
            // .on('directory') TODO: add a directories callback to match against excludes to enhance performance
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
