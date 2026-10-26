module.exports = {
  preset: 'jest-expo',
  testTimeout: 20000,
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
};
