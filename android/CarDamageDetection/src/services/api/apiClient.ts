import appConfig from '../../config/appConfig';
import {getApiKey} from './apiConfig';

export interface ApiClientErrorInfo {
  kind: 'network' | 'timeout' | 'server' | 'parse' | 'cancelled';
  message: string;
  statusCode?: number;
}

export class ApiClientError extends Error {
  info: ApiClientErrorInfo;
  constructor(info: ApiClientErrorInfo) {
    super(info.message);
    this.name = 'ApiClientError';
    this.info = info;
  }
}

interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Light fetch wrapper: timeout handling, JSON parsing, typed errors. No axios dependency. */
async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function getJson<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? appConfig.requestTimeoutMs;
  const headers: Record<string, string> = {};
  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  try {
    const response = await withTimeout(
      signal => fetch(url, {method: 'GET', headers, signal}),
      timeoutMs,
      options.signal,
    );
    return await parseJsonResponse<T>(response);
  } catch (err) {
    throw normalizeFetchError(err, options.signal);
  }
}

/**
 * Expo SDK's global `fetch` (installed at startup by expo/winter) only accepts a real Blob/File
 * for a FormData file part and throws "Unsupported FormDataPart implementation" for React
 * Native's classic `{uri, name, type}` file shape used below. XMLHttpRequest is untouched by that
 * polyfill and is what RN apps have always used for multipart file uploads, so we use it here
 * instead of fetch.
 */
export async function postMultipart<T>(
  url: string,
  formData: FormData,
  options: RequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? appConfig.requestTimeoutMs;
  const apiKey = getApiKey();

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
      }
      options.signal?.removeEventListener('abort', onExternalAbort);
    };

    function onExternalAbort() {
      xhr.abort();
    }

    xhr.open('POST', url, true);
    if (apiKey) {
      xhr.setRequestHeader('X-API-Key', apiKey);
    }

    xhr.onload = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      const status = xhr.status;
      const bodyText = xhr.responseText ?? '';
      if (status < 200 || status >= 300) {
        reject(
          new ApiClientError({
            kind: 'server',
            message: `Request failed with status ${status}${
              bodyText ? `: ${bodyText}` : ''
            }`,
            statusCode: status,
          }),
        );
        return;
      }
      if (!bodyText) {
        reject(
          new ApiClientError({
            kind: 'parse',
            message: 'Empty response body from server',
          }),
        );
        return;
      }
      try {
        resolve(JSON.parse(bodyText) as T);
      } catch {
        reject(
          new ApiClientError({
            kind: 'parse',
            message: 'Server response was not valid JSON',
          }),
        );
      }
    };

    xhr.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new ApiClientError({kind: 'network', message: 'Network request failed'}));
    };

    xhr.ontimeout = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new ApiClientError({kind: 'timeout', message: 'Request timed out'}));
    };

    xhr.onabort = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new ApiClientError({kind: 'cancelled', message: 'Request was cancelled'}));
    };

    xhr.timeout = timeoutMs;
    timer = setTimeout(() => xhr.abort(), timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
      } else {
        options.signal.addEventListener('abort', onExternalAbort);
      }
    }

    xhr.send(formData);
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch {
      /* ignore */
    }
    throw new ApiClientError({
      kind: 'server',
      message: `Request failed with status ${response.status}${
        bodyText ? `: ${bodyText}` : ''
      }`,
      statusCode: response.status,
    });
  }
  const text = await response.text();
  if (!text) {
    throw new ApiClientError({
      kind: 'parse',
      message: 'Empty response body from server',
    });
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiClientError({
      kind: 'parse',
      message: 'Server response was not valid JSON',
    });
  }
}

function normalizeFetchError(
  err: unknown,
  externalSignal?: AbortSignal,
): ApiClientError {
  if (err instanceof ApiClientError) {
    return err;
  }
  if (externalSignal?.aborted) {
    return new ApiClientError({
      kind: 'cancelled',
      message: 'Request was cancelled',
    });
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return new ApiClientError({kind: 'timeout', message: 'Request timed out'});
  }
  const message = err instanceof Error ? err.message : 'Unknown network error';
  return new ApiClientError({kind: 'network', message});
}
