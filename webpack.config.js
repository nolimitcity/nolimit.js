const path = require('path');
const webpack = require('webpack');

function createConfig(filename, minimized) {
    return {
        mode: 'production',
        entry: './src/nolimit.js',
        output: {
            library: 'nolimit',
            path: path.resolve(__dirname, 'dist'),
            filename: filename
        },
        devtool: !minimized ? 'source-map' : undefined,
        module: {
            rules: [{test: /\.css$/, use: 'raw-loader'}],
        },
        optimization: {
            minimize: minimized
        },
        plugins: [
            new webpack.DefinePlugin({
                __VERSION__: JSON.stringify(process.env.npm_package_version)
            })
        ]
    };
}

module.exports = [
    createConfig('nolimit-latest.js', false),
    createConfig('nolimit-latest.min.js', true),
    createConfig(`nolimit-${process.env.npm_package_version}.js`, false),
    createConfig(`nolimit-${process.env.npm_package_version}.min.js`, true)
];
