import React from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../config/theme';

interface LoadingIndicatorProps {
  message?: string;
}

export default function LoadingIndicator({
  message = 'Loading...',
}: LoadingIndicatorProps) {
  return (
    <View style={styles.container} testID="loading-indicator">
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
