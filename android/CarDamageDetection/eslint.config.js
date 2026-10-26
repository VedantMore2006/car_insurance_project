const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**'],
    rules: {
      'react-hooks/purity': 'off',
      'import/no-named-as-default': 'off',
    },
  },
];
