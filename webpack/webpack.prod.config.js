var path = require('path')
module.exports = {
  mode: 'production',
  entry: [
    './samanage-api.js'
  ],
  output: {
    path: path.join(__dirname, '../dist'),
    filename: 'samanage-api.bundle.js',
    libraryTarget: 'commonjs2'
  },
  module: {
    rules: [{
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      include: [
        path.resolve(__dirname, '../src')
      ],
      loader: 'babel-loader',
      query: {
        presets: ['es2015', 'stage-1'],
        plugins: ['transform-class-properties']
      }
    }]
  },
  externals: {
    'fetch': 'commonjs fetch'
  }
}
