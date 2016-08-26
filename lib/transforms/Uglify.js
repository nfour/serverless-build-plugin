import path from 'path'

export default class UglifyTransform {
    constructor(config = {}, options = {}) {
        this.options = {
            skipOnError : true, // When false, errors will halt execution
            logErrors   : false,
            ...options
        }

        this.config = {
            dead_code : true,
            unsafe    : false,

            ...config
        }

        this.uglify = require('uglify-js')
    }

    run({ code, map, filePath }) {
        const fileName = path.basename(filePath)

        let result = { code, map }

        try {
            result = this.uglify.minify({ [fileName]: code }, {
                ...this.config,

                // Must pass through any previous source maps
                inSourceMap  : map
                    ? map
                    : null,

                outSourceMap : `${fileName}.map`,
                fromString   : true,
            })
        } catch (err) {
            if ( this.options.logErrors ) console.error(err)
            if ( ! this.options.skipOnError ) throw err
        }

        return result
    }
}
