import React, {forwardRef} from 'react';
import {View} from 'react-native';

export const mockCapturePhotoToFile = jest.fn().mockResolvedValue({
  filePath: '/tmp/test_captured_frame.jpg',
});

export const mockCapturePhoto = jest.fn().mockResolvedValue({
  saveToTemporaryFileAsync: jest
    .fn()
    .mockResolvedValue('/tmp/test_captured_frame.jpg'),
  dispose: jest.fn(),
});

export const mockRequestPermission = jest.fn().mockResolvedValue(true);

export const Camera = forwardRef<any, any>((props, ref) => {
  return (
    <View
      ref={ref}
      testID="mock-vision-camera"
      accessibilityLabel="Mock Vision Camera"
      {...props}
    />
  );
});

Camera.displayName = 'MockCamera';

export const defaultDevice = {
  id: 'back-camera',
  position: 'back',
  hasFlash: true,
  hasTorch: true,
  supportsSpeedQualityPrioritization: true,
};

export const defaultPermission = {
  hasPermission: true,
  canRequestPermission: true,
  requestPermission: mockRequestPermission,
  status: 'authorized',
};

let currentMockDevice: any = defaultDevice;
let currentMockPermission: any = defaultPermission;

export const setMockDevice = (device: any) => {
  currentMockDevice = device;
};

export const setMockPermission = (permission: any) => {
  currentMockPermission = permission;
};

export const resetCameraMocks = () => {
  currentMockDevice = defaultDevice;
  currentMockPermission = defaultPermission;
};

export const useCameraDevice = jest.fn(() => currentMockDevice);

export const useCameraPermission = jest.fn(() => currentMockPermission);

export const usePhotoOutput = jest.fn(() => ({
  capturePhotoToFile: mockCapturePhotoToFile,
  capturePhoto: mockCapturePhoto,
  prepareSettings: jest.fn().mockResolvedValue(undefined),
  supportsDepthDataDelivery: false,
  supportsCameraCalibrationDataDelivery: false,
}));
