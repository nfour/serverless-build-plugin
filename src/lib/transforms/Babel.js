import path from 'path'

export default class BabelTransform {
    constructor(config = {}, options = {}) {
        this.options = {
            skipOnError: true, // When false, errors will halt execution
            logErrors: true,
            ...options
        }

        this.config = {
            sourceMaps: "both",
            ...config
        }


        this.babel = require('babel-core')
    }

    run({ code, map, relPath }) {
        let result = { code, map }

        try {
            result = this.babel.transform(code, {
                ...this.config,
                sourceFileName        : relPath,
                sourceMapTarget       : relPath,
            })
        } catch (err) {
            if ( this.options.logErrors ) console.error(err)
            if ( ! this.options.skipOnError ) throw err
        }

        return result
    }
}
