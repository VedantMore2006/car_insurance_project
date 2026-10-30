import React from 'react';
import {renderHook, act} from '@testing-library/react-native';
import {
  InspectionProvider,
  useInspection,
  initialClaimFormData,
} from '../../src/context/InspectionContext';
import {getSession} from '../../src/features/inspection/inspectionSession';
import {DetectionResult} from '../../src/features/inspection/types/detection.types';

describe('InspectionContext', () => {
  const sampleResult: DetectionResult = {
    requestId: 'req-ctx-001',
    modelName: 'yolov8n-tflite',
    image: {width: 1920, height: 1080},
    detections: [
      {
        classId: 0,
        className: 'dent',
        confidence: 0.95,
        bbox: {x1: 10, y1: 10, x2: 100, y2: 100},
      },
    ],
  };

  it('provides initial default state', async () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <InspectionProvider>{children}</InspectionProvider>
    );
    const {result} = await renderHook(() => useInspection(), {wrapper});

    expect(result.current.capturedImageURI).toBeNull();
    expect(result.current.damageResults).toBeNull();
    expect(result.current.claimFormData).toEqual(initialClaimFormData);
  });

  it('updates capturedImageURI correctly', async () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <InspectionProvider>{children}</InspectionProvider>
    );
    const {result} = await renderHook(() => useInspection(), {wrapper});

    await act(async () => {
      result.current.setCapturedImageURI('file:///tmp/car_photo.jpg');
    });

    expect(result.current.capturedImageURI).toBe('file:///tmp/car_photo.jpg');
  });

  it('updates damageResults and synchronizes with session', async () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <InspectionProvider>{children}</InspectionProvider>
    );
    const {result} = await renderHook(() => useInspection(), {wrapper});

    await act(async () => {
      result.current.setDamageResults(sampleResult);
    });

    expect(result.current.damageResults).toEqual(sampleResult);
    expect(getSession().result).toEqual(sampleResult);
  });

  it('updates claimFormData with partial updates', async () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <InspectionProvider>{children}</InspectionProvider>
    );
    const {result} = await renderHook(() => useInspection(), {wrapper});

    await act(async () => {
      result.current.setClaimFormData({
        claimantName: 'Sarah Connor',
        policyNumber: 'POL-999-XYZ',
      });
    });

    expect(result.current.claimFormData.claimantName).toBe('Sarah Connor');
    expect(result.current.claimFormData.policyNumber).toBe('POL-999-XYZ');
    expect(result.current.claimFormData.carRegistrationNumber).toBe('');
  });

  it('resets inspection state completely on resetInspectionState()', async () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <InspectionProvider>{children}</InspectionProvider>
    );
    const {result} = await renderHook(() => useInspection(), {wrapper});

    await act(async () => {
      result.current.setCapturedImageURI('file:///tmp/car.jpg');
      result.current.setDamageResults(sampleResult);
      result.current.setClaimFormData({claimantName: 'John Doe'});
    });

    expect(result.current.capturedImageURI).toBe('file:///tmp/car.jpg');

    await act(async () => {
      result.current.resetInspectionState();
    });

    expect(result.current.capturedImageURI).toBeNull();
    expect(result.current.damageResults).toBeNull();
    expect(result.current.claimFormData).toEqual(initialClaimFormData);
    expect(getSession().result).toBeNull();
  });

  it('provides safe fallback when used outside InspectionProvider', async () => {
    const {result} = await renderHook(() => useInspection());
    expect(result.current).not.toBeNull();
    expect(result.current.capturedImageURI).toBeNull();
    expect(result.current.damageResults).toBeNull();
    expect(result.current.claimFormData).toEqual(initialClaimFormData);
    expect(typeof result.current.resetInspectionState).toBe('function');
  });
});
