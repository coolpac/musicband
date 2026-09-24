#!/usr/bin/env node
/**
 * Build step 3/3: render every site route to static HTML with the bundled default content
 * -> dist/site-static/<route>.html. nginx serves these snapshots when the SSR service is unreachable,
 * so the landing page never depends on a running Node process or on the backend.
 * Also writes static robots.txt / sitemap.xml fallbacks next to them.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const SSR = path.resolve(__dirname, '../dist-ssr');
const MARKERS = { head: '<!--site-head-->', html: '<!--site-html-->', data: '/*site-data*/ undefined' };

const template = await fs.readFile(path.join(DIST, 'site.html'), 'utf8');
for (const marker of Object.values(MARKERS)) {
  if (!template.includes(marker)) {
    console.error(`prerender: dist/site.html lost the «${marker}» marker`);
    process.exit(1);
  }
}

const { render, renderRobots, renderSitemap, SITE_PATHS } = await import(pathToFileURL(path.join(SSR, 'entry-server.js')).href);

const outDir = path.join(DIST, 'site-static');
await fs.mkdir(outDir, { recursive: true });

const fill = (result) =>
  template
    .replace(MARKERS.head, () => result.head)
    .replace(MARKERS.html, () => result.html)
    .replace(MARKERS.data, () => result.data);

let count = 0;
for (const route of SITE_PATHS) {
  const result = render(route, null);
  if (result.status !== 200) continue; // legal pages without text: no snapshot, nginx answers 404
  const file = route === '/' ? 'index.html' : `${route.slice(1).replace(/\//g, '-')}.html`;
  await fs.writeFile(path.join(outDir, file), fill(result), 'utf8');
  count++;
}
await fs.writeFile(path.join(outDir, '404.html'), fill(render('/__not-found__', null)), 'utf8');
await fs.writeFile(path.join(outDir, 'robots.txt'), renderRobots(null), 'utf8');
await fs.writeFile(path.join(outDir, 'sitemap.xml'), renderSitemap(null), 'utf8');

console.log(`prerender: ${count} pages + 404 + robots.txt + sitemap.xml -> dist/site-static/`);
