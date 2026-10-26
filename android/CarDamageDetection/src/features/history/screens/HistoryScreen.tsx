import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import EmptyState from '../../../components/EmptyState';
import {colors, radius, spacing, typography} from '../../../config/theme';
import {
  deleteHistoryEntry,
  getHistory,
} from '../../../services/storage/historyStorage';
import {HistoryEntry} from '../../../types/common.types';
import {
  formatDateTime,
  formatDetectionCount,
  formatDuration,
} from '../../../utils/formatters';

export default function HistoryScreen() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    getHistory().then(setEntries);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete inspection',
      'Are you sure you want to delete this inspection record?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteHistoryEntry(id);
            load();
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <AppHeader title="Inspection History" />
      {entries.length === 0 ? (
        <EmptyState
          title="No history yet"
          message="Inspections you save will appear here with a thumbnail and detection count."
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({item}) => (
            <View style={styles.row} testID="history-row">
              {imageErrors[item.id] ? (
                <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                  <Text style={styles.thumbnailFallbackText}>
                    {item.mediaType === 'video' ? 'Video' : 'Photo'}
                  </Text>
                </View>
              ) : (
                <Image
                  source={{uri: item.imageUri}}
                  style={styles.thumbnail}
                  onError={() =>
                    setImageErrors(prev => ({...prev, [item.id]: true}))
                  }
                />
              )}
              <View style={styles.rowInfo}>
                <View style={styles.dateRow}>
                  <Text style={styles.date}>
                    {formatDateTime(item.createdAt)}
                  </Text>
                  <View
                    style={[
                      styles.typeBadge,
                      item.mediaType === 'video' && styles.videoBadge,
                    ]}>
                    <Text
                      style={[
                        styles.typeBadgeText,
                        item.mediaType === 'video' && styles.videoBadgeText,
                      ]}>
                      {item.mediaType === 'video'
                        ? `VIDEO ${
                            item.duration ? formatDuration(item.duration) : ''
                          }`.trim()
                        : 'PHOTO'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.count}>
                  {formatDetectionCount(item.detectionCount)}
                </Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              <Pressable
                onPress={() => handleDelete(item.id)}
                testID="history-delete-button">
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {paddingHorizontal: spacing.lg, paddingBottom: spacing.lg},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  thumbnailFallback: {alignItems: 'center', justifyContent: 'center'},
  thumbnailFallbackText: {...typography.caption, color: colors.textMuted},
  rowInfo: {flex: 1},
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  date: {...typography.caption, color: colors.textMuted},
  typeBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  videoBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  videoBadgeText: {
    color: colors.accent,
  },
  count: {...typography.body, color: colors.textPrimary},
  status: {...typography.caption, color: colors.textSecondary},
  delete: {...typography.caption, color: colors.danger, fontWeight: '600'},
});
