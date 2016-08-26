import gulp from 'gulp'
import Promise from 'bluebird'

Promise.promisifyAll(gulp)

let config = {}

gulp.task('test', async () => {
    console.log('test1')
    await Promise.delay(5)
    config = require('./webpack.config.js')()
    config.test = 1

    return config
})

export default async () => {
    await gulp.startAsync(['test'])

    return config
}
