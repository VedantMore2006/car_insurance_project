import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addHistoryEntry,
  getHistory,
  deleteHistoryEntry,
  clearHistory,
  getSettings,
  saveSettings,
} from '../../src/services/storage/historyStorage';

describe('historyStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips a history entry through add/get', async () => {
    await addHistoryEntry({
      id: '1',
      createdAt: new Date().toISOString(),
      imageUri: 'file:///tmp/a.jpg',
      detectionCount: 2,
      status: 'success',
      classNames: ['bonnet-dent', 'fender-dent'],
    });
    const history = await getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('1');
  });

  it('prepends new entries (most recent first)', async () => {
    await addHistoryEntry({
      id: '1',
      createdAt: '2026-01-01T00:00:00.000Z',
      imageUri: 'a',
      detectionCount: 0,
      status: 'no_detections',
      classNames: [],
    });
    await addHistoryEntry({
      id: '2',
      createdAt: '2026-01-02T00:00:00.000Z',
      imageUri: 'b',
      detectionCount: 1,
      status: 'success',
      classNames: ['roof-dent'],
    });
    const history = await getHistory();
    expect(history[0].id).toBe('2');
  });

  it('deletes an entry by id', async () => {
    await addHistoryEntry({
      id: '1',
      createdAt: new Date().toISOString(),
      imageUri: 'a',
      detectionCount: 0,
      status: 'no_detections',
      classNames: [],
    });
    await deleteHistoryEntry('1');
    expect(await getHistory()).toHaveLength(0);
  });

  it('clears all history', async () => {
    await addHistoryEntry({
      id: '1',
      createdAt: new Date().toISOString(),
      imageUri: 'a',
      detectionCount: 0,
      status: 'no_detections',
      classNames: [],
    });
    await clearHistory();
    expect(await getHistory()).toHaveLength(0);
  });

  it('returns an empty array if nothing stored', async () => {
    expect(await getHistory()).toEqual([]);
  });

  it('round-trips settings and falls back to defaults when unset', async () => {
    const defaults = await getSettings();
    expect(defaults.confidenceThreshold).toBeGreaterThanOrEqual(0);

    await saveSettings({
      apiBaseUrl: 'https://example.com',
      confidenceThreshold: 0.6,
    });
    const loaded = await getSettings();
    expect(loaded.apiBaseUrl).toBe('https://example.com');
    expect(loaded.confidenceThreshold).toBe(0.6);
  });
});
