import axios from 'axios';
import {
  predictDamage,
  createApiClient,
  NGROK_BASE_URL,
  TIMEOUT_MS,
  DEFAULT_API_KEY,
} from '../../src/services/api';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('api.ts Service Layer', () => {
  const mockPost = jest.fn();
  const mockCreate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockReset();
    mockCreate.mockReturnValue({
      post: mockPost,
    });
    mockedAxios.create = mockCreate;
  });

  it('configures Axios instance with ngrok base URL and 15-second timeout', () => {
    const client = createApiClient();
    expect(client).toBeDefined();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: NGROK_BASE_URL,
        timeout: TIMEOUT_MS,
        headers: expect.objectContaining({
          'X-API-Key': DEFAULT_API_KEY,
          Accept: 'application/json',
        }),
      }),
    );
    expect(TIMEOUT_MS).toBe(15000);
  });

  it('posts image to /predict and parses the returned damage JSON', async () => {
    const mockBackendResponse = {
      status: 200,
      data: {
        requestId: 'test-req-999',
        modelName: 'yolov8n-tflite',
        image: {width: 1920, height: 1080},
        detections: [
          {
            classId: 1,
            className: 'scratch',
            confidence: 0.88,
            bbox: {x1: 10, y1: 20, x2: 150, y2: 250},
          },
        ],
        annotatedImageUri: null,
        processingTimeMs: 64.5,
      },
    };

    mockPost.mockResolvedValueOnce(mockBackendResponse);

    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await predictDamage('file:///mock/car_image.jpg', {
      confidenceThreshold: 0.3,
      iouThreshold: 0.45,
    });

    expect(result.requestId).toBe('test-req-999');
    expect(result.detections.length).toBe(1);
    expect(result.detections[0].className).toBe('scratch');
    expect(result.detections[0].confidence).toBe(0.88);
    expect(result.detections[0].bbox).toEqual({x1: 10, y1: 20, x2: 150, y2: 250});

    // Verify console response logging during integration phase
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CarDD API Response]'),
      expect.stringContaining('scratch'),
    );

    logSpy.mockRestore();
  });

  it('retries on timeout error before succeeding', async () => {
    const timeoutError = new Error('timeout of 15000ms exceeded');
    (timeoutError as any).code = 'ECONNABORTED';

    const successResponse = {
      status: 200,
      data: {
        requestId: 'retry-req-1',
        modelName: 'yolov8n-tflite',
        image: {width: 640, height: 640},
        detections: [],
      },
    };

    // First attempt fails with timeout, second succeeds
    mockPost
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(successResponse);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await predictDamage('data:image/jpeg;base64,ABCDEF==', {
      maxRetries: 1,
    });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(result.detections).toEqual([]);

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('handles empty-detection responses cleanly', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: {
        requestId: 'empty-req',
        modelName: 'yolov8n-tflite',
        image: {width: 640, height: 640},
        detections: [],
      },
    });

    const result = await predictDamage('file:///mock/clean_car.jpg');
    expect(result.detections).toHaveLength(0);
  });
});
