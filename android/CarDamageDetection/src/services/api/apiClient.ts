import appConfig from '../../config/appConfig';

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
  try {
    const response = await withTimeout(
      signal => fetch(url, {method: 'GET', signal}),
      timeoutMs,
      options.signal,
    );
    return await parseJsonResponse<T>(response);
  } catch (err) {
    throw normalizeFetchError(err, options.signal);
  }
}

export async function postMultipart<T>(
  url: string,
  formData: FormData,
  options: RequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? appConfig.requestTimeoutMs;
  try {
    const response = await withTimeout(
      signal =>
        fetch(url, {
          method: 'POST',
          body: formData,
          signal,
        }),
      timeoutMs,
      options.signal,
    );
    return await parseJsonResponse<T>(response);
  } catch (err) {
    throw normalizeFetchError(err, options.signal);
  }
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
