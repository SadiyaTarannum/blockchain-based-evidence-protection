const webpack = require('webpack');

module.exports = function override(config) {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "url": require.resolve("url"),
        "zlib": require.resolve("browserify-zlib"),
        "tty": require.resolve("tty-browserify"),
        "fs": false, // fs is often not polyfilled in browser, or you use an empty mock
        "util": require.resolve("util"),
        // Explicitly target the browser version for process
        "process/browser": require.resolve('process/browser') // <-- IMPORTANT: Add this specific path
    });
    config.resolve.fallback = fallback;

    // Add the ProvidePlugin to make Buffer and process globally available where expected
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser', // Points to the installed 'process/browser'
            Buffer: ['buffer', 'Buffer']
        })
    ]);

    return config;
}