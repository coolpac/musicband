import type { SiteData, SiteEvent } from '../content/types';
import { phoneToHref } from '../content/sections/contacts';
import { NOINDEX_ROUTES, ROUTE_PATHS, type RouteId } from '../router/routes';

export const DEFAULT_OG_IMAGE = '/site/og-default.jpg';
export const LOGO_IMAGE = '/site/icon-512.png';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogType: 'website' | 'article';
  ogImage: string;
  siteName: string;
  jsonLd: Record<string, unknown>[];
}

function origin(data: SiteData): string {
  return data.content.seo.siteUrl.replace(/\/+$/, '');
}

export function absoluteUrl(data: SiteData, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin(data)}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Legal pages exist only once the admin has filled in their text. */
export function legalPageExists(route: RouteId, data: SiteData): boolean {
  if (route !== 'privacy' && route !== 'terms' && route !== 'offer') return true;
  return data.content.legal[route].body.trim().length > 0;
}

/** HTTP status the server must answer with — soft-404s poison the index. */
export function statusForRoute(route: RouteId, data: SiteData): 200 | 404 {
  return route === 'notFound' || !legalPageExists(route, data) ? 404 : 200;
}

function pageTitle(route: RouteId, data: SiteData): string {
  const { seo, booking, legal } = data.content;
  switch (route) {
    case 'home':
      return seo.title;
    case 'booking':
      return `Забронировать выступление — выбрать дату${seo.titleSuffix}`;
    case 'bookingForm':
      return `${booking.formTitle}${seo.titleSuffix}`;
    case 'bookingSuccess':
      return `${booking.successTitle}${seo.titleSuffix}`;
    case 'privacy':
    case 'terms':
    case 'offer':
      return `${legal[route].title}${seo.titleSuffix}`;
    default:
      return `Страница не найдена${seo.titleSuffix}`;
  }
}

function pageDescription(route: RouteId, data: SiteData): string {
  const { seo } = data.content;
  if (route === 'booking') {
    return `Выберите свободную дату и время выступления кавер-группы ${seo.siteName} онлайн. Оставьте заявку — мы свяжемся с вами и обсудим программу.`;
  }
  return seo.description;
}

function musicGroup(data: SiteData): Record<string, unknown> {
  const { seo, contacts, social } = data.content;
  const base = origin(data);
  const sameAs = social.links.map((l) => l.url.trim()).filter((u) => /^https?:\/\//i.test(u));
  const tel = phoneToHref(contacts.phone).replace('tel:', '');
  return {
    '@type': 'MusicGroup',
    '@id': `${base}/#band`,
    name: seo.siteName,
    url: `${base}/`,
    description: seo.description,
    image: absoluteUrl(data, seo.ogImage?.src ?? DEFAULT_OG_IMAGE),
    logo: absoluteUrl(data, LOGO_IMAGE),
    ...(seo.genres.length ? { genre: seo.genres } : {}),
    ...(seo.areaServed.length ? { areaServed: seo.areaServed } : {}),
    ...(tel ? { telephone: tel } : {}),
    ...(contacts.email ? { email: contacts.email } : {}),
    ...(contacts.city ? { address: { '@type': 'PostalAddress', addressLocality: contacts.city, addressCountry: 'RU' } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

function musicEvent(event: SiteEvent, data: SiteData): Record<string, unknown> | null {
  // Google rejects events without a date; past events are dropped so stale афиша never shows in results.
  if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (event.date < today) return null;
  const base = origin(data);
  const place = event.venue?.trim() || data.content.contacts.city || 'Место уточняется';
  return {
    '@type': 'MusicEvent',
    name: event.title,
    startDate: event.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: place,
      address: { '@type': 'PostalAddress', addressLocality: data.content.contacts.city || place, addressCountry: 'RU' },
    },
    performer: { '@id': `${base}/#band` },
    organizer: { '@id': `${base}/#band` },
    ...(event.description ? { description: event.description } : {}),
    ...(event.image ? { image: absoluteUrl(data, event.image.src) } : {}),
    url: event.link && /^https?:\/\//i.test(event.link) ? event.link : `${base}/#events`,
  };
}

function breadcrumbs(data: SiteData, trail: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(data, item.path),
    })),
  };
}

function videoObject(data: SiteData): Record<string, unknown> | null {
  const { video, seo } = data.content;
  // name + thumbnailUrl + uploadDate are all REQUIRED by Google; emit nothing rather than invalid markup.
  if (!video.videoUrl || !video.uploadDate || !/^\d{4}-\d{2}-\d{2}/.test(video.uploadDate)) return null;
  return {
    '@type': 'VideoObject',
    name: video.heading,
    description: video.text || seo.description,
    thumbnailUrl: absoluteUrl(data, video.poster?.src ?? DEFAULT_OG_IMAGE),
    uploadDate: video.uploadDate,
    ...(/\.(mp4|webm)(\?|$)/i.test(video.videoUrl) ? { contentUrl: absoluteUrl(data, video.videoUrl) } : { embedUrl: video.videoUrl }),
  };
}

export function buildPageMeta(route: RouteId, data: SiteData): PageMeta {
  const { seo, legal } = data.content;
  const base = origin(data);
  const exists = statusForRoute(route, data) === 200;
  const effectiveRoute: RouteId = exists ? route : 'notFound';
  const path = effectiveRoute === 'notFound' ? '/' : ROUTE_PATHS[effectiveRoute];

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': `${base}/#website`,
      url: `${base}/`,
      name: seo.siteName,
      inLanguage: 'ru-RU',
      publisher: { '@id': `${base}/#band` },
    },
    musicGroup(data),
  ];

  if (effectiveRoute === 'home') {
    graph.push(...data.events.map((e) => musicEvent(e, data)).filter((e): e is Record<string, unknown> => e !== null));
    const video = videoObject(data);
    if (video) graph.push(video);
  } else if (effectiveRoute === 'booking') {
    graph.push(breadcrumbs(data, [{ name: 'Главная', path: '/' }, { name: 'Забронировать выступление', path: '/booking' }]));
  } else if (effectiveRoute === 'privacy' || effectiveRoute === 'terms' || effectiveRoute === 'offer') {
    graph.push(breadcrumbs(data, [{ name: 'Главная', path: '/' }, { name: legal[effectiveRoute].title, path }]));
  }

  const noindex = seo.noindex || NOINDEX_ROUTES.has(effectiveRoute);

  return {
    title: pageTitle(effectiveRoute, data),
    description: pageDescription(effectiveRoute, data),
    canonical: `${base}${path === '/' ? '/' : path}`,
    robots: noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    ogType: 'website',
    ogImage: absoluteUrl(data, seo.ogImage?.src ?? DEFAULT_OG_IMAGE),
    siteName: seo.siteName,
    jsonLd: [{ '@context': 'https://schema.org', '@graph': graph }],
  };
}
