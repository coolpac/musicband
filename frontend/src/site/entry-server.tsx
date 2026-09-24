import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { SiteApp } from './SiteApp';
import type { SiteApiPayload } from './content/types';
import { resolveSiteData } from './content/resolve';
import { matchRoute, SITE_PATHS } from './router/routes';
import { buildPageMeta, statusForRoute } from './seo/meta';
import { renderHead, safeJson } from './seo/head';

export { SITE_PATHS };

export interface RenderResult {
  status: 200 | 404;
  /** Goes in place of <!--site-head--> */
  head: string;
  /** Goes in place of <!--site-html--> */
  html: string;
  /** Goes in place of <!--site-data--> (already safe for inline <script>) */
  data: string;
}

/**
 * Pure: (url, API payload | null) -> HTML parts. Used by
 *  - server/site-server.mjs   per request in production,
 *  - scripts/prerender-site.mjs at build time (payload = null -> static fallback snapshots),
 *  - plugins/site-ssr-dev.ts  in `vite dev`.
 */
export function render(url: string, payload: SiteApiPayload | null): RenderResult {
  const data = resolveSiteData(payload);
  const pathname = new URL(url, 'http://site.local').pathname;
  const route = matchRoute(pathname);
  const meta = buildPageMeta(route, data);

  const html = renderToString(
    <StrictMode>
      <SiteApp url={url} data={data} />
    </StrictMode>
  );

  return {
    status: statusForRoute(route, data),
    head: renderHead(meta, data, route),
    html,
    data: safeJson(data),
  };
}

/** robots.txt — generated so the sitemap URL and `noindex` switch always follow the admin's SEO settings. */
export function renderRobots(payload: SiteApiPayload | null): string {
  const { seo } = resolveSiteData(payload).content;
  const base = seo.siteUrl.replace(/\/+$/, '');
  if (seo.noindex) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /app',
    'Disallow: /api/',
    'Disallow: /booking/form',
    'Disallow: /booking/success',
    // Yandex: these params never change page content — do not index URL variants.
    'Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid&from /',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}

export function renderSitemap(payload: SiteApiPayload | null): string {
  const data = resolveSiteData(payload);
  const base = data.content.seo.siteUrl.replace(/\/+$/, '');
  const lastmod = (payload?.updatedAt ?? new Date().toISOString()).slice(0, 10);
  const pages: { path: string; priority: string; changefreq: string }[] = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/booking', priority: '0.8', changefreq: 'monthly' },
  ];
  for (const doc of ['privacy', 'terms', 'offer'] as const) {
    if (data.content.legal[doc].body.trim()) pages.push({ path: `/${doc}`, priority: '0.2', changefreq: 'yearly' });
  }
  const urls = pages
    .map(
      (p) =>
        `  <url>\n    <loc>${base}${p.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
