import {
  validateSelectedImage,
  isValidApiBaseUrl,
  isValidConfidenceThreshold,
} from '../../src/utils/validation';

describe('validateSelectedImage', () => {
  it('accepts a valid JPEG under the size limit', () => {
    const result = validateSelectedImage({
      uri: 'content://media/image.jpg',
      type: 'image/jpeg',
      fileSize: 2 * 1024 * 1024,
      width: 1200,
      height: 900,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an unsupported format', () => {
    const result = validateSelectedImage({
      uri: 'content://x',
      type: 'image/gif',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Unsupported image format/);
  });

  it('rejects an oversized file', () => {
    const result = validateSelectedImage({
      uri: 'content://x',
      type: 'image/png',
      fileSize: 50 * 1024 * 1024,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/too large/);
  });

  it('rejects when no uri provided', () => {
    const result = validateSelectedImage({});
    expect(result.valid).toBe(false);
  });
});

describe('isValidApiBaseUrl', () => {
  it('accepts http/https urls', () => {
    expect(isValidApiBaseUrl('https://example.com')).toBe(true);
    expect(isValidApiBaseUrl('http://192.168.1.5:8000')).toBe(true);
  });
  it('rejects invalid urls', () => {
    expect(isValidApiBaseUrl('not a url')).toBe(false);
    expect(isValidApiBaseUrl('')).toBe(false);
  });
});

describe('isValidConfidenceThreshold', () => {
  it('accepts values between 0 and 1', () => {
    expect(isValidConfidenceThreshold(0)).toBe(true);
    expect(isValidConfidenceThreshold(0.5)).toBe(true);
    expect(isValidConfidenceThreshold(1)).toBe(true);
  });
  it('rejects out-of-range or non-numeric values', () => {
    expect(isValidConfidenceThreshold(-0.1)).toBe(false);
    expect(isValidConfidenceThreshold(1.1)).toBe(false);
    expect(isValidConfidenceThreshold(NaN)).toBe(false);
  });
});
