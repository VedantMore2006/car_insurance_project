import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, radius, spacing, typography} from '../config/theme';

interface DamageBadgeProps {
  className: string;
}

export default function DamageBadge({className}: DamageBadgeProps) {
  return (
    <View style={styles.badge} testID="damage-badge">
      <Text style={styles.text}>{className}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: {...typography.caption, color: colors.accent, fontWeight: '600'},
});
