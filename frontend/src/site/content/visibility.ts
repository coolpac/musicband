import type { SiteData } from './types';

/**
 * Anchors of landing sections that render nothing while their data is empty.
 * Navigation must follow the same rules, or the default menu ships dead anchors like «/#events».
 * Keep each rule identical to the early `return null` of the section it describes.
 *
 * Only the data-driven blocks can be hidden: «Афиша» (events) and «Партнёры» come from the
 * database. Video, Rider and Social always render — each one falls back to its own default
 * copy and real links — so «Райдер» and «Соц. сети» are permanent menu items and never end up here.
 */
export function hiddenSectionAnchors(data: SiteData): ReadonlySet<string> {
  const demo = import.meta.env.DEV && data.source === 'fallback'; // demo collections are shown in dev only
  const hidden = new Set<string>();
  if (data.events.length === 0 && !demo) hidden.add('events');
  if (data.partners.length === 0 && !demo) hidden.add('partners');
  return hidden;
}

/** Drops nav items that point at an in-page anchor of a section which is not rendered. */
export function visibleNav<T extends { href: string }>(nav: T[], data: SiteData): T[] {
  const hidden = hiddenSectionAnchors(data);
  if (hidden.size === 0) return nav;
  return nav.filter((item) => {
    const hashAt = item.href.indexOf('#');
    return hashAt === -1 || !hidden.has(item.href.slice(hashAt + 1));
  });
}
