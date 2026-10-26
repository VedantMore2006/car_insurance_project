/**
 * Internal detection contract. Field names are illustrative/proposed — no real backend exists in
 * this repo yet (see IMPLEMENTATION_PLAN.md). When a real backend contract is confirmed, only this
 * file + detectionService.ts should need to change; screens/components consume this shape only.
 */
export interface Detection {
  classId: number;
  className: string;
  confidence: number; // 0..1
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface DetectionImageMetadata {
  width: number;
  height: number;
}

export interface DetectionResult {
  requestId?: string;
  modelName?: string;
  image: DetectionImageMetadata;
  detections: Detection[];
  annotatedImageUri?: string;
  processingTimeMs?: number;
}

export interface DetectionRequestOptions {
  confidenceThreshold?: number;
  iouThreshold?: number;
  signal?: AbortSignal;
}

export type DetectionErrorKind =
  | 'network'
  | 'timeout'
  | 'server'
  | 'parse'
  | 'validation'
  | 'unsupported_format'
  | 'cancelled';

export class DetectionServiceError extends Error {
  kind: DetectionErrorKind;
  statusCode?: number;

  constructor(kind: DetectionErrorKind, message: string, statusCode?: number) {
    super(message);
    this.name = 'DetectionServiceError';
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

export interface DetectionService {
  analyzeImage(
    imageUri: string,
    options?: DetectionRequestOptions,
  ): Promise<DetectionResult>;
  checkHealth(): Promise<boolean>;
}
