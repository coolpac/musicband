import type { SiteApiPayload, SiteContent, SiteData } from './types';
import { defaultContent } from './registry';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Merge saved content over defaults.
 * - objects merge key by key, so a field added to the defaults later appears on the site
 *   without anyone re-saving the section in the admin;
 * - arrays and primitives from the override replace the default wholesale (an admin who
 *   deleted a list item must not see it resurrected by a merge);
 * - a value whose type disagrees with the default is ignored: stale or hand-edited JSON
 *   in the database can never crash rendering;
 * - keys unknown to the defaults are dropped.
 */
export function mergeContent<T>(base: T, override: unknown): T {
  if (override === undefined) return base;
  if (Array.isArray(base)) return (Array.isArray(override) ? override : base) as T;
  if (isPlainObject(base)) {
    if (!isPlainObject(override)) return base;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base)) {
      out[key] = mergeContent((base as Record<string, unknown>)[key], override[key]);
    }
    return out as T;
  }
  // `null` default = nullable slot (RemoteImage | null): accept an object or null.
  if (base === null) return (isPlainObject(override) || override === null ? override : base) as T;
  return (typeof override === typeof base ? override : base) as T;
}

/** API payload (or null when the backend is unreachable) -> everything a page needs. */
export function resolveSiteData(payload: SiteApiPayload | null): SiteData {
  if (!payload) {
    return { content: defaultContent, events: [], formats: [], partners: [], source: 'fallback' };
  }
  return {
    content: mergeContent<SiteContent>(defaultContent, payload.content),
    events: Array.isArray(payload.events) ? payload.events : [],
    formats: Array.isArray(payload.formats) ? payload.formats : [],
    partners: Array.isArray(payload.partners) ? payload.partners : [],
    source: 'api',
  };
}
