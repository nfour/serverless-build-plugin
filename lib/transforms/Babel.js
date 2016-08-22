export default class BabelTransform {
    constructor(plugin, config = {}) {
        this.plugin = plugin
        this.config = {
            skipOnError: true, // When false, errors will halt execution
            ...config
        }

        this.babel = require('babel-core')
    }

    run({ code, map }) {
        let result = { code, map }

        try {
            result = this.babel.transform(code, this.config)
        } catch (err) {
            if ( ! this.config.skipOnError ) throw err
        }

        return result
    }
}
