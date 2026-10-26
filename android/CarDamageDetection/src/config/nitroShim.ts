// Safe runtime shim for Expo Go environment
// In Expo Go, native C++/Nitro turbo modules are not bundled, which causes
// top-level require('react-native-vision-camera') to throw ModuleNotFoundError.
// This shim provides a fallback proxy so the app boots smoothly in Expo Go.

const dummyCameraFactory = {
  cameraPermissionStatus: 'not-determined',
  microphonePermissionStatus: 'not-determined',
  requestCameraPermission: async () => false,
  requestMicrophonePermission: async () => false,
  supportsMultiCamSessions: false,
  createDeviceFactory: async () => ({
    getAvailableCameraDevices: () => [],
    addOnCameraDevicesChangedListener: () => ({remove: () => {}}),
  }),
  createPhotoOutput: () => ({}),
  createVideoOutput: () => ({}),
  createFrameOutput: () => ({}),
  createDepthFrameOutput: () => ({}),
  createPreviewOutput: () => ({}),
  createObjectOutput: () => ({}),
  createOutputSynchronizer: () => ({}),
  createZoomGestureController: () => ({}),
  createTapToFocusGestureController: () => ({}),
  createOrientationManager: () => ({}),
  createFrameRenderer: () => ({}),
  createNormalizedMeteringPoint: () => ({}),
  resolveConstraints: async () => ({}),
  createCameraSession: async () => ({}),
};

if (!(global as any).NitroModulesProxy) {
  (global as any).NitroModulesProxy = {
    version: '0.37.1',
    buildType: 'debug',
    createHybridObject: (_name: string) => dummyCameraFactory,
    hasHybridObject: () => false,
    isHybridObject: () => false,
    getAllHybridObjectNames: () => [],
    box: (obj: any) => ({unbox: () => obj}),
    hasNativeState: () => false,
    updateMemorySize: (obj: any) => obj,
    createNativeArrayBuffer: () => new ArrayBuffer(0),
    debug_getTotalAllocatedHybridObjects: () => 0,
  };
}

export {};
