/**
 * Base API Client with mock/real backend switching
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Опции запроса: таймаут и внешний signal (например для отмены при unmount) */
export interface ApiRequestOptions {
  timeout?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 15000;
const GET_RETRY_MAX = 2;
const GET_RETRY_BACKOFF_MS = [1000, 2000];

/** Получить токен админа из localStorage */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  // admin_token — для админки, auth_token — для Mini App пользователя
  return localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
}

/** Получить заголовки с авторизацией */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Check if we're in mock mode based on environment variable
 */
export function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true';
}

/**
 * Get the base API URL
 */
function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL;
  return baseUrl || '';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Выполняет fetch с таймаутом и опциональной привязкой к внешнему AbortSignal.
 * В finally всегда очищает таймер.
 */
async function fetchWithAbort(
  url: string,
  init: RequestInit,
  options?: ApiRequestOptions
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      (errorData && typeof errorData === 'object' && 'message' in errorData && (errorData as any).message)
        ? (errorData as any).message
        : (errorData && typeof errorData === 'object' && 'error' in errorData && (errorData as any).error?.message)
          ? (errorData as any).error.message
          : `HTTP error ${response.status}`;
    throw new ApiError(
      message,
      response.status,
      errorData
    );
  }

  const data = await response.json();

  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return data.data as T;
  }

  return data as T;
}

/**
 * Generic GET request with timeout, optional external signal and retry for network errors.
 */
export async function apiGet<T>(
  path: string,
  options?: ApiRequestOptions
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= GET_RETRY_MAX; attempt++) {
    try {
      const response = await fetchWithAbort(
        url,
        {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
        },
        options
      );
      return await parseResponse<T>(response);
    } catch (error) {
      lastError = error;

      if (isAbortError(error)) {
        throw error;
      }

      if (error instanceof ApiError && error.statusCode != null) {
        throw error;
      }

      if (attempt < GET_RETRY_MAX) {
        await delay(GET_RETRY_BACKOFF_MS[attempt]);
      } else {
        break;
      }
    }
  }

  if (lastError instanceof ApiError) {
    throw lastError;
  }
  throw new ApiError(
    lastError instanceof Error ? lastError.message : 'Network error',
    undefined,
    lastError
  );
}

/**
 * Generic POST request with timeout and optional external signal.
 */
export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;

  try {
    const response = await fetchWithAbort(
      url,
      {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      },
      options
    );
    return await parseResponse<T>(response);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      undefined,
      error
    );
  }
}

/**
 * Generic PUT request with timeout and optional external signal.
 */
export async function apiPut<T>(
  path: string,
  body?: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;

  try {
    const response = await fetchWithAbort(
      url,
      {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      },
      options
    );
    return await parseResponse<T>(response);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      undefined,
      error
    );
  }
}

/**
 * Generic DELETE request with timeout and optional external signal.
 */
export async function apiDelete<T>(
  path: string,
  options?: ApiRequestOptions
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;

  try {
    const response = await fetchWithAbort(
      url,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      },
      options
    );
    return await parseResponse<T>(response);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      undefined,
      error
    );
  }
}

/**
 * Low-level request for FormData or custom body (e.g. file upload).
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit,
  options?: ApiRequestOptions
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const response = await fetchWithAbort(
    url,
    {
      credentials: 'include',
      ...init,
    },
    options
  );
  return await parseResponse<T>(response);
}
