module.exports = {
  preset: 'jest-expo',
  testTimeout: 20000,
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^expo-video$': '<rootDir>/__mocks__/expo-video.tsx',
    '^react-native-vision-camera$':
      '<rootDir>/__mocks__/react-native-vision-camera.tsx',
  },
};
