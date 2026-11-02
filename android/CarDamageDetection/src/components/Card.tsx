import React from 'react';
import {View, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import {colors, radius, spacing} from '../config/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The one card container every screen should use for a bordered content block (replaces the
 * per-screen "summaryCard"/"row"/"scanningCard"/etc. styles that each picked their own radius and
 * padding independently). Uses `radius.md` per the rule in theme.ts -- don't override radius here
 * per usage.
 */
export default function Card({children, style, testID}: CardProps) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
