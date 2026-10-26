const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export interface ImageValidationInput {
  uri?: string | null;
  type?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSelectedImage(
  input: ImageValidationInput,
): ValidationResult {
  const errors: string[] = [];

  if (!input.uri) {
    errors.push('No image was selected.');
  }

  if (input.type && !SUPPORTED_MIME_TYPES.includes(input.type.toLowerCase())) {
    errors.push(
      `Unsupported image format "${input.type}". Please choose a JPEG or PNG image.`,
    );
  }

  if (input.fileSize && input.fileSize > MAX_FILE_SIZE_BYTES) {
    errors.push(
      'Image is too large (max 20MB). Please choose a smaller image.',
    );
  }

  if (input.width && input.height && (input.width < 32 || input.height < 32)) {
    errors.push('Image dimensions are too small to analyze.');
  }

  return {valid: errors.length === 0, errors};
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
