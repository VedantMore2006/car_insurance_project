import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import CarScanScreen from '../../src/features/inspection/screens/CarScanScreen';
import {
  setMockDevice,
  setMockPermission,
  resetCameraMocks,
  mockCapturePhotoToFile,
  mockRequestPermission,
} from '../../__mocks__/react-native-vision-camera';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
  };
});

const mockPredictDamage = jest.fn();
jest.mock('../../src/services/api', () => {
  const actual = jest.requireActual('../../src/services/api');
  return {
    ...actual,
    predictDamage: (...args: any[]) => mockPredictDamage(...args),
  };
});

describe('CarScanScreen Component', () => {
  const sampleDetectionResult = {
    requestId: 'test-req-123',
    modelName: 'yolov8n-tflite',
    image: {width: 1000, height: 667},
    detections: [
      {
        classId: 0,
        className: 'dent',
        confidence: 0.94,
        bbox: {x1: 20, y1: 30, x2: 200, y2: 300},
      },
    ],
    annotatedImageUri: null,
    processingTimeMs: 55,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetCameraMocks();
    mockCapturePhotoToFile.mockResolvedValue({
      filePath: '/tmp/test_vehicle_scan.jpg',
    });
    mockPredictDamage.mockResolvedValue(sampleDetectionResult);
  });

  it('renders full-screen live camera view with silhouette guide and shutter in idle state', async () => {
    const {getByTestId, getByText} = await render(<CarScanScreen />);

    // Screen and live camera view
    expect(getByTestId('car-scan-screen')).toBeTruthy();
    expect(getByTestId('vision-camera-view')).toBeTruthy();

    // Semi-transparent vehicle silhouette guide
    expect(getByTestId('car-silhouette-guide')).toBeTruthy();
    expect(getByTestId('car-silhouette-svg')).toBeTruthy();
    expect(getByText('Align vehicle within guide')).toBeTruthy();

    // Circular shutter button fixed at bottom
    expect(getByTestId('shutter-button')).toBeTruthy();

    // Live status badge showing 30 FPS rendering
    expect(getByText('LIVE • 30 FPS')).toBeTruthy();

    // Top control buttons
    expect(getByTestId('car-scan-back')).toBeTruthy();
    expect(getByTestId('torch-toggle-button')).toBeTruthy();
  });

  it('toggles torch mode on button click', async () => {
    const {getByTestId, getByText} = await render(<CarScanScreen />);
    const torchButton = getByTestId('torch-toggle-button');

    // Default icon
    expect(getByText('💡')).toBeTruthy();

    // Press to turn on torch
    fireEvent.press(torchButton);
    await waitFor(() => {
      expect(getByText('⚡')).toBeTruthy();
    });

    // Press again to turn off torch
    fireEvent.press(torchButton);
    await waitFor(() => {
      expect(getByText('💡')).toBeTruthy();
    });
  });

  it('transitions from idle -> scanning -> captured state on shutter press', async () => {
    const onCaptureCompleted = jest.fn();
    const {getByTestId, queryByTestId, getByText} = await render(
      <CarScanScreen onCaptureCompleted={onCaptureCompleted} />,
    );

    const shutterButton = getByTestId('shutter-button');
    fireEvent.press(shutterButton);

    // Should call capturePhotoToFile
    expect(mockCapturePhotoToFile).toHaveBeenCalledTimes(1);

    // Transitions to captured state
    await waitFor(() => {
      expect(getByTestId('captured-freeze-frame')).toBeTruthy();
      expect(getByText('FRAME CAPTURED')).toBeTruthy();
    });

    // Silhouette guide and shutter button should be hidden in captured state
    expect(queryByTestId('car-silhouette-guide')).toBeNull();
    expect(queryByTestId('shutter-button')).toBeNull();

    // Retake and Analyse action buttons should be visible
    expect(getByTestId('retake-button')).toBeTruthy();
    expect(getByTestId('analyse-button')).toBeTruthy();
  });

  it('resets to idle live camera state when Retake button is pressed', async () => {
    const {getByTestId, queryByTestId, getByText} = await render(
      <CarScanScreen />,
    );

    // Press shutter to reach captured state
    fireEvent.press(getByTestId('shutter-button'));

    await waitFor(() => {
      expect(getByTestId('retake-button')).toBeTruthy();
    });

    // Press Retake
    fireEvent.press(getByTestId('retake-button'));

    // Should be back to idle state with live feed and shutter
    await waitFor(() => {
      expect(getByTestId('shutter-button')).toBeTruthy();
      expect(getByTestId('car-silhouette-guide')).toBeTruthy();
      expect(getByText('LIVE • 30 FPS')).toBeTruthy();
      expect(queryByTestId('captured-freeze-frame')).toBeNull();
      expect(queryByTestId('retake-button')).toBeNull();
    });
  });

  it('calls onCaptureCompleted callback when Analyse succeeds', async () => {
    const onCaptureCompleted = jest.fn();
    const {getByTestId} = await render(
      <CarScanScreen onCaptureCompleted={onCaptureCompleted} />,
    );

    // Capture frame
    fireEvent.press(getByTestId('shutter-button'));

    await waitFor(() => {
      expect(getByTestId('analyse-button')).toBeTruthy();
    });

    // Press Analyse
    fireEvent.press(getByTestId('analyse-button'));

    await waitFor(() => {
      expect(mockPredictDamage).toHaveBeenCalledWith(
        'file:///tmp/test_vehicle_scan.jpg',
        expect.objectContaining({
          confidenceThreshold: 0.25,
          maxRetries: 2,
        }),
      );
      expect(onCaptureCompleted).toHaveBeenCalledWith(
        'file:///tmp/test_vehicle_scan.jpg',
      );
    });
  });

  it('navigates to ImagePreview when Analyse is pressed without custom callback', async () => {
    const {getByTestId} = await render(<CarScanScreen />);

    // Capture frame
    fireEvent.press(getByTestId('shutter-button'));

    await waitFor(() => {
      expect(getByTestId('analyse-button')).toBeTruthy();
    });

    // Press Analyse
    fireEvent.press(getByTestId('analyse-button'));

    await waitFor(() => {
      expect(mockPredictDamage).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('ImagePreview', {
        imageUri: 'file:///tmp/test_vehicle_scan.jpg',
        mediaType: 'image',
      });
    });
  });

  it('handles empty-detection by showing No Damage Detected card with retake and proceed options', async () => {
    mockPredictDamage.mockResolvedValueOnce({
      ...sampleDetectionResult,
      detections: [], // Empty detections
    });

    const {getByTestId, queryByTestId, getByText} = await render(
      <CarScanScreen />,
    );

    // Capture frame
    fireEvent.press(getByTestId('shutter-button'));

    await waitFor(() => {
      expect(getByTestId('analyse-button')).toBeTruthy();
    });

    // Press Analyse
    fireEvent.press(getByTestId('analyse-button'));

    // Should display empty detection card
    await waitFor(() => {
      expect(getByTestId('no-damage-detected-card')).toBeTruthy();
      expect(getByText('No Damage Detected')).toBeTruthy();
      expect(getByTestId('no-damage-retake-button')).toBeTruthy();
      expect(getByTestId('no-damage-proceed-button')).toBeTruthy();
    });

    // Standard Analyse button should be hidden while showing the card
    expect(queryByTestId('analyse-button')).toBeNull();

    // Retake from empty card resets to idle
    fireEvent.press(getByTestId('no-damage-retake-button'));
    await waitFor(() => {
      expect(getByTestId('shutter-button')).toBeTruthy();
      expect(queryByTestId('no-damage-detected-card')).toBeNull();
    });
  });

  it('displays network-error banner and retry button when predictDamage fails', async () => {
    mockPredictDamage.mockRejectedValueOnce(
      new Error('Connection timed out after 15 seconds'),
    );

    const {getByTestId, getByText} = await render(<CarScanScreen />);

    // Capture frame
    fireEvent.press(getByTestId('shutter-button'));

    await waitFor(() => {
      expect(getByTestId('analyse-button')).toBeTruthy();
    });

    // Press Analyse -> fails
    fireEvent.press(getByTestId('analyse-button'));

    await waitFor(() => {
      expect(getByTestId('network-error-banner')).toBeTruthy();
      expect(getByText('Connection timed out after 15 seconds')).toBeTruthy();
      expect(getByTestId('retry-analyse-button')).toBeTruthy();
    });

    // Press Retry
    mockPredictDamage.mockResolvedValueOnce(sampleDetectionResult);
    fireEvent.press(getByTestId('retry-analyse-button'));

    await waitFor(() => {
      expect(mockPredictDamage).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('ImagePreview', {
        imageUri: 'file:///tmp/test_vehicle_scan.jpg',
        mediaType: 'image',
      });
    });
  });

  it('handles simulator / no camera device fallback gracefully', async () => {
    setMockDevice(undefined);

    const screen = await render(<CarScanScreen />);

    expect(screen.getByTestId('no-device-container')).toBeTruthy();
    expect(screen.getByText('Camera Device Unavailable')).toBeTruthy();

    const simulateButton = screen.getByTestId('simulate-capture-button');
    fireEvent.press(simulateButton);

    // Should transition to captured state with simulated frame
    await waitFor(() => {
      expect(screen.getByTestId('captured-freeze-frame')).toBeTruthy();
    });
  });

  it('displays permission prompt when camera access is not granted', async () => {
    setMockPermission({
      hasPermission: false,
      canRequestPermission: true,
      requestPermission: mockRequestPermission,
      status: 'not-determined',
    });

    const {getByTestId, getByText} = await render(<CarScanScreen />);

    expect(getByTestId('permission-container')).toBeTruthy();
    expect(getByText('Camera Access Required')).toBeTruthy();

    const grantButton = getByTestId('grant-permission-button');
    fireEvent.press(grantButton);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);

    const backButton = getByTestId('permission-back-button');
    fireEvent.press(backButton);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
