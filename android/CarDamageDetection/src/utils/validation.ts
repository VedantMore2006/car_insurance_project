const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
  'video/3gpp',
];
const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_VIDEO_DURATION_SECONDS = 60; // 60s

export interface MediaValidationInput {
  uri?: string | null;
  type?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  mediaType?: 'image' | 'video';
}

export type ImageValidationInput = MediaValidationInput;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSelectedMedia(
  input: MediaValidationInput,
): ValidationResult {
  const errors: string[] = [];

  if (!input.uri) {
    errors.push('No media was selected.');
    return {valid: false, errors};
  }

  const isVideo =
    input.mediaType === 'video' ||
    (input.type && input.type.toLowerCase().startsWith('video/'));

  if (isVideo) {
    if (
      input.type &&
      !SUPPORTED_VIDEO_MIME_TYPES.includes(input.type.toLowerCase())
    ) {
      errors.push(
        `Unsupported video format "${input.type}". Please choose an MP4 or MOV video.`,
      );
    }

    if (input.fileSize && input.fileSize > MAX_VIDEO_FILE_SIZE_BYTES) {
      errors.push(
        'Video is too large (max 100MB). Please choose a smaller video.',
      );
    }

    if (input.duration && input.duration > 0) {
      const durationSeconds =
        input.duration > 100 ? input.duration / 1000 : input.duration;
      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        errors.push(
          `Video is too long (${Math.round(
            durationSeconds,
          )}s). Maximum duration is ${MAX_VIDEO_DURATION_SECONDS} seconds.`,
        );
      }
    }
  } else {
    if (
      input.type &&
      !SUPPORTED_IMAGE_MIME_TYPES.includes(input.type.toLowerCase())
    ) {
      errors.push(
        `Unsupported image format "${input.type}". Please choose a JPEG or PNG image.`,
      );
    }

    if (input.fileSize && input.fileSize > MAX_IMAGE_FILE_SIZE_BYTES) {
      errors.push(
        'Image is too large (max 20MB). Please choose a smaller image.',
      );
    }

    if (input.width && input.height && (input.width < 32 || input.height < 32)) {
      errors.push('Image dimensions are too small to analyze.');
    }
  }

  return {valid: errors.length === 0, errors};
}

export function validateSelectedImage(
  input: ImageValidationInput,
): ValidationResult {
  if (!input.uri) {
    return {valid: false, errors: ['No image was selected.']};
  }
  return validateSelectedMedia({...input, mediaType: 'image'});
}

export function isValidApiBaseUrl(value: string): boolean {
  if (!value || value.trim().length === 0) {
    return false;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidConfidenceThreshold(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
