import { clearAccessToken, clearStoredUser, getAccessToken } from './auth';

export type RetryOptions = {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  retryStatusCodes?: number[];
  retryOnNetworkError?: boolean;
};

const defaultRetryOptions: Required<RetryOptions> = {
  retries: 2,
  minDelayMs: 300,
  maxDelayMs: 2000,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  retryOnNetworkError: true,
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const computeDelay = (attempt: number, minDelayMs: number, maxDelayMs: number) => {
  const base = Math.min(maxDelayMs, minDelayMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 100);
  return base + jitter;
};

const shouldRetryResponse = (response: Response, codes: number[]) => codes.includes(response.status);

/**
 * Fetch with basic retry/backoff for transient failures.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RetryOptions,
): Promise<Response> {
  const config = { ...defaultRetryOptions, ...options };
  const headers = new Headers(init?.headers || {});
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const requestInit = init ? { ...init, headers } : { headers };

  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      const response = await fetch(input, requestInit);
      if (response.status === 401) {
        clearAccessToken();
        clearStoredUser();
      }
      if (response.ok || !shouldRetryResponse(response, config.retryStatusCodes)) {
        return response;
      }
      if (attempt === config.retries) {
        return response;
      }
    } catch (error) {
      if (!config.retryOnNetworkError || attempt === config.retries) {
        throw error;
      }
    }

    await sleep(computeDelay(attempt, config.minDelayMs, config.maxDelayMs));
  }

  throw new Error('Unexpected retry state');
}
