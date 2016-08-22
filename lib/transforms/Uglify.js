import Uglify from 'uglify-js'
import path from 'path'

export default class UglifyTransform {
    constructor(plugin, config = {}, options = {}) {
        this.plugin = plugin
        this.config = config
        this.options = {
            skipOnError: true, // When false, errors will halt execution
            ...options
        }
    }

    run({ code, map, filePath }) {
        const fileName = path.basename(filePath)

        let result = { code, map }

        try {
            result = Uglify.minify({ [fileName]: code }, {
                ...this.config,

                // Must pass through any previous source maps
                inSourceMap  : map
                    ? JSON.parse(map)
                    : null,

                outSourceMap : `${fileName}.map`,
                fromString   : true,
            })
        } catch (err) {
            if ( ! this.options.skipOnError ) throw err
        }

        return result
    }
}
