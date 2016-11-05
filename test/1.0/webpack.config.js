const webpack = require('webpack');
const fs      = require('fs');
const path    = require('path');

const PRODUCTION = process.env.NODE_ENV === 'production';

const config = {
  entry     : PRODUCTION ? [] : ['source-map-support/register'],
  target    : 'node',
  externals : [
    'aws-sdk',
    'lutils',
  ],
  resolve: {
    extensions: ['.js', '.json'],
  },
  devtool : PRODUCTION ? null : 'source-map',
  plugins : PRODUCTION ? [
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        unused        : true,
        dead_code     : true,
        warnings      : false,
        drop_debugger : true,
      },
    }),
  ] : [],
  module: {
    loaders: [
      {
        test    : /\.js$/,
        loader  : 'babel',
        exclude : /node_modules/,
        query   : JSON.parse(fs.readFileSync(path.join(__dirname, './.babelrc'), 'UTF8')),
      },
      {
        test   : /\.json$/,
        loader : 'json',
      },
    ],
  },
};

module.exports = () => {
  return config;
};
