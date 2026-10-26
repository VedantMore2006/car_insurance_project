import httpDetectionService from '../../src/features/inspection/services/detectionService';
import {DetectionServiceError} from '../../src/features/inspection/types/detection.types';
import {setApiBaseUrl} from '../../src/services/api/apiConfig';

const originalFetch = global.fetch;

describe('httpDetectionService.analyzeImage', () => {
  beforeEach(() => {
    setApiBaseUrl('https://test-backend.example.com');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setApiBaseUrl(null);
  });

  it('parses a valid backend response into a DetectionResult', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
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
    }) as unknown as typeof fetch;

    const result = await httpDetectionService.analyzeImage(
      'file:///tmp/photo.jpg',
    );
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0].className).toBe('bonnet-dent');
    expect(result.image).toEqual({width: 800, height: 600});
  });

  it('returns an empty-detections result (not fabricated) for a valid no-damage response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({image: {width: 800, height: 600}, detections: []}),
    }) as unknown as typeof fetch;

    const result = await httpDetectionService.analyzeImage(
      'file:///tmp/photo.jpg',
    );
    expect(result.detections).toHaveLength(0);
  });

  it('rejects with a typed "server" error on a non-2xx response, never a fake success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }) as unknown as typeof fetch;

    await expect(
      httpDetectionService.analyzeImage('file:///tmp/photo.jpg'),
    ).rejects.toMatchObject({
      kind: 'server',
    });
  });

  it('rejects with a typed "network" error when fetch throws', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new Error('Failed to connect'),
      ) as unknown as typeof fetch;

    await expect(
      httpDetectionService.analyzeImage('file:///tmp/photo.jpg'),
    ).rejects.toBeInstanceOf(DetectionServiceError);
  });

  it('rejects with a "parse" error when the response body is not valid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'not json',
    }) as unknown as typeof fetch;

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
