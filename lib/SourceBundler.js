import Promise from 'bluebird'
import path from 'path'
import fs from 'fs-extra'
import { typeOf } from 'lutils'
import glob from 'minimatch'

import { walker } from './utils'
import BabelTransform from './transforms/Babel'
import UglifyTransform from './transforms/Uglify'

Promise.promisifyAll(fs)

/**
 *  @class SourceBundler
 *
 *  Handles the inclusion of source code in the artifact.
 */
export default class SourceBundler {
    constructor(plugin, artifact) {
        this.plugin   = plugin
        this.artifact = artifact
    }

    /**
     *  Walks through, transforms, and zips source content wich
     *  is both `included` and not `excluded` by the regex or glob patterns.
     */
    async bundle({ excludes = [], includes = [] }) {
        const { servicePath } = this.plugin.serverless.config

        const transforms = await this._createTransforms()

        // await this._findFilterFiles(servicePath)

        const onFile = async (root, stats, next) => {
            const relPath  = path.join(root.split(servicePath)[1], stats.name)
                .replace(/^\/|\/$/g, '')

            const filePath = path.join(root, stats.name)

            const testPattern = (pattern) =>
                typeOf.RegExp(pattern)
                    ? pattern.test(relPath)
                    : glob(relPath, pattern, { dot: true })

            if ( excludes.some(testPattern) ) return next()
            if ( ! includes.some(testPattern) ) return next()

            let code = await fs.readFileAsync(filePath, 'utf8')
            let map  = ''

            /**
             *  Runs transforms against the code, mutating the code & map
             *  with each iteration, optionally producing source maps
             */
            if ( transforms.length )
                for ( let transformer of transforms ) {
                    let result = transformer.run({ code, map, filePath })

                    if ( result.code ) {
                        code = result.code
                        map  = result.map
                    }
                }

            this.artifact.addBuffer( new Buffer(code), relPath, this.plugin.config.zip )

            if ( map )
                this.artifact.addBuffer( new Buffer(map), `${relPath}.map`, this.plugin.config.zip )

            next()
        }

        // We never want node_modules here
        await walker(servicePath, { filters: [ /\/node_modules\//i ] })
            .on('file', onFile)
            // .on('directory') TODO: add a directories callback to match against excludes to enhance performance
            .end()

        return this.artifact
    }

    async _createTransforms() {
        const { servicePath } = this.plugin.serverless.config

        const transforms = []

        if ( this.plugin.config.method === 'babel' ) {
            let babelQuery = this.plugin.config.babel

            if ( ! babelQuery ) {
                const babelrcPath = path.join(servicePath, '.babelrc')

                babelQuery = fs.existsSync(babelrcPath)
                    ? JSON.parse( await fs.readFileAsync(babelrcPath) )
                    : babelQuery
            }

            transforms.push( new BabelTransform(this.plugin, babelQuery) )
        }

        let uglifyConfig = this.plugin.config.uglify

        if ( uglifyConfig ) {
            if ( uglifyConfig === true ) uglifyConfig = null

            transforms.push( new UglifyTransform(this.plugin, uglifyConfig, { logErrors: false }) )
        }

        return transforms
    }

    /**
     *  FIXME: UNUSED
     *
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
     *
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

        return { includes, excludes }
    }

}
