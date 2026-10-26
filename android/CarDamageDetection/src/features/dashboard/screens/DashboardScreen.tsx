import React, {useCallback, useState} from 'react';
import {View, Text, FlatList, StyleSheet} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import EmptyState from '../../../components/EmptyState';
import {colors, radius, spacing, typography} from '../../../config/theme';
import {getHistory} from '../../../services/storage/historyStorage';
import {HistoryEntry} from '../../../types/common.types';
import {formatDateTime, formatDetectionCount} from '../../../utils/formatters';
import {RootStackParamList} from '../../../app/navigation/navigationTypes';
import appConfig from '../../../config/appConfig';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getHistory().then(entries => {
        if (active) {
          setRecent(entries.slice(0, 3));
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScreenContainer scroll>
      <AppHeader
        title={appConfig.appName}
        subtitle="On-the-spot vehicle damage inspection"
      />
      <View style={styles.section}>
        <Text style={styles.intro}>
          Capture a vehicle photo and run it through the damage detection model
          to identify affected areas before logging an inspection.
        </Text>
        <AppButton
          title="Inspect Vehicle"
          onPress={() =>
            navigation.navigate('Inspection', {screen: 'ImageSelection'})
          }
          testID="inspect-vehicle-button"
          style={styles.primaryButton}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Inspections</Text>
        {recent.length === 0 ? (
          <EmptyState
            title="No inspections yet"
            message="Your completed inspections will show up here once you run one."
          />
        ) : (
          <FlatList
            data={recent}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            renderItem={({item}) => (
              <View style={styles.recentRow}>
                <Text style={styles.recentDate}>
                  {formatDateTime(item.createdAt)}
                </Text>
                <Text style={styles.recentCount}>
                  {formatDetectionCount(item.detectionCount)}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {paddingHorizontal: spacing.lg, marginTop: spacing.lg},
  intro: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  primaryButton: {},
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  recentRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recentDate: {...typography.caption, color: colors.textMuted},
  recentCount: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
});
