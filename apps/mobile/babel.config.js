module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel',
      [
        'module-resolver',
        {
          alias: {
            '@nimbus/shared': '../../shared/src',
          },
          extensions: ['.ts', '.tsx', '.js', '.json']
        },
      ],
    ],
  };
};


