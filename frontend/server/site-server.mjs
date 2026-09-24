#!/usr/bin/env node
/**
 * Production SSR for the public site. Zero dependencies: node:http + the self-contained
 * bundle in dist-ssr/ (React included) + dist/site.html as the template.
 *
 * nginx proxies only the site's own routes here (/, /booking…, /robots.txt, /sitemap.xml) and
 * falls back to the prerendered static snapshot (dist/site-static/*.html) if this process is down —
 * so the landing page survives an outage of both this service and the backend.
 *
 * Env:
 *   PORT              (4000)
 *   SITE_API_ORIGIN   (http://backend:3000)  where GET /api/public/site lives
 *   SITE_DIST_DIR     (../dist)              client build (site.html template)
 *   SITE_SSR_DIR      (../dist-ssr)          server bundle
 *   SITE_CACHE_TTL_MS (30000)                max age of API data before a background refresh
 *   SITE_PURGE_TOKEN  ('')                   if set, POST /__purge requires «Authorization: Bearer <token>»
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);
const API_ORIGIN = (process.env.SITE_API_ORIGIN ?? 'http://backend:3000').replace(/\/+$/, '');
const DIST_DIR = path.resolve(__dirname, process.env.SITE_DIST_DIR ?? '../dist');
const SSR_DIR = path.resolve(__dirname, process.env.SITE_SSR_DIR ?? '../dist-ssr');
const CACHE_TTL_MS = Number(process.env.SITE_CACHE_TTL_MS ?? 30_000);
const PURGE_TOKEN = process.env.SITE_PURGE_TOKEN ?? '';
const API_TIMEOUT_MS = 2500;

const MARKERS = { head: '<!--site-head-->', html: '<!--site-html-->', data: '/*site-data*/ undefined' };

const template = await fs.readFile(path.join(DIST_DIR, 'site.html'), 'utf8');
for (const marker of Object.values(MARKERS)) {
  if (!template.includes(marker)) throw new Error(`site.html is missing the «${marker}» marker — was the template edited?`);
}
const { render, renderRobots, renderSitemap, SITE_PATHS } = await import(pathToFileURL(path.join(SSR_DIR, 'entry-server.js')).href);
const sitePaths = new Set(SITE_PATHS);

/* ── API data: stale-while-revalidate, single in-flight request ───────────── */
let payload = null; //           last good API payload (null until the first success → bundled defaults)
let fetchedAt = 0;
let inflight = null;
let version = 0; //              bumps on every new payload; part of the HTML cache key

async function refresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${API_ORIGIN}/api/public/site`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const next = body && typeof body === 'object' && 'data' in body ? body.data : body;
      if (JSON.stringify(next) !== JSON.stringify(payload)) {
        payload = next;
        version++;
        htmlCache.clear();
      }
      fetchedAt = Date.now();
    } catch (err) {
      // Keep serving the last good payload; retry no sooner than 5s from now.
      fetchedAt = Date.now() - CACHE_TTL_MS + 5000;
      console.warn(`[site] API refresh failed: ${err.message}`);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function getPayload() {
  if (fetchedAt === 0) await refresh(); //                  cold start: wait once
  else if (Date.now() - fetchedAt > CACHE_TTL_MS) void refresh(); // stale: serve now, refresh behind
  return payload;
}

/* ── Rendered HTML cache: a handful of routes × one data version ──────────── */
const htmlCache = new Map();

function renderPage(pathname) {
  const key = `${version}:${pathname}`;
  let entry = htmlCache.get(key);
  if (!entry) {
    const result = render(pathname, payload);
    const body = template
      .replace(MARKERS.head, () => result.head)
      .replace(MARKERS.html, () => result.html)
      .replace(MARKERS.data, () => result.data);
    entry = { status: result.status, body, etag: `"${crypto.createHash('sha1').update(body).digest('base64url')}"` };
    htmlCache.set(key, entry);
  }
  return entry;
}

function send(res, status, headers, body) {
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://site.local');
    const rawPath = url.pathname;

    if (rawPath === '/__health') return send(res, 200, { 'Content-Type': 'text/plain' }, `ok v${version}`);

    if (rawPath === '/__purge' && req.method === 'POST') {
      if (PURGE_TOKEN && req.headers.authorization !== `Bearer ${PURGE_TOKEN}`) return send(res, 401, {}, '');
      await refresh();
      return send(res, 200, { 'Content-Type': 'application/json' }, JSON.stringify({ ok: true, version }));
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { Allow: 'GET, HEAD' }, '');

    // One canonical URL per page: «/booking/» → 301 «/booking» (query kept for UTM attribution).
    if (rawPath.length > 1 && rawPath.endsWith('/')) {
      // Rebuild from a single leading slash: «//evil.com/» must never become a protocol-relative Location.
      const canonical = '/' + rawPath.replace(/^\/+/, '').replace(/\/+$/, '');
      return send(res, 301, { Location: canonical + url.search, 'Cache-Control': 'public, max-age=3600' }, '');
    }

    const data = await getPayload();

    if (rawPath === '/robots.txt') {
      return send(res, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }, renderRobots(data));
    }
    if (rawPath === '/sitemap.xml') {
      return send(res, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }, renderSitemap(data));
    }

    // Unknown paths are rendered too (as the 404 page with a real 404 status).
    const page = renderPage(sitePaths.has(rawPath) ? rawPath : '/__not-found__');
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      // Browsers revalidate every time (ETag makes that a cheap 304); content edits show up immediately.
      'Cache-Control': 'no-cache',
      ETag: page.etag,
      'X-Site-Data': data ? 'api' : 'fallback',
    };
    if (page.status === 200 && req.headers['if-none-match'] === page.etag) return send(res, 304, headers, '');
    return send(res, page.status, headers, req.method === 'HEAD' ? '' : page.body);
  } catch (err) {
    console.error('[site] render failed:', err);
    // 5xx → nginx serves the static snapshot instead (proxy_intercept_errors + error_page).
    return send(res, 500, { 'Content-Type': 'text/plain' }, 'render error');
  }
});

server.listen(PORT, () => console.log(`[site] SSR listening on :${PORT}, API ${API_ORIGIN}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
