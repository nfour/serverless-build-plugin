const webpack = require('webpack');

const PROD = process.env.NODE_ENV === 'production';

module.exports = () => {
  return {
    externals   : ['aws-sdk'],
    performance : { hints: false },
    target      : 'node',

    resolve: { extensions: ['.js', '.json'] },

    module: {
      rules: [
        // JS
        {
          test    : /\.jsx?$/,
          use     : ['babel-loader'],
          exclude : [/node_modules/],
        },

        // JSON
        {
          test    : /\.json$/,
          loader  : ['json-loader'],
          exclude : [/node_modules/],
        },
      ],
    },
  };
};
