import {useCallback, useRef, useState} from 'react';
import httpDetectionService from '../features/inspection/services/detectionService';
import {
  DetectionRequestOptions,
  DetectionResult,
  DetectionServiceError,
} from '../features/inspection/types/detection.types';

export type DetectionLifecycleState =
  | 'idle'
  | 'selecting'
  | 'previewing'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled';

interface UseDetectionState {
  state: DetectionLifecycleState;
  result: DetectionResult | null;
  error: DetectionServiceError | null;
  imageUri: string | null;
}

const initialState: UseDetectionState = {
  state: 'idle',
  result: null,
  error: null,
  imageUri: null,
};

/**
 * Models the inspection lifecycle explicitly rather than ad hoc booleans. Guards against:
 * - duplicate requests from repeated taps (ignored while uploading/processing)
 * - stale results leaking onto a newly selected image (requestId token check + reset())
 * - retrying with a stale image/options (retry always re-reads the latest imageUri/options refs)
 */
export function useDetection() {
  const [data, setData] = useState<UseDetectionState>(initialState);
  const requestToken = useRef(0);
  const lastOptionsRef = useRef<DetectionRequestOptions | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectImage = useCallback((uri: string) => {
    requestToken.current += 1;
    setData({state: 'previewing', result: null, error: null, imageUri: uri});
  }, []);

  const reset = useCallback(() => {
    requestToken.current += 1;
    abortControllerRef.current?.abort();
    setData(initialState);
  }, []);

  const analyze = useCallback(
    async (uri?: string, options?: DetectionRequestOptions) => {
      const targetUri = uri ?? data.imageUri;
      if (!targetUri) {
        return;
      }
      // Guard against duplicate in-flight requests from repeated taps.
      if (data.state === 'uploading' || data.state === 'processing') {
        return;
      }

      const myToken = (requestToken.current += 1);
      lastOptionsRef.current = options;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setData(prev => ({
        ...prev,
        state: 'uploading',
        error: null,
        imageUri: targetUri,
      }));

      try {
        const result = await httpDetectionService.analyzeImage(targetUri, {
          ...options,
          signal: controller.signal,
        });
        if (requestToken.current !== myToken) {
          return;
        } // stale response, a newer request superseded it
        setData({state: 'success', result, error: null, imageUri: targetUri});
      } catch (err) {
        if (requestToken.current !== myToken) {
          return;
        }
        const detectionError =
          err instanceof DetectionServiceError
            ? err
            : new DetectionServiceError(
                'network',
                'Unexpected error during detection',
              );
        if (detectionError.kind === 'cancelled') {
          setData(prev => ({
            ...prev,
            state: 'cancelled',
            error: detectionError,
          }));
        } else {
          setData(prev => ({...prev, state: 'error', error: detectionError}));
        }
      }
    },
    [data.imageUri, data.state],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    requestToken.current += 1;
    setData(prev => ({...prev, state: 'cancelled'}));
  }, []);

  const retry = useCallback(() => {
    if (!data.imageUri) {
      return;
    }
    analyze(data.imageUri, lastOptionsRef.current);
  }, [analyze, data.imageUri]);

  return {
    state: data.state,
    result: data.result,
    error: data.error,
    imageUri: data.imageUri,
    selectImage,
    analyze,
    cancel,
    retry,
    reset,
  };
}

export default useDetection;
