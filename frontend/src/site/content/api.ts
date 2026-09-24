import type { SiteApiPayload } from './types';

/**
 * Deliberately NOT the app's services/apiClient: that one attaches admin/user tokens from
 * localStorage and sends credentials — a public page must do neither.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export class SiteApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Machine-readable code from the backend error body, when present. */
    readonly code?: string,
    /** The backend's whole error object — e.g. `{ fields: { phone: '…' }, errors: [{ path, message }] }` on 422. */
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'SiteApiError';
  }
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string; code?: string } | string;
  message?: string;
}

export async function siteFetch<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 10000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: 'omit',
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(rest.body ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || body?.success === false) {
      const err = body?.error;
      const message = (typeof err === 'string' ? err : err?.message) ?? body?.message ?? `HTTP ${res.status}`;
      throw new SiteApiError(message, res.status, typeof err === 'object' ? err?.code : undefined, typeof err === 'object' ? err : undefined);
    }
    // Backend wraps payloads as { success, data }; tolerate a bare payload too.
    return (body && 'data' in body ? body.data : body) as T;
  } catch (e) {
    if (e instanceof SiteApiError) throw e;
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    throw new SiteApiError(aborted ? 'Сервер не отвечает. Попробуйте ещё раз.' : 'Нет соединения с сервером.', 0);
  } finally {
    clearTimeout(timer);
  }
}

export function fetchSitePayload(): Promise<SiteApiPayload> {
  return siteFetch<SiteApiPayload>('/api/public/site');
}
