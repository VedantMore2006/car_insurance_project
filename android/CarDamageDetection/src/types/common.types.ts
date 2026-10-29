export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
export type MediaType = 'image' | 'video';

export interface AppSettings {
  apiBaseUrl: string;
  confidenceThreshold: number;
  apiKey?: string;
}

export interface SelectedMedia {
  uri: string;
  mediaType: MediaType;
  width?: number;
  height?: number;
  fileName?: string;
  fileSize?: number;
  type?: string;
  duration?: number;
}

export type SelectedImage = SelectedMedia;

export interface HistoryEntry {
  id: string;
  createdAt: string; // ISO timestamp
  imageUri: string;
  detectionCount: number;
  status: 'success' | 'error' | 'no_detections';
  classNames: string[];
  mediaType?: MediaType;
  duration?: number;
}

export interface DamageSummaryReport {
  detectedLabels: string[];
  damageCount: number;
  highestConfidenceClass?: string;
  highestConfidence?: number;
  detections: {
    classId: number;
    className: string;
    confidence: number;
    bbox: {x1: number; y1: number; x2: number; y2: number};
  }[];
  imageUri?: string;
}

export interface ClaimFormData {
  claimantName: string;
  policyNumber: string;
  carRegistrationNumber: string;
  contactPhone: string;
}

export interface ClaimSubmissionPayload extends ClaimFormData {
  damageReport: DamageSummaryReport;
  submittedAt?: string;
}

export interface ClaimSubmissionResult {
  status: 'success' | 'error';
  claimId: string;
  referenceNumber: string;
  message: string;
  timestamp: string;
  isOffline?: boolean;
}

export interface ClaimHistoryEntry extends ClaimSubmissionPayload {
  claimId: string;
  referenceNumber: string;
  createdAt: string;
}

