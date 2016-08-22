import Uglify from 'uglify-js'
import path from 'path'

export default class UglifyTransform {
    constructor(plugin, config = {}) {
        this.plugin = plugin
        this.config = config
    }

    transform({ code, map, filePath }) {
        const fileName = path.basename(filePath)

        const result = Uglify.minify({ [fileName]: code }, {
            ...this.config,

            // Must pass through any previous source maps
            inSourceMap  : map
                ? JSON.parse(map)
                : null,

            outSourceMap : `${fileName}.map`,
            fromString   : true,
        })

        return {
            code : result.code,
            map  : result.map,
        }
    }
}
