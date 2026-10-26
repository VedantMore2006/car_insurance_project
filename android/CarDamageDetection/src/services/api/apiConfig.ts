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

/** Allows SettingsScreen to update the base URL used by apiClient at runtime, after persisting it. */
export function setApiBaseUrl(url: string | null): void {
  overrideBaseUrl = url && url.trim().length > 0 ? url.trim() : null;
}

export function getApiBaseUrl(): string {
  return overrideBaseUrl ?? appConfig.defaultApiBaseUrl;
}

export function buildUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  return `${base}${path}`;
}
