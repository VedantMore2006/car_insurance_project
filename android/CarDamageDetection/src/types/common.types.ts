export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
export type MediaType = 'image' | 'video';

export interface AppSettings {
  apiBaseUrl: string;
  confidenceThreshold: number;
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
