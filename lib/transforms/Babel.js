import Babel from 'babel-core'

export default class BabelTransform {
    constructor(plugin, config) {
        this.plugin = plugin
        this.config = config
    }

    async transform({ code }) {
        const result = Babel.transform(code, this.config)

        return {
            code : result.code,
            map  : result.map
        }
    }
}
