import React, {forwardRef, useImperativeHandle} from 'react';
import {View} from 'react-native';

export const mockTakePictureAsync = jest.fn().mockResolvedValue({
  uri: 'file:///tmp/mock_expo_camera_photo.jpg',
  width: 1920,
  height: 1080,
});

export const CameraView = forwardRef((props: any, ref: any) => {
  useImperativeHandle(ref, () => ({
    takePictureAsync: mockTakePictureAsync,
    pausePreview: jest.fn(),
    resumePreview: jest.fn(),
  }));

  return <View testID="expo-camera-view" {...props}>{props.children}</View>;
});

CameraView.displayName = 'CameraView';

let mockPermissionGranted = true;

export const setMockExpoPermission = (granted: boolean) => {
  mockPermissionGranted = granted;
};

export const mockRequestExpoPermission = jest.fn().mockImplementation(async () => {
  mockPermissionGranted = true;
  return {granted: true, status: 'granted', canAskAgain: true};
});

export const useCameraPermissions = jest.fn(() => [
  {granted: mockPermissionGranted, status: mockPermissionGranted ? 'granted' : 'denied', canAskAgain: true},
  mockRequestExpoPermission,
]);

export const Camera = {
  getCameraPermissionsAsync: jest.fn().mockResolvedValue({granted: true}),
  requestCameraPermissionsAsync: mockRequestExpoPermission,
};
