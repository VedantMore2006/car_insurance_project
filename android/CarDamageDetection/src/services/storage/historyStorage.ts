import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../config/appConfig';
import {AppSettings, HistoryEntry} from '../../types/common.types';

/**
 * AsyncStorage-backed metadata only. Never stores full image binaries — only file URI references
 * (the image files themselves live in app-private storage managed by the OS/image picker).
 */

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(appConfig.storageKeys.history);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const existing = await getHistory();
  const updated = [entry, ...existing];
  await AsyncStorage.setItem(
    appConfig.storageKeys.history,
    JSON.stringify(updated),
  );
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const existing = await getHistory();
  const updated = existing.filter(e => e.id !== id);
  await AsyncStorage.setItem(
    appConfig.storageKeys.history,
    JSON.stringify(updated),
  );
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(appConfig.storageKeys.history);
}

const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: appConfig.defaultApiBaseUrl,
  confidenceThreshold: appConfig.defaultConfidenceThreshold,
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(appConfig.storageKeys.settings);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return {...DEFAULT_SETTINGS, ...parsed};
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(
    appConfig.storageKeys.settings,
    JSON.stringify(settings),
  );
}
