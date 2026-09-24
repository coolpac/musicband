import type { SiteData } from './types';

/**
 * Several landing sections render nothing until the admin fills them (no fake content in production).
 * Navigation must follow the same rules, or the default menu ships dead anchors like «/#rider».
 * Keep each rule identical to the early `return null` of the section it describes.
 */
export function hiddenSectionAnchors(data: SiteData): ReadonlySet<string> {
  const { rider, social, video } = data.content;
  const demo = import.meta.env.DEV && data.source === 'fallback'; // demo collections are shown in dev only
  const hidden = new Set<string>();
  if (!rider.text.trim() && !rider.fileUrl.trim()) hidden.add('rider');
  if (!social.links.some((link) => typeof link?.url === 'string' && link.url.trim())) hidden.add('social');
  if (!video.videoUrl.trim()) hidden.add('video');
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
