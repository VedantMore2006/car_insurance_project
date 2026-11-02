import React from 'react';
import {View, Text, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import {colors, radius, spacing, typography, withAlpha} from '../config/theme';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TONE_COLOR: Record<BadgeTone, string> = {
  neutral: colors.textSecondary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

/**
 * The one small status pill/chip component every screen should use (replaces the per-screen
 * "typeBadge"/"sectionBadge"/"readOnlyBadge"/"verifiedBadge" styles, each of which had picked a
 * different radius and a hand-written `rgba(color, 0.15)` tint independently). Always `radius.pill`
 * per the rule in theme.ts.
 */
export default function Badge({label, tone = 'neutral', style, testID}: BadgeProps) {
  const color = TONE_COLOR[tone];
  return (
    <View
      style={[
        styles.badge,
        {backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.4)},
        style,
      ]}
      testID={testID}>
      <Text style={[styles.text, {color}]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  text: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
