const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

let entry = [
    'babel-polyfill',
    './src/client/index'
];

let plugins = [];

let devtool = 'eval-source-map';
let outputPath = __dirname + '/dist';
let outputFilename = 'static/js/index.js';
let debug = true;

var prod = true;

var argv = {
    build: true
}

let PLATFORM = process.env.PLATFORM || argv.platform || 'web';
let mode = prod ? 'production' : 'development';

let target = 'web';
if (PLATFORM === 'electron') target = 'electron-renderer';
if (PLATFORM === 'android') target = 'web';

plugins.push(new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify(mode),
    'PLATFORM': JSON.stringify(PLATFORM)
}));

if (argv.build) {
    if (PLATFORM === 'web') {
        outputPath = __dirname + '/dist/web';
    }
    if (PLATFORM === 'electron') {
        outputPath = __dirname + '/../electron/www';
    }
    if (PLATFORM === 'android') {
        outputPath = __dirname + '/android';
    }

    let copyDest;
    if (PLATFORM === 'web') {
        copyDest = __dirname + '/dist/web';
    } else if (PLATFORM === 'electron') {
        copyDest = __dirname + '/../electron/www';
    } else {
        copyDest = __dirname + '/android';
    }
    plugins.push(new CopyWebpackPlugin([
        {from: 'src/client/resources', to: copyDest},
        {from: 'src/client/workers', to: copyDest + '/static/workers'}
    ]));

    devtool = false;
    debug = false;
}
else {
    entry.push('webpack-dev-server/client?http://localhost:4000');
    plugins.push(new CopyWebpackPlugin([{from: 'src/client/resources', to: './'}]));
}

let config = {
    entry: entry,
    output: {
        path: outputPath,
        filename: outputFilename
    },
    devServer: {
        static: './dist',
    },
    devtool: devtool,
    target: target,
    mode: mode,
    performance: {
        hints: false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000
    },
    module: {
        noParse: /.*[\/\\]bin[\/\\].+\.js/,
        rules: [
            {
                test: /.jsx?$/,
                include: [path.resolve(__dirname, 'src')],
                use: [{loader: 'babel-loader', options: {presets: ['@babel/preset-react', '@babel/preset-env']}}]
            },
            {
                test: /\.js$/,
                include: [path.resolve(__dirname, 'src')],
                use: [{loader: 'babel-loader', options: {presets: ['@babel/preset-env']}}]
            },
            {
                test: /\.(html|htm)$/,
                use: [{loader: 'dom'}]
            }
        ]
    },
    optimization: {
        minimize: prod,
        usedExports: true,
    },
    plugins: plugins
};

if (target === 'electron-renderer') {
    config.resolve = {alias: {'platform': path.resolve(__dirname, './src/client/platform/electron')}};
} else if (PLATFORM === 'android') {
    config.resolve = {alias: {'platform': path.resolve(__dirname, './src/client/platform/android')}};
} else {
    config.resolve = {alias: {'platform': path.resolve(__dirname, './src/client/platform/web')}};
}

module.exports = config;