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
import {formatDateTime, formatDetectionCount} from '../../../utils/formatters';

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
                  <Text style={styles.thumbnailFallbackText}>No Image</Text>
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
                <Text style={styles.date}>
                  {formatDateTime(item.createdAt)}
                </Text>
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
  date: {...typography.caption, color: colors.textMuted},
  count: {...typography.body, color: colors.textPrimary},
  status: {...typography.caption, color: colors.textSecondary},
  delete: {...typography.caption, color: colors.danger, fontWeight: '600'},
});
