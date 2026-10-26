import {
  formatConfidence,
  formatFileSize,
  formatDetectionCount,
  formatDuration,
} from '../../src/utils/formatters';

describe('formatConfidence', () => {
  it('formats a 0..1 confidence as a rounded percentage', () => {
    expect(formatConfidence(0.914)).toBe('91%');
    expect(formatConfidence(0)).toBe('0%');
    expect(formatConfidence(1)).toBe('100%');
  });
});

describe('formatFileSize', () => {
  it('formats bytes into human readable units', () => {
    expect(formatFileSize(500)).toBe('500.0 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });
  it('handles missing size', () => {
    expect(formatFileSize(undefined)).toBe('Unknown size');
  });
});

describe('formatDetectionCount', () => {
  it('pluralizes correctly', () => {
    expect(formatDetectionCount(0)).toBe('No damage detected');
    expect(formatDetectionCount(1)).toBe('1 damage area detected');
    expect(formatDetectionCount(3)).toBe('3 damage areas detected');
  });
});

describe('formatDuration', () => {
  it('formats seconds and milliseconds into mm:ss format', () => {
    expect(formatDuration(15)).toBe('0:15');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(15000)).toBe('0:15');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(undefined)).toBe('0:00');
  });
});
