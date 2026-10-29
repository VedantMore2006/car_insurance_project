import React from 'react';
import {render, userEvent, waitFor} from '@testing-library/react-native';
import ClaimFormScreen from '../../src/features/inspection/screens/ClaimFormScreen';
import {setSessionResult, clearSession} from '../../src/features/inspection/inspectionSession';
import * as apiModule from '../../src/services/api';
import * as storageModule from '../../src/services/storage/historyStorage';

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
    }),
    useRoute: () => ({
      params: {
        imageUri: 'file:///tmp/vehicle_damage.jpg',
      },
    }),
  };
});

describe('ClaimFormScreen Component', () => {
  const sampleSessionResult = {
    requestId: 'req-claim-101',
    modelName: 'yolov8n-tflite',
    image: {width: 1920, height: 1080},
    detections: [
      {
        classId: 0,
        className: 'dent',
        confidence: 0.94,
        bbox: {x1: 50, y1: 50, x2: 250, y2: 250},
      },
      {
        classId: 1,
        className: 'scratch',
        confidence: 0.82,
        bbox: {x1: 300, y1: 100, x2: 500, y2: 200},
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearSession();
    setSessionResult(sampleSessionResult);
  });

  it('renders pre-populated damage summary from model output', async () => {
    const {getByTestId, getByText} = await render(<ClaimFormScreen />);

    expect(getByTestId('claim-form-screen')).toBeTruthy();
    expect(getByTestId('damage-summary-card')).toBeTruthy();

    // Damage count
    expect(getByTestId('damage-count-text')).toBeTruthy();
    expect(getByText('2 items detected')).toBeTruthy();

    // Highest confidence
    expect(getByTestId('highest-confidence-text')).toBeTruthy();
    expect(getByText(/dent \(94\.0%\)/)).toBeTruthy();

    // Damage labels chips
    expect(getByTestId('damage-labels-list')).toBeTruthy();
    expect(getByText('dent')).toBeTruthy();
    expect(getByText('scratch')).toBeTruthy();
  });

  it('renders 4 input fields for claimant details', async () => {
    const {getByTestId} = await render(<ClaimFormScreen />);

    expect(getByTestId('input-claimant-name')).toBeTruthy();
    expect(getByTestId('input-policy-number')).toBeTruthy();
    expect(getByTestId('input-car-reg')).toBeTruthy();
    expect(getByTestId('input-contact-phone')).toBeTruthy();
    expect(getByTestId('submit-claim-button')).toBeTruthy();
  });

  it('blocks submission and displays validation errors when fields are empty', async () => {
    const submitClaimSpy = jest.spyOn(apiModule, 'submitClaim');
    const {getByTestId, getByText} = await render(<ClaimFormScreen />);

    // Click submit with empty fields
    await userEvent.press(getByTestId('submit-claim-button'));

    await waitFor(() => {
      expect(getByTestId('error-claimant-name')).toBeTruthy();
      expect(getByText('Claimant name is required')).toBeTruthy();

      expect(getByTestId('error-policy-number')).toBeTruthy();
      expect(getByText('Policy number is required')).toBeTruthy();

      expect(getByTestId('error-car-reg')).toBeTruthy();
      expect(getByText('Car registration number is required')).toBeTruthy();

      expect(getByTestId('error-contact-phone')).toBeTruthy();
      expect(getByText('Contact phone number is required')).toBeTruthy();
    });

    // submitClaim must not be called
    expect(submitClaimSpy).not.toHaveBeenCalled();
    submitClaimSpy.mockRestore();
  });

  it('validates phone number format correctly', async () => {
    const {getByTestId, getByText} = await render(<ClaimFormScreen />);

    // Fill valid text in other fields
    await userEvent.type(getByTestId('input-claimant-name'), 'Alice Cooper');
    await userEvent.type(getByTestId('input-policy-number'), 'POL-123456');
    await userEvent.type(getByTestId('input-car-reg'), 'DL 01 AA 1111');
    await userEvent.type(getByTestId('input-contact-phone'), 'invalid-phone');

    await userEvent.press(getByTestId('submit-claim-button'));

    await waitFor(() => {
      expect(getByText('Please enter a valid phone number')).toBeTruthy();
    });
  });

  it('packages form data and damage summary, calls submitClaim, and navigates to ConfirmationScreen', async () => {
    const mockApiResponse = {
      status: 'success' as const,
      claimId: 'claim-uuid-777',
      referenceNumber: 'CLM-2026-F9A1B2',
      message: 'Claim registered',
      timestamp: '2026-10-29T10:00:00.000Z',
      isOffline: false,
    };

    const submitClaimSpy = jest
      .spyOn(apiModule, 'submitClaim')
      .mockResolvedValueOnce(mockApiResponse);
    const saveClaimEntrySpy = jest
      .spyOn(storageModule, 'saveClaimEntry')
      .mockResolvedValueOnce();

    const {getByTestId} = await render(<ClaimFormScreen />);

    // Fill all 4 valid fields
    await userEvent.type(getByTestId('input-claimant-name'), 'Sarah Connor');
    await userEvent.type(getByTestId('input-policy-number'), 'pol-998877-c');
    await userEvent.type(getByTestId('input-car-reg'), 'mh 04 cd 5678');
    await userEvent.type(getByTestId('input-contact-phone'), '+91 9876543210');

    await userEvent.press(getByTestId('submit-claim-button'));

    await waitFor(() => {
      expect(submitClaimSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claimantName: 'Sarah Connor',
          policyNumber: 'POL-998877-C',
          carRegistrationNumber: 'MH 04 CD 5678',
          contactPhone: '+91 9876543210',
          damageReport: expect.objectContaining({
            damageCount: 2,
            detectedLabels: ['dent', 'scratch'],
            highestConfidenceClass: 'dent',
          }),
        }),
      );

      expect(saveClaimEntrySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claimId: 'claim-uuid-777',
          referenceNumber: 'CLM-2026-F9A1B2',
          claimantName: 'Sarah Connor',
        }),
      );

      expect(mockReplace).toHaveBeenCalledWith(
        'Confirmation',
        expect.objectContaining({
          claimId: 'claim-uuid-777',
          referenceNumber: 'CLM-2026-F9A1B2',
          claimantName: 'Sarah Connor',
          policyNumber: 'POL-998877-C',
        }),
      );
    });

    submitClaimSpy.mockRestore();
    saveClaimEntrySpy.mockRestore();
  });
});
