import {renderHook, act, waitFor} from '@testing-library/react-native';
import useDetection from '../../src/hooks/useDetection';
import httpDetectionService from '../../src/features/inspection/services/detectionService';
import {DetectionServiceError} from '../../src/features/inspection/types/detection.types';

jest.mock('../../src/features/inspection/services/detectionService', () => ({
  __esModule: true,
  default: {analyzeImage: jest.fn(), checkHealth: jest.fn()},
}));

const mockedAnalyze = httpDetectionService.analyzeImage as jest.Mock;

describe('useDetection', () => {
  beforeEach(() => {
    mockedAnalyze.mockReset();
  });

  it('moves to success state with a result on a successful analyze', async () => {
    mockedAnalyze.mockResolvedValue({
      image: {width: 10, height: 10},
      detections: [],
    });
    const {result} = renderHook(() => useDetection());

    await act(async () => {
      await result.current.analyze('file:///a.jpg');
    });

    expect(result.current.state).toBe('success');
    expect(result.current.result?.detections).toEqual([]);
  });

  it('moves to error state with a typed error on failure, never a fake success', async () => {
    mockedAnalyze.mockRejectedValue(
      new DetectionServiceError('network', 'no connection'),
    );
    const {result} = renderHook(() => useDetection());

    await act(async () => {
      await result.current.analyze('file:///a.jpg');
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error?.kind).toBe('network');
    expect(result.current.result).toBeNull();
  });

  it('ignores a duplicate analyze call while one is already in flight', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mockedAnalyze.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFirst = resolve;
        }),
    );
    const {result} = renderHook(() => useDetection());

    act(() => {
      result.current.analyze('file:///a.jpg');
    });
    await waitFor(() => expect(result.current.state).toBe('uploading'));

    act(() => {
      result.current.analyze('file:///a.jpg'); // duplicate tap while in flight
    });

    expect(mockedAnalyze).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({image: {width: 1, height: 1}, detections: []});
    });
  });

  it('retry re-runs analyze with the last used image uri', async () => {
    mockedAnalyze.mockResolvedValue({
      image: {width: 1, height: 1},
      detections: [],
    });
    const {result} = renderHook(() => useDetection());

    await act(async () => {
      await result.current.analyze('file:///a.jpg');
    });
    await act(async () => {
      result.current.retry();
    });

    expect(mockedAnalyze).toHaveBeenCalledTimes(2);
    expect(mockedAnalyze.mock.calls[1][0]).toBe('file:///a.jpg');
  });

  it('reset clears result/error back to idle so a new selection has no stale data', async () => {
    mockedAnalyze.mockResolvedValue({
      image: {width: 1, height: 1},
      detections: [],
    });
    const {result} = renderHook(() => useDetection());

    await act(async () => {
      await result.current.analyze('file:///a.jpg');
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.imageUri).toBeNull();
  });
});
