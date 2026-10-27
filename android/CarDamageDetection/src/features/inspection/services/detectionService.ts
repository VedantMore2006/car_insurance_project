import {
  ApiClientError,
  postMultipart,
  getJson,
} from '../../../services/api/apiClient';
import {API_ENDPOINTS, buildUrl} from '../../../services/api/apiConfig';
import {getClassName} from '../../../config/damageClasses';
import {
  Detection,
  DetectionRequestOptions,
  DetectionResult,
  DetectionService,
  DetectionServiceError,
} from '../types/detection.types';

/**
 * Real HTTP-based implementation of DetectionService. There is currently NO live backend behind
 * this (see IMPLEMENTATION_PLAN.md) — calling analyzeImage against the default/placeholder base
 * URL will fail with a network or server error, which is the correct, honest behavior. This file
 * is the ONLY place that should need to change if the model is later deployed on-device instead of
 * behind an HTTP API (screens/hooks only depend on the DetectionService interface).
 */
function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.mp4')) {
    return 'video/mp4';
  }
  if (lower.endsWith('.mov')) {
    return 'video/quicktime';
  }
  if (lower.endsWith('.webm')) {
    return 'video/webm';
  }
  // Default to image/jpeg for device URIs (such as content:// or picker temp paths)
  return 'image/jpeg';
}

function parseDetectionResponse(raw: unknown): DetectionResult {
  if (typeof raw !== 'object' || raw === null) {
    throw new DetectionServiceError(
      'parse',
      'Backend response was not a JSON object',
    );
  }
  const obj = raw as Record<string, unknown>;
  const image = obj.image as Record<string, unknown> | undefined;
  if (
    !image ||
    typeof image.width !== 'number' ||
    typeof image.height !== 'number'
  ) {
    throw new DetectionServiceError(
      'parse',
      'Backend response missing valid image metadata',
    );
  }
  const rawDetections = obj.detections;
  if (!Array.isArray(rawDetections)) {
    throw new DetectionServiceError(
      'parse',
      'Backend response missing detections array',
    );
  }
  const detections: Detection[] = rawDetections.map((d, idx) => {
    const det = d as Record<string, unknown>;
    const classId = typeof det.classId === 'number' ? det.classId : -1;
    const confidence = typeof det.confidence === 'number' ? det.confidence : 0;
    const bbox = det.bbox as Record<string, unknown> | undefined;
    if (
      !bbox ||
      typeof bbox.x1 !== 'number' ||
      typeof bbox.y1 !== 'number' ||
      typeof bbox.x2 !== 'number' ||
      typeof bbox.y2 !== 'number'
    ) {
      throw new DetectionServiceError(
        'parse',
        `Detection at index ${idx} missing a valid bbox`,
      );
    }
    return {
      classId,
      className:
        typeof det.className === 'string'
          ? det.className
          : getClassName(classId),
      confidence,
      bbox: {x1: bbox.x1, y1: bbox.y1, x2: bbox.x2, y2: bbox.y2},
    };
  });

  return {
    requestId: typeof obj.requestId === 'string' ? obj.requestId : undefined,
    modelName: typeof obj.modelName === 'string' ? obj.modelName : undefined,
    image: {width: image.width as number, height: image.height as number},
    detections,
    annotatedImageUri:
      typeof obj.annotatedImageUri === 'string'
        ? obj.annotatedImageUri
        : undefined,
    processingTimeMs:
      typeof obj.processingTimeMs === 'number'
        ? obj.processingTimeMs
        : undefined,
  };
}

function toDetectionServiceError(err: unknown): DetectionServiceError {
  if (err instanceof DetectionServiceError) {
    return err;
  }
  if (err instanceof ApiClientError) {
    return new DetectionServiceError(
      err.info.kind,
      err.info.message,
      err.info.statusCode,
    );
  }
  const message =
    err instanceof Error ? err.message : 'Unknown detection error';
  return new DetectionServiceError('network', message);
}

export const httpDetectionService: DetectionService = {
  async analyzeImage(
    imageUri: string,
    options: DetectionRequestOptions = {},
  ): Promise<DetectionResult> {
    if (!imageUri) {
      throw new DetectionServiceError('validation', 'No image URI provided');
    }
    try {
      const formData = new FormData();
      const mimeType = guessMimeType(imageUri);
      if (mimeType === 'application/octet-stream') {
        throw new DetectionServiceError(
          'unsupported_format',
          'Unsupported image format. Please use JPEG or PNG.',
        );
      }
      const rawFilename =
        imageUri.split('/').pop()?.split('?')[0] ?? 'image.jpg';
      const name = rawFilename.includes('.')
        ? rawFilename
        : `${rawFilename}.jpg`;
      formData.append('image', {
        uri: imageUri,
        name,
        type: mimeType,
      } as unknown as Blob);
      if (options.confidenceThreshold !== undefined) {
        formData.append(
          'confidenceThreshold',
          String(options.confidenceThreshold),
        );
      }
      if (options.iouThreshold !== undefined) {
        formData.append('iouThreshold', String(options.iouThreshold));
      }

      const raw = await postMultipart<unknown>(
        buildUrl(API_ENDPOINTS.detect),
        formData,
        {
          signal: options.signal,
        },
      );
      return parseDetectionResponse(raw);
    } catch (err) {
      throw toDetectionServiceError(err);
    }
  },

  async checkHealth(): Promise<boolean> {
    try {
      await getJson<unknown>(buildUrl(API_ENDPOINTS.health), {timeoutMs: 6000});
      return true;
    } catch {
      return false;
    }
  },
};

export default httpDetectionService;
