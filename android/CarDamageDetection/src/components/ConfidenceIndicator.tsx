import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, radius, typography} from '../config/theme';
import {formatConfidence} from '../utils/formatters';

interface ConfidenceIndicatorProps {
  confidence: number;
}

function colorForConfidence(confidence: number): string {
  if (confidence >= 0.75) {
    return colors.success;
  }
  if (confidence >= 0.5) {
    return colors.warning;
  }
  return colors.danger;
}

export default function ConfidenceIndicator({
  confidence,
}: ConfidenceIndicatorProps) {
  const pct = Math.max(0, Math.min(1, confidence));
  const barColor = colorForConfidence(pct);
  return (
    <View style={styles.container} testID="confidence-indicator">
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {width: `${pct * 100}%`, backgroundColor: barColor},
          ]}
        />
      </View>
      <Text style={[styles.label, {color: barColor}]}>
        {formatConfidence(pct)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {height: 6, borderRadius: radius.pill},
  label: {
    ...typography.caption,
    fontWeight: '700',
    width: 44,
    textAlign: 'right',
  },
});
