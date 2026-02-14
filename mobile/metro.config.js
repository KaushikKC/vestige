// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add polyfill resolvers for Node.js built-ins used by Solana libs
config.resolver.extraNodeModules = {
  crypto: require.resolve('expo-crypto'),
  buffer: require.resolve('buffer/'),
};

module.exports = config;
