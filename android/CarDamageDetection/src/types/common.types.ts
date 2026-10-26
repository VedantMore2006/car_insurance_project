export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AppSettings {
  apiBaseUrl: string;
  confidenceThreshold: number;
}

export interface SelectedImage {
  uri: string;
  width?: number;
  height?: number;
  fileName?: string;
  fileSize?: number;
  type?: string;
}

export interface HistoryEntry {
  id: string;
  createdAt: string; // ISO timestamp
  imageUri: string;
  detectionCount: number;
  status: 'success' | 'error' | 'no_detections';
  classNames: string[];
}
