/**
 * App-wide design tokens. Single theme object, consumed via StyleSheet in components/screens.
 * No competing styling library (no styled-components, no NativeWind, etc.)
 */
export const colors = {
  background: '#0B1220',
  surface: '#121A2B',
  surfaceAlt: '#1B2538',
  border: '#27314A',
  textPrimary: '#F3F6FB',
  textSecondary: '#A6B0C3',
  textMuted: '#707C94',
  accent: '#3D8BFF',
  accentMuted: '#1F3A66',
  success: '#2ECC71',
  warning: '#F5A623',
  danger: '#E55353',
  overlayBox: '#3D8BFF',
  severityMajor: '#E53935', // confidence > 0.75 (e.g. major dents)
  severityModerate: '#F5A623', // confidence 0.5 - 0.75 (moderate damage)
  severityMinor: '#F4D03F', // confidence < 0.5 (e.g. light scratches)
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const elevation = {
  low: 2,
  medium: 6,
  high: 12,
} as const;

export const typography = {
  h1: {fontSize: 28, fontWeight: '700' as const},
  h2: {fontSize: 22, fontWeight: '700' as const},
  h3: {fontSize: 18, fontWeight: '600' as const},
  body: {fontSize: 15, fontWeight: '400' as const},
  caption: {fontSize: 12, fontWeight: '400' as const},
};

export const theme = {colors, spacing, radius, elevation, typography};
export type Theme = typeof theme;
export default theme;
