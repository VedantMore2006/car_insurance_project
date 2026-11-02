import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import DetectionResultsScreen from '../../src/features/inspection/screens/DetectionResultsScreen';
import {
  setSessionResult,
  clearSession,
} from '../../src/features/inspection/inspectionSession';
import {InspectionProvider} from '../../src/context/InspectionContext';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      replace: mockReplace,
      getParent: () => ({goBack: mockGoBack}),
    }),
    useRoute: () => ({
      params: {
        imageUri: 'file:///tmp/vehicle_damage.jpg',
        mediaType: 'image',
      },
    }),
  };
});

describe('DetectionResultsScreen (DamageOverlay)', () => {
  const sampleResult = {
    requestId: 'req-res-001',
    modelName: 'yolov8n-tflite',
    image: {width: 1920, height: 1080},
    detections: [
      {
        classId: 0,
        className: 'dent',
        confidence: 0.92,
        bbox: {x1: 100, y1: 100, x2: 300, y2: 300},
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearSession();
    setSessionResult(sampleResult);
  });

  it('renders damage detections and overlay action buttons', async () => {
    const {getByTestId, getByText} = await render(
      <InspectionProvider initialValues={{damageResults: sampleResult}}>
        <DetectionResultsScreen />
      </InspectionProvider>,
    );

    expect(getByTestId('proceed-to-claim-button')).toBeTruthy();
    expect(getByTestId('retake-scan-button')).toBeTruthy();
    expect(getByText('File Insurance Claim')).toBeTruthy();
    expect(getByText('Retake Scan')).toBeTruthy();
  });

  it('navigates to ClaimForm when File Insurance Claim is pressed', async () => {
    const {getByTestId} = await render(
      <InspectionProvider initialValues={{damageResults: sampleResult}}>
        <DetectionResultsScreen />
      </InspectionProvider>,
    );

    fireEvent.press(getByTestId('proceed-to-claim-button'));

    expect(mockNavigate).toHaveBeenCalledWith(
      'ClaimForm',
      expect.objectContaining({
        imageUri: expect.any(String),
      }),
    );
  });

  it('clears state and returns to the method-choice screen when Retake Scan is pressed', async () => {
    const {getByTestId} = await render(
      <InspectionProvider
        initialValues={{
          capturedImageURI: 'file:///tmp/vehicle_damage.jpg',
          damageResults: sampleResult,
        }}>
        <DetectionResultsScreen />
      </InspectionProvider>,
    );

    fireEvent.press(getByTestId('retake-scan-button'));

    expect(mockNavigate).toHaveBeenCalledWith('ImageSelection');
  });
});
