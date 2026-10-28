import httpDetectionService from '../../src/features/inspection/services/detectionService';
import {DetectionServiceError} from '../../src/features/inspection/types/detection.types';
import {setApiBaseUrl} from '../../src/services/api/apiConfig';

const originalFetch = global.fetch;
const originalXHR = global.XMLHttpRequest;

/**
 * postMultipart (used by analyzeImage) uses XMLHttpRequest rather than fetch, since Expo's global
 * fetch override rejects React Native's classic FormData file-part shape. This minimal mock drives
 * the same onload/onerror/ontimeout callbacks postMultipart relies on.
 */
class MockXHR {
  status = 0;
  responseText = '';
  timeout = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open = jest.fn();
  setRequestHeader = jest.fn();
  abort = jest.fn(() => this.onabort?.());
  send = jest.fn();
}

function mockXHRResponse(status: number, responseText: string) {
  global.XMLHttpRequest = jest.fn(() => {
    const xhr = new MockXHR();
    xhr.send = jest.fn(() => {
      xhr.status = status;
      xhr.responseText = responseText;
      queueMicrotask(() => xhr.onload?.());
    });
    return xhr;
  }) as unknown as typeof XMLHttpRequest;
}

function mockXHRNetworkError() {
  global.XMLHttpRequest = jest.fn(() => {
    const xhr = new MockXHR();
    xhr.send = jest.fn(() => {
      queueMicrotask(() => xhr.onerror?.());
    });
    return xhr;
  }) as unknown as typeof XMLHttpRequest;
}

describe('httpDetectionService.analyzeImage', () => {
  beforeEach(() => {
    setApiBaseUrl('https://test-backend.example.com');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalXHR;
    setApiBaseUrl(null);
  });

  it('parses a valid backend response into a DetectionResult', async () => {
    mockXHRResponse(
      200,
      JSON.stringify({
        image: {width: 800, height: 600},
        detections: [
          {
            classId: 7,
            className: 'bonnet-dent',
            confidence: 0.91,
            bbox: {x1: 10, y1: 20, x2: 100, y2: 120},
          },
        ],
      }),
    );

    const result = await httpDetectionService.analyzeImage(
      'file:///tmp/photo.jpg',
    );
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0].className).toBe('bonnet-dent');
    expect(result.image).toEqual({width: 800, height: 600});
  });

  it('returns an empty-detections result (not fabricated) for a valid no-damage response', async () => {
    mockXHRResponse(
      200,
      JSON.stringify({image: {width: 800, height: 600}, detections: []}),
    );

    const result = await httpDetectionService.analyzeImage(
      'file:///tmp/photo.jpg',
    );
    expect(result.detections).toHaveLength(0);
  });

  it('rejects with a typed "server" error on a non-2xx response, never a fake success', async () => {
    mockXHRResponse(500, 'Internal Server Error');

    await expect(
      httpDetectionService.analyzeImage('file:///tmp/photo.jpg'),
    ).rejects.toMatchObject({
      kind: 'server',
    });
  });

  it('rejects with a typed "network" error when the request fails', async () => {
    mockXHRNetworkError();

    await expect(
      httpDetectionService.analyzeImage('file:///tmp/photo.jpg'),
    ).rejects.toBeInstanceOf(DetectionServiceError);
  });

  it('rejects with a "parse" error when the response body is not valid JSON', async () => {
    mockXHRResponse(200, 'not json');

    await expect(
      httpDetectionService.analyzeImage('file:///tmp/photo.jpg'),
    ).rejects.toMatchObject({
      kind: 'parse',
    });
  });

  it('rejects with a "validation" error when no image uri is given', async () => {
    await expect(httpDetectionService.analyzeImage('')).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});

describe('httpDetectionService.checkHealth', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns true when /health responds ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({status: 'ok'}),
    }) as unknown as typeof fetch;
    await expect(httpDetectionService.checkHealth()).resolves.toBe(true);
  });

  it('returns false (never throws) when the backend is unreachable', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    await expect(httpDetectionService.checkHealth()).resolves.toBe(false);
  });
});
