import {DetectionResult, DetectionServiceError} from './types/detection.types';

/**
 * In-memory handoff between DetectionProgressScreen (which runs the request) and
 * DetectionResultsScreen (which renders it). Not persisted — intentionally scoped to a single
 * inspection run within the current app session. History persistence (saving a completed result)
 * is handled separately by historyStorage.ts when the user taps "Save to History".
 */
interface SessionState {
  result: DetectionResult | null;
  error: DetectionServiceError | null;
}

let session: SessionState = {result: null, error: null};

export function setSessionResult(result: DetectionResult): void {
  session = {result, error: null};
}

export function setSessionError(error: DetectionServiceError): void {
  session = {result: null, error};
}

export function getSession(): SessionState {
  return session;
}

export function clearSession(): void {
  session = {result: null, error: null};
}
