/**
 * Static app configuration. Runtime-overridable values (like the backend URL) live in
 * AsyncStorage via settingsStorage-like keys in historyStorage.ts/SettingsScreen, not here.
 *
 * API_BASE_URL below is a documented placeholder, never a real machine IP (see .env.example and
 * README "Backend URL configuration" section). It is intentionally NOT localhost, because on a
 * physical Android device `localhost` resolves to the device itself, not the dev laptop.
 */
export const DEFAULT_API_BASE_URL = 'http://88.222.212.15:7000';

export const appConfig = {
  appName: 'Car Damage Detection',
  appVersion: '0.1.0-phase1',
  defaultApiBaseUrl: DEFAULT_API_BASE_URL,
  defaultConfidenceThreshold: 0.25,
  defaultIouThreshold: 0.45,
  requestTimeoutMs: 20000,
  storageKeys: {
    settings: '@cdd/settings',
    history: '@cdd/history',
  },
} as const;

export type AppConfig = typeof appConfig;
export default appConfig;
