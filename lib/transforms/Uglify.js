import Uglify from 'uglify-js'
import path from 'path'

export default class UglifyTransform {
    constructor(plugin, config = {}) {
        this.plugin = plugin
        this.config = {
            skipOnError: true, // When false, errors will halt execution
            ...config
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
            if ( ! this.config.skipOnError ) throw err
        }

        return result
    }
}
