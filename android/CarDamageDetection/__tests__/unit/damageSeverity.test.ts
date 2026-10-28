import {getSeverityColor, getSeverityLevel} from '../../src/utils/damageSeverity';
import {colors} from '../../src/config/theme';

describe('getSeverityLevel', () => {
  it('classifies confidence > 0.75 as major', () => {
    expect(getSeverityLevel(0.76)).toBe('major');
    expect(getSeverityLevel(0.95)).toBe('major');
  });

  it('classifies confidence in [0.5, 0.75] as moderate', () => {
    expect(getSeverityLevel(0.5)).toBe('moderate');
    expect(getSeverityLevel(0.75)).toBe('moderate');
    expect(getSeverityLevel(0.62)).toBe('moderate');
  });

  it('classifies confidence < 0.5 as minor', () => {
    expect(getSeverityLevel(0.49)).toBe('minor');
    expect(getSeverityLevel(0)).toBe('minor');
  });
});

describe('getSeverityColor', () => {
  it('maps each severity level to the expected theme color', () => {
    expect(getSeverityColor(0.9)).toBe(colors.severityMajor);
    expect(getSeverityColor(0.6)).toBe(colors.severityModerate);
    expect(getSeverityColor(0.2)).toBe(colors.severityMinor);
  });
});
