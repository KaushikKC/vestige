const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  buffer: require.resolve('buffer/'),
};

// Force jose (used by Privy) to use its browser build instead of Node.js build
// This avoids imports of Node-only modules like 'crypto' and 'util'
config.resolver.unstable_conditionNames = ['browser', 'require', 'import'];

module.exports = config;
