import {colors} from '../config/theme';

export type SeverityLevel = 'major' | 'moderate' | 'minor';

/**
 * Confidence-based severity color coding for the damage overlay:
 *   > 0.75        -> red    (major)
 *   0.5 - 0.75    -> orange (moderate)
 *   < 0.5         -> yellow (minor, e.g. light scratches)
 */
export function getSeverityLevel(confidence: number): SeverityLevel {
  if (confidence > 0.75) {
    return 'major';
  }
  if (confidence >= 0.5) {
    return 'moderate';
  }
  return 'minor';
}

export function getSeverityColor(confidence: number): string {
  switch (getSeverityLevel(confidence)) {
    case 'major':
      return colors.severityMajor;
    case 'moderate':
      return colors.severityModerate;
    case 'minor':
    default:
      return colors.severityMinor;
  }
}
