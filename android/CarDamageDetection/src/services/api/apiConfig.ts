import appConfig from '../../config/appConfig';

/**
 * Proposed, currently-unimplemented backend endpoints. No backend exists in this repo (see
 * IMPLEMENTATION_PLAN.md step 1). These paths are a reasonable illustrative contract; confirm and
 * update if/when a real backend is introduced.
 */
export const API_ENDPOINTS = {
  detect: '/api/v1/detect',
  health: '/health',
} as const;

let overrideBaseUrl: string | null = null;
let overrideApiKey: string | null = null;

/** Allows SettingsScreen to update the base URL used by apiClient at runtime, after persisting it. */
export function setApiBaseUrl(url: string | null): void {
  overrideBaseUrl = url && url.trim().length > 0 ? url.trim() : null;
}

export function getApiBaseUrl(): string {
  return overrideBaseUrl ?? appConfig.defaultApiBaseUrl;
}

/**
 * No API key ships in source. A leaked key previously lived here and was rotated + scrubbed from
 * git history after exposure (GitGuardian alert). Configure a key via the Settings screen — it's
 * persisted in AsyncStorage on-device only, never committed to the repo.
 */
export const DEFAULT_API_KEY: string | null = null;

/** Allows SettingsScreen to update the API key used by apiClient at runtime. */
export function setApiKey(key: string | null): void {
  overrideApiKey = key && key.trim().length > 0 ? key.trim() : null;
}

export function getApiKey(): string | null {
  return overrideApiKey ?? DEFAULT_API_KEY;
}

export function buildUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  return `${base}${path}`;
}
