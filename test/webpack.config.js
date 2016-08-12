var webpack = require('webpack')
var fs      = require('fs')
var path    = require('path')

var PRODUCTION = process.env.NODE_ENV === 'production'

var config = {
    entry: PRODUCTION ? [] : [ 'source-map-support/register' ],
    target: 'node',
    externals: [
        'aws-sdk'
    ],
    resolve: {
        extensions: ['', '.js']
    },
    devtool: PRODUCTION ? null : 'source-map',
    plugins: PRODUCTION ? [
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                unused        : true,
                dead_code     : true,
                warnings      : false,
                drop_debugger : true
            }
        })
    ] : [],
    module: {
        loaders: [
            {
                test    : /\.js$/,
                loader  : 'babel',
                exclude : /node_modules/,
                query   : JSON.parse( fs.readFileSync( path.join(__dirname, '../.babelrc'), 'UTF8') )
            },
            {
                test: /\.json$/,
                loader: 'json'
            }
        ]
    }
}

module.exports = () => {
    return config
}
