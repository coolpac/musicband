import type { PageMeta } from './meta';
import type { SiteData } from '../content/types';
import type { RouteId } from '../router/routes';
import { siteImages } from '../assets/opt/manifest';
import { toSrcSet } from '../components/ui/Picture';
// `?url` gives the same hashed URL that the preload link and @font-face must share.
import unboundedCyrillic from '@fontsource-variable/unbounded/files/unbounded-cyrillic-wght-normal.woff2?url';
import unboundedLatin from '@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2?url';
import geologicaCyrillic from '@fontsource-variable/geologica/files/geologica-cyrillic-wght-normal.woff2?url';
import geologicaLatin from '@fontsource-variable/geologica/files/geologica-latin-wght-normal.woff2?url';

const CYRILLIC = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** JSON inside <script>: neutralise «</script>» and HTML comments without changing the parsed value. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function fontFace(family: string, url: string, range: string, weights = '200 900'): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weights};font-display:swap;src:url(${url}) format('woff2-variations');unicode-range:${range}}`;
}

/**
 * Inlined so text can paint with the right faces on the first frame — no render-blocking
 * font stylesheet, no third-party request. Latin subsets download only if Latin glyphs appear.
 * Fallback faces are metric-matched (size-adjust) so the swap does not shift layout.
 */
function fontsBlock(): string {
  const css = [
    fontFace('Unbounded', unboundedCyrillic, CYRILLIC),
    fontFace('Unbounded', unboundedLatin, LATIN),
    fontFace('Geologica', geologicaCyrillic, CYRILLIC, '100 900'),
    fontFace('Geologica', geologicaLatin, LATIN, '100 900'),
    // Measured in Chrome on the site's own Russian copy (canvas measureText, 100px):
    //   Unbounded 800 / Arial Bold = 1.31 wide, ascent .99 descent .24 em
    //   Geologica 400 / Arial      = 1.07 wide, ascent .98 descent .27 em
    // ascent/descent-override are divided by size-adjust because size-adjust scales them too.
    `@font-face{font-family:'Unbounded Fallback';src:local('Arial Bold'),local('Arial-BoldMT'),local('Arial');font-weight:200 900;size-adjust:130%;ascent-override:76%;descent-override:18.5%;line-gap-override:0%}`,
    `@font-face{font-family:'Geologica Fallback';src:local('Arial');font-weight:100 900;size-adjust:107%;ascent-override:91.5%;descent-override:25%;line-gap-override:0%}`,
  ].join('');
  return [
    `<link rel="preload" as="font" type="font/woff2" crossorigin href="${unboundedCyrillic}">`,
    `<link rel="preload" as="font" type="font/woff2" crossorigin href="${geologicaCyrillic}">`,
    `<style>${css}</style>`,
  ].join('');
}

/** The hero poster is the LCP element of the home page: fetch it in parallel with CSS/JS. */
function heroPreload(data: SiteData): string {
  const remote = data.content.hero.image;
  if (remote) {
    const srcset = remote.avifSrcSet ?? remote.webpSrcSet;
    const type = remote.avifSrcSet ? ' type="image/avif"' : remote.webpSrcSet ? ' type="image/webp"' : '';
    return srcset
      ? `<link rel="preload" as="image" fetchpriority="high"${type} imagesrcset="${esc(srcset)}" imagesizes="100vw">`
      : `<link rel="preload" as="image" fetchpriority="high" href="${esc(remote.src)}">`;
  }
  const bundled = siteImages['hero/hero-poster-bg'];
  return `<link rel="preload" as="image" fetchpriority="high" type="image/avif" imagesrcset="${esc(toSrcSet(bundled.avif))}" imagesizes="100vw">`;
}

/** Server: everything that goes into <head> for one request. */
export function renderHead(meta: PageMeta, data: SiteData, route: RouteId): string {
  const { seo } = data.content;
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    seo.keywords ? `<meta name="keywords" content="${esc(seo.keywords)}">` : '',
    `<meta name="robots" content="${meta.robots}">`,
    `<link rel="canonical" href="${esc(meta.canonical)}">`,
    `<meta property="og:type" content="${meta.ogType}">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta property="og:site_name" content="${esc(meta.siteName)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(meta.canonical)}">`,
    `<meta property="og:image" content="${esc(meta.ogImage)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(meta.title)}">`,
    `<meta name="twitter:description" content="${esc(meta.description)}">`,
    `<meta name="twitter:image" content="${esc(meta.ogImage)}">`,
    seo.yandexVerification ? `<meta name="yandex-verification" content="${esc(seo.yandexVerification)}">` : '',
    seo.googleVerification ? `<meta name="google-site-verification" content="${esc(seo.googleVerification)}">` : '',
    fontsBlock(),
    route === 'home' ? heroPreload(data) : '',
    ...meta.jsonLd.map((block) => `<script type="application/ld+json">${safeJson(block)}</script>`),
  ];
  return tags.filter(Boolean).join('\n    ');
}

function upsertMeta(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  apply(el);
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  upsertMeta(
    `meta[${attr}="${key}"]`,
    () => {
      const el = document.createElement('meta');
      el.setAttribute(attr, key);
      return el;
    },
    (el) => el.setAttribute('content', content)
  );
}

/** Client: keep <head> truthful after in-app navigation (crawlers that run JS, share sheets, history titles). */
export function applyHead(meta: PageMeta) {
  document.title = meta.title;
  setMeta('name', 'description', meta.description);
  setMeta('name', 'robots', meta.robots);
  setMeta('property', 'og:title', meta.title);
  setMeta('property', 'og:description', meta.description);
  setMeta('property', 'og:url', meta.canonical);
  setMeta('name', 'twitter:title', meta.title);
  setMeta('name', 'twitter:description', meta.description);
  upsertMeta(
    'link[rel="canonical"]',
    () => {
      const el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      return el;
    },
    (el) => el.setAttribute('href', meta.canonical)
  );
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());
  for (const block of meta.jsonLd) {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = safeJson(block);
    document.head.appendChild(el);
  }
}
