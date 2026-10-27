import {AxiosInstance, AxiosError, create as createAxiosInstance} from 'axios';
import {Platform} from 'react-native';
import {getApiBaseUrl, getApiKey} from './api/apiConfig';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DamageDetectionItem {
  classId: number;
  className: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface DamagePredictionResult {
  requestId?: string;
  modelName?: string;
  image: {
    width: number;
    height: number;
  };
  detections: DamageDetectionItem[];
  annotatedImageUri?: string | null;
  processingTimeMs?: number;
}

export interface PredictOptions {
  confidenceThreshold?: number;
  iouThreshold?: number;
  maxRetries?: number;
}

// ngrok base URL / VPS production endpoint, with HuggingFace Space as fallback
export const NGROK_BASE_URL = 'http://88.222.212.15:7000';
export const LIVE_VPS_BASE_URL = 'http://88.222.212.15:7000';
export const FALLBACK_HF_URL = 'https://cardd-damage-detection.hf.space';
export const DEFAULT_API_KEY =
  '***REMOVED-LEAKED-API-KEY***';

export const TIMEOUT_MS = 15000; // 15-second timeout requirement

/**
 * Axios instance configured with the ngrok/VPS base URL, API key, and 15-second timeout
 */
export function createApiClient(baseURL: string = NGROK_BASE_URL): AxiosInstance {
  const activeKey = getApiKey() || DEFAULT_API_KEY;
  return createAxiosInstance({
    baseURL,
    timeout: TIMEOUT_MS,
    headers: {
      'X-API-Key': activeKey,
      Accept: 'application/json',
    },
  });
}

// Default export Axios instance
export const api = createApiClient();

/**
 * Helper to sleep for retry delay
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Builds FormData containing the image file or base64 frame
 * Compatible with React Native iOS/Android native file uploads and web/node environments
 */
function buildMultipartFormData(
  imageBase64: string,
  options: PredictOptions = {},
): FormData {
  const formData = new FormData();
  const isFileUri =
    imageBase64.startsWith('file://') ||
    imageBase64.startsWith('content://') ||
    imageBase64.startsWith('ph://');

  const cleanBase64 = imageBase64.replace(
    /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
    '',
  );
  const dataUri = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${cleanBase64}`;

  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    // React Native's custom FormData object format for file attachments
    formData.append('image', {
      uri: isFileUri ? imageBase64 : dataUri,
      name: 'vehicle_scan.jpg',
      type: 'image/jpeg',
    } as any);
  } else {
    // Standard web / Node.js / test environment
    if (typeof Blob !== 'undefined') {
      try {
        const buffer =
          typeof Buffer !== 'undefined'
            ? Buffer.from(cleanBase64, 'base64')
            : new Uint8Array();
        const blob = new Blob([buffer], {type: 'image/jpeg'});
        formData.append('image', blob, 'vehicle_scan.jpg');
      } catch {
        formData.append('image', new Blob(['test-image']), 'vehicle_scan.jpg');
      }
    } else {
      formData.append('image', isFileUri ? imageBase64 : cleanBase64);
    }
  }

  if (typeof options.confidenceThreshold === 'number') {
    formData.append('confidenceThreshold', String(options.confidenceThreshold));
  }
  if (typeof options.iouThreshold === 'number') {
    formData.append('iouThreshold', String(options.iouThreshold));
  }

  return formData;
}

/**
 * POSTs the captured frame as multipart/form-data to /predict (with /api/v1/detect support)
 * and returns the parsed damage JSON.
 *
 * Implements:
 *  - 15-second timeout
 *  - Timeout-retry logic with exponential backoff (up to 2 retries)
 *  - Automatic fallback from ngrok/VPS URL to HuggingFace Space
 *  - Detailed console logging for all API requests and responses during integration
 *
 * @param imageBase64 Captured frame image URI (file://...) or base64 data string
 * @param options Confidence threshold, IoU threshold, and retry settings
 * @returns Parsed damage JSON matching DamagePredictionResult
 */
export async function predictDamage(
  imageBase64: string,
  options: PredictOptions = {},
): Promise<DamagePredictionResult> {
  const maxRetries = options.maxRetries ?? 2;
  const configuredBaseUrl = getApiBaseUrl();

  // Try user-configured URL first, then ngrok/VPS base URL, then HuggingFace Space fallback
  const candidateUrls: string[] = [];
  if (
    configuredBaseUrl &&
    configuredBaseUrl !== 'https://your-backend.example.com'
  ) {
    candidateUrls.push(configuredBaseUrl.replace(/\/+$/, ''));
  }
  if (!candidateUrls.includes(NGROK_BASE_URL)) {
    candidateUrls.push(NGROK_BASE_URL);
  }
  if (!candidateUrls.includes(FALLBACK_HF_URL)) {
    candidateUrls.push(FALLBACK_HF_URL);
  }

  const formData = buildMultipartFormData(imageBase64, options);
  let lastError: Error | null = null;

  for (const baseUrl of candidateUrls) {
    const activeKey = getApiKey() || DEFAULT_API_KEY;
    const client = createAxiosInstance({
      baseURL: baseUrl,
      timeout: TIMEOUT_MS,
      headers: {
        'X-API-Key': activeKey,
        'Content-Type': 'multipart/form-data',
        Accept: 'application/json',
      },
    });

    // POST to /predict first (primary route), fall back to /api/v1/detect if needed
    const targetEndpoints = ['/predict', '/api/v1/detect'];

    for (const endpoint of targetEndpoints) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(
            `[CarDD API Request] Attempt ${attempt + 1}/${maxRetries + 1} -> ${baseUrl}${endpoint}`,
          );

          const response = await client.post<DamagePredictionResult>(
            endpoint,
            formData,
          );

          // Log all API responses to the console during this integration phase
          console.log(
            `[CarDD API Response] (${response.status} OK from ${baseUrl}${endpoint}):`,
            JSON.stringify(response.data, null, 2),
          );

          // Validate and return parsed damage JSON
          const data = response.data;
          if (!data || !Array.isArray(data.detections)) {
            throw new Error('Invalid backend response: missing detections array');
          }

          return {
            requestId: data.requestId,
            modelName: data.modelName || 'yolov8n-tflite',
            image: data.image || {width: 640, height: 640},
            detections: data.detections.map(d => ({
              classId: d.classId,
              className: d.className || `Class-${d.classId}`,
              confidence: Number(d.confidence) || 0,
              bbox: {
                x1: Number(d.bbox?.x1) || 0,
                y1: Number(d.bbox?.y1) || 0,
                x2: Number(d.bbox?.x2) || 0,
                y2: Number(d.bbox?.y2) || 0,
              },
            })),
            annotatedImageUri: data.annotatedImageUri || null,
            processingTimeMs: data.processingTimeMs,
          };
        } catch (err: any) {
          const isTimeout =
            err.code === 'ECONNABORTED' ||
            err.message?.toLowerCase().includes('timeout');
          const isNetwork =
            err.message?.toLowerCase().includes('network') || !err.response;

          lastError = err;

          console.warn(
            `[CarDD API Warning] ${baseUrl}${endpoint} attempt ${attempt + 1} failed: ${err.message}`,
          );

          // Timeout-retry logic: retry with exponential backoff if attempts remain
          if ((isTimeout || isNetwork) && attempt < maxRetries) {
            const backoffMs = 800 * (attempt + 1);
            console.log(`[CarDD API Retry] Retrying in ${backoffMs}ms...`);
            await delay(backoffMs);
            continue;
          }

          // If endpoint returned 404, try the other endpoint immediately without wasting candidate retries
          if (err.response?.status === 404) {
            break;
          }

          // Non-retryable error (e.g. 401/403/422), break out
          break;
        }
      }
    }
  }

  const finalMessage =
    (lastError as AxiosError)?.response?.data ||
    lastError?.message ||
    'Network request failed. Please check backend connection.';

  throw new Error(
    typeof finalMessage === 'string'
      ? finalMessage
      : JSON.stringify(finalMessage),
  );
}

export default api;
