import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../config/theme';

interface EmptyStateProps {
  title: string;
  message?: string;
}

export default function EmptyState({title, message}: EmptyStateProps) {
  return (
    <View style={styles.container} testID="empty-state">
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {...typography.h3, color: colors.textPrimary, textAlign: 'center'},
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
