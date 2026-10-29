import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import ConfirmationScreen from '../../src/features/inspection/screens/ConfirmationScreen';
import * as sessionModule from '../../src/features/inspection/inspectionSession';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useRoute: () => ({
      params: {
        claimId: 'claim-12345',
        referenceNumber: 'CLM-2026-E4D2B8',
        claimantName: 'Michael Knight',
        policyNumber: 'POL-777-KITT',
        carRegistrationNumber: 'KNIGHT 2000',
        contactPhone: '+1 555-0199',
        damageCount: 3,
        detectedLabels: ['dent', 'crack', 'lamp broken'],
        highestConfidenceClass: 'dent',
        highestConfidence: 0.965,
        submittedAt: '2026-10-29T10:30:00.000Z',
        imageUri: 'file:///tmp/transam.jpg',
        isOffline: false,
      },
    }),
  };
});

describe('ConfirmationScreen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders official claim reference number and success badge', async () => {
    const {getByTestId, getByText} = await render(<ConfirmationScreen />);

    expect(getByTestId('confirmation-screen')).toBeTruthy();
    expect(getByTestId('success-check-badge')).toBeTruthy();
    expect(getByText('Claim Registered')).toBeTruthy();

    expect(getByTestId('claim-reference-card')).toBeTruthy();
    expect(getByTestId('claim-reference-number')).toBeTruthy();
    expect(getByText('CLM-2026-E4D2B8')).toBeTruthy();
    expect(getByTestId('copy-reference-button')).toBeTruthy();
  });

  it('renders detailed receipt breakdown with claimant and damage details', async () => {
    const {getByTestId, getByText} = await render(<ConfirmationScreen />);

    expect(getByTestId('claim-details-card')).toBeTruthy();
    expect(getByText('Michael Knight')).toBeTruthy();
    expect(getByText('POL-777-KITT')).toBeTruthy();
    expect(getByText('KNIGHT 2000')).toBeTruthy();
    expect(getByText('+1 555-0199')).toBeTruthy();
    expect(getByText('3 items detected')).toBeTruthy();
    expect(getByText('dent, crack, lamp broken')).toBeTruthy();
  });

  it('clears inspection session and navigates back to Dashboard on Done press', async () => {
    const clearSessionSpy = jest.spyOn(sessionModule, 'clearSession');
    const {getByTestId} = await render(<ConfirmationScreen />);

    const doneButton = getByTestId('back-to-dashboard-button');
    fireEvent.press(doneButton);

    expect(clearSessionSpy).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'Dashboard',
    });

    clearSessionSpy.mockRestore();
  });

  it('clears inspection session and navigates to History tab on View in History press', async () => {
    const clearSessionSpy = jest.spyOn(sessionModule, 'clearSession');
    const {getByTestId} = await render(<ConfirmationScreen />);

    const historyButton = getByTestId('view-history-button');
    fireEvent.press(historyButton);

    expect(clearSessionSpy).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'History',
    });

    clearSessionSpy.mockRestore();
  });
});
