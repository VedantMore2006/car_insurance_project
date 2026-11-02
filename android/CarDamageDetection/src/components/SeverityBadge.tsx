import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {radius, spacing} from '../config/theme';
import {SeverityLevel, getSeverityColor} from '../utils/damageSeverity';

const LABEL: Record<SeverityLevel, string> = {
  major: 'MAJOR',
  moderate: 'MODERATE',
  minor: 'MINOR',
};

interface SeverityBadgeProps {
  level: SeverityLevel;
  count?: number;
}

/**
 * Solid-filled severity chip (white text on the full severity color), distinct from the
 * translucent-tint `Badge` used for neutral status pills elsewhere -- damage severity is the one
 * piece of data on the results screen that should read as unmistakably loud, not muted.
 */
export default function SeverityBadge({level, count}: SeverityBadgeProps) {
  return (
    <View style={[styles.badge, {backgroundColor: getSeverityColor(severityConfidence[level])}]}>
      <Text style={styles.text}>
        {count !== undefined ? `${count} ` : ''}
        {LABEL[level]}
      </Text>
    </View>
  );
}

// getSeverityColor takes a confidence value; these are representative midpoints per band.
const severityConfidence: Record<SeverityLevel, number> = {
  major: 0.9,
  moderate: 0.6,
  minor: 0.2,
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#0B1220',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
