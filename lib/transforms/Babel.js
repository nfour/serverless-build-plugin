import Babel from 'babel-core'

export default class BabelTransform {
    constructor(plugin, config) {
        this.plugin = plugin
        this.config = config
    }

    async transform(file) {
        const result = Babel.transform(file, this.config)

        return {
            code : result.code,
            map  : result.map
        }
    }
}
