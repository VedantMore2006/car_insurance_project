import React from 'react';
import {View, StyleSheet} from 'react-native';
import {colors, radius, spacing} from '../../../config/theme';
import DamageBadge from '../../../components/DamageBadge';
import ConfidenceIndicator from '../../../components/ConfidenceIndicator';
import {Detection} from '../types/detection.types';

interface DetectionResultCardProps {
  detection: Detection;
}

export default function DetectionResultCard({
  detection,
}: DetectionResultCardProps) {
  return (
    <View style={styles.card} testID="detection-result-card">
      <View style={styles.row}>
        <DamageBadge className={detection.className} />
      </View>
      <ConfidenceIndicator confidence={detection.confidence} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
