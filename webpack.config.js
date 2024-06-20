const path = require('path');
const webpack = require('webpack');

function createConfig(filename) {
    return {
        mode: 'production',
        entry: './src/nolimit.js',
        output: {
            library: {
                name: 'nolimit',
                type: 'umd',
            },
            path: path.resolve(__dirname, 'dist'),
            filename: filename
        },
        devtool: 'source-map',
        module: {
            rules: [{test: /\.css$/, use: 'raw-loader'}],
        },
        plugins: [
            new webpack.DefinePlugin({
                __VERSION__: JSON.stringify(process.env.npm_package_version)
            })
        ]
    };
}

module.exports = [
    createConfig('nolimit-latest.js'),
    createConfig('nolimit-latest.min.js'),
    createConfig(`nolimit-${process.env.npm_package_version}.js`),
    createConfig(`nolimit-${process.env.npm_package_version}.min.js`)
];
