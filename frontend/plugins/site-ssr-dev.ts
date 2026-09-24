import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

/** Must mirror src/site/router/routes.ts → SITE_PATHS (kept literal: this file runs before Vite can load TS from src). */
const SITE_PATHS = new Set(['/', '/booking', '/booking/form', '/booking/success', '/privacy', '/terms', '/offer']);

/** Query params that mean "this is a Mini App launch", same rule as the production nginx map. */
const MINI_APP_PARAMS = ['screen', 'tgWebAppStartParam', 'startapp'];

export const SITE_TEMPLATE_MARKERS = {
  head: '<!--site-head-->',
  html: '<!--site-html-->',
  data: '/*site-data*/ undefined',
} as const;

export function fillSiteTemplate(template: string, parts: { head: string; html: string; data: string }): string {
  // Function replacers: `$&` / `$1` sequences inside rendered content must not be interpreted.
  return template
    .replace(SITE_TEMPLATE_MARKERS.head, () => parts.head)
    .replace(SITE_TEMPLATE_MARKERS.html, () => parts.html)
    .replace(SITE_TEMPLATE_MARKERS.data, () => parts.data);
}

async function fetchPayload(apiOrigin: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${apiOrigin}/api/public/site`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: unknown };
    return body && typeof body === 'object' && 'data' in body ? body.data : body;
  } catch {
    return null; // backend not running locally → bundled defaults, same as the production fallback
  }
}

/**
 * `vite dev` parity with production: site routes are server-rendered through the real
 * entry-server (so hydration mismatches show up while developing, not after deploy),
 * everything else — the Mini App at /app and /?screen=…, the admin at /admin — is untouched.
 */
export function siteSsrDevPlugin(options: { apiOrigin?: string } = {}): Plugin {
  const apiOrigin = options.apiOrigin ?? 'http://localhost:3000';
  return {
    name: 'site-ssr-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url) return next();
        const url = new URL(req.url, 'http://dev.local');
        const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

        // Mini App lives at /app in dev exactly as it will in production.
        if (pathname === '/app' || pathname.startsWith('/app/')) {
          req.url = `/index.html${url.search}`;
          return next();
        }

        const isRobots = pathname === '/robots.txt';
        const isSitemap = pathname === '/sitemap.xml';
        const accept = req.headers.accept ?? '';
        const wantsHtml = accept.includes('text/html') || accept.includes('*/*') || accept === '';
        const isSiteRoute = SITE_PATHS.has(pathname) && !MINI_APP_PARAMS.some((p) => url.searchParams.has(p));
        if (!isRobots && !isSitemap && !(isSiteRoute && wantsHtml)) return next();

        try {
          const entry = await server.ssrLoadModule('/src/site/entry-server.tsx');
          const payload = await fetchPayload(apiOrigin);

          if (isRobots || isSitemap) {
            res.statusCode = 200;
            res.setHeader('Content-Type', isRobots ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8');
            return res.end(isRobots ? entry.renderRobots(payload) : entry.renderSitemap(payload));
          }

          const raw = await fs.readFile(path.resolve(server.config.root, 'site.html'), 'utf8');
          const template = await server.transformIndexHtml(req.url, raw);
          const result = entry.render(`${pathname}${url.search}`, payload);
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(fillSiteTemplate(template, result));
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          next(err);
        }
      });
    },
  };
}
