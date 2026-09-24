#!/usr/bin/env node
/**
 * Generates every static file the public site links to from `<head>`:
 *
 *   public/site/favicon.ico            32×32 ICO (single PNG-compressed image)
 *   public/site/icon.svg               scalable brand mark
 *   public/site/apple-touch-icon.png   180×180, opaque, full-bleed (iOS applies its own mask)
 *   public/site/icon-192.png           192×192 rounded square, transparent outside the corners
 *   public/site/icon-512.png           512×512 rounded square
 *   public/site/icon-maskable-512.png  512×512 full-bleed, glyph inside the 80 % safe circle
 *   public/site/manifest.webmanifest
 *   public/site/og-default.jpg         1200×630 JPEG (social scrapers do not read AVIF/WebP)
 *
 * The mark is the brand red square with the letter «В» of the ВГУЛ wordmark. The glyph is NOT
 * drawn here: it is the first <path> of the exported wordmark
 * (src/site/assets/repertoire-collapsed/vgul-wordmark-large.svg), cropped to its own bounding box
 * with a nested <svg viewBox>. The bounding box is measured by rasterising that one path and
 * scanning its alpha channel, so it stays correct if the export is ever refreshed.
 *
 * Deterministic: same inputs → byte-identical outputs. Re-run after changing the wordmark, the hero
 * photo or the brand colour, then commit the results.
 *
 *   node scripts/generate-site-icons.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'site');
const WORDMARK_SVG = path.join(ROOT, 'src', 'site', 'assets', 'repertoire-collapsed', 'vgul-wordmark-large.svg');
const HERO_PNG = path.join(ROOT, 'src', 'site', 'assets', 'hero', 'hero-poster-bg.png');

/** Brand red — must stay in sync with --c-accent in src/site/styles/tokens.css. */
const BRAND_RED = '#ff3135';
const GLYPH_WHITE = '#ffffff';
/** iOS/Android “squircle” corner: 22.37 % of the edge. */
const CORNER_RATIO = 0.2237;

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_MAX_BYTES = 200 * 1024;

/* ── 1. The «В» glyph, taken from the real wordmark export ──────────────────── */

/** Rasterisation scale used to measure the glyph's bounding box (¼ user unit precision). */
const PROBE_SCALE = 4;

function parseWordmark(svg) {
  const viewBox = /\bviewBox="([-\d.\s]+)"/.exec(svg);
  if (!viewBox) throw new Error(`${WORDMARK_SVG}: no viewBox`);
  const [x, y, width, height] = viewBox[1].trim().split(/\s+/).map(Number);
  if (![x, y, width, height].every(Number.isFinite)) throw new Error(`${WORDMARK_SVG}: unparsable viewBox "${viewBox[1]}"`);

  // The four letters are separate <path> elements; the first one is «В».
  const paths = [...svg.matchAll(/<path\b[^>]*?\bd="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length !== 4) {
    throw new Error(`${WORDMARK_SVG}: expected 4 letter paths (ВГУЛ), found ${paths.length} — re-check the export before regenerating icons`);
  }
  return { viewBox: { x, y, width, height }, d: paths[0] };
}

/** Exact ink bounds of a path, in the wordmark's own user units. */
async function measurePath(d, viewBox) {
  const probe = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${Math.round(viewBox.width * PROBE_SCALE)}" height="${Math.round(viewBox.height * PROBE_SCALE)}"`,
    ` viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">`,
    `<path d="${d}" fill="#000000"/></svg>`,
  ].join('');
  const { data, info } = await sharp(Buffer.from(probe)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let py = 0; py < height; py++) {
    const row = py * width * channels;
    for (let px = 0; px < width; px++) {
      if (data[row + px * channels + 3] > 8) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }
  if (maxX < 0) throw new Error('the first wordmark path rasterised to nothing');

  return {
    x: viewBox.x + minX / PROBE_SCALE,
    y: viewBox.y + minY / PROBE_SCALE,
    width: (maxX - minX + 1) / PROBE_SCALE,
    height: (maxY - minY + 1) / PROBE_SCALE,
  };
}

/* ── 2. Composition helpers ─────────────────────────────────────────────────── */

const round = (n) => Math.round(n * 1000) / 1000;

function glyphSvg(box, d, width, height) {
  // A nested viewBox equal to the glyph's bounding box crops the letter out of the wordmark
  // without touching the path data.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="${round(box.x)} ${round(box.y)} ${round(box.width)} ${round(box.height)}">` +
    `<path d="${d}" fill="${GLYPH_WHITE}"/></svg>`
  );
}

function plateSvg(size, cornerRatio) {
  const r = round(size * cornerRatio);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BRAND_RED}"/></svg>`
  );
}

/**
 * @param {object} o
 * @param {number} o.size          edge length in px
 * @param {number} o.cornerRatio   0 = full-bleed square (maskable / apple-touch)
 * @param {number} o.glyphRatio    glyph height as a fraction of the edge
 * @param {boolean} [o.opaque]     drop the alpha channel (required for apple-touch & maskable)
 */
async function renderIcon({ size, cornerRatio, glyphRatio, opaque = false }, box, d) {
  const glyphHeight = Math.round(size * glyphRatio);
  const glyphWidth = Math.round(glyphHeight * (box.width / box.height));
  let image = sharp(Buffer.from(plateSvg(size, cornerRatio))).composite([
    {
      input: Buffer.from(glyphSvg(box, d, glyphWidth, glyphHeight)),
      left: Math.round((size - glyphWidth) / 2),
      top: Math.round((size - glyphHeight) / 2),
    },
  ]);
  if (opaque) image = image.flatten({ background: BRAND_RED });
  return image.png({ compressionLevel: 9 }).toBuffer();
}

/** Minimal ICO container around a PNG image (every browser since IE11 reads PNG-in-ICO). */
function pngToIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // width  (0 means 256)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1); // height
    header.writeUInt8(0, entry + 2); // palette size (0 = truecolour)
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

/* ── 3. Open Graph image ────────────────────────────────────────────────────── */

async function renderOgImage() {
  const meta = await sharp(HERO_PNG).metadata();
  if (!meta.width || !meta.height) throw new Error(`${HERO_PNG}: unreadable`);

  // Cover-crop to 1.905:1. The hero is 16:9, so only height is trimmed — and only from the
  // bottom, which holds torsos: the wordmark at the top and all five faces stay in frame.
  const cropHeight = Math.min(meta.height, Math.round((meta.width * OG_HEIGHT) / OG_WIDTH));
  const base = await sharp(HERO_PNG)
    .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer();

  // Slight bottom darkening: keeps light-on-dark overlays (Telegram, VK) legible over the photo.
  const scrim =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">` +
    `<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0.55" stop-color="#000000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000000" stop-opacity="0.42"/>` +
    `</linearGradient></defs>` +
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#scrim)"/></svg>`;

  const composed = await sharp(base)
    .composite([{ input: Buffer.from(scrim), left: 0, top: 0 }])
    .flatten({ background: '#000000' })
    .toBuffer();

  for (const quality of [86, 82, 78, 74, 70, 66, 62]) {
    const jpeg = await sharp(composed).jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
    if (jpeg.length <= OG_MAX_BYTES) return { jpeg, quality };
  }
  throw new Error(`could not fit the OG image into ${OG_MAX_BYTES} bytes — re-check the source photo`);
}

/* ── 4. Manifest ────────────────────────────────────────────────────────────── */

const MANIFEST = {
  name: 'ВГУЛ — кавер-группа',
  short_name: 'ВГУЛ',
  lang: 'ru',
  dir: 'ltr',
  description: 'Кавер-группа ВГУЛ — живая музыка на праздники, корпоративы и свадьбы.',
  start_url: '/',
  scope: '/',
  // «browser», not «standalone»: this is a website, and an app-like shell would hide the URL bar
  // and break shared links.
  display: 'browser',
  theme_color: '#000000',
  background_color: '#000000',
  icons: [
    { src: '/site/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/site/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/site/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/site/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

/* ── 5. Run ─────────────────────────────────────────────────────────────────── */

async function main() {
  const wordmark = parseWordmark(await fs.readFile(WORDMARK_SVG, 'utf8'));
  const box = await measurePath(wordmark.d, wordmark.viewBox);

  // Sanity: «В» is the leftmost letter and is roughly square. A different export would silently
  // produce a nonsense icon, so fail loudly instead.
  const aspect = box.width / box.height;
  if (box.x > wordmark.viewBox.width * 0.1 || aspect < 0.75 || aspect > 1.25) {
    throw new Error(
      `the first wordmark path does not look like «В» (x=${round(box.x)}, aspect=${round(aspect)}) — check ${path.relative(ROOT, WORDMARK_SVG)}`
    );
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const written = [];
  const write = async (name, buffer) => {
    await fs.writeFile(path.join(OUT_DIR, name), buffer);
    written.push([name, buffer.length]);
  };

  // Rounded plate, transparent corners — browser tabs and the «any» manifest icons.
  const favicon32 = await renderIcon({ size: 32, cornerRatio: CORNER_RATIO, glyphRatio: 0.6 }, box, wordmark.d);
  await write('favicon.ico', pngToIco([{ size: 32, png: favicon32 }]));
  await write('icon-192.png', await renderIcon({ size: 192, cornerRatio: CORNER_RATIO, glyphRatio: 0.56 }, box, wordmark.d));
  await write('icon-512.png', await renderIcon({ size: 512, cornerRatio: CORNER_RATIO, glyphRatio: 0.56 }, box, wordmark.d));

  // iOS rounds the icon itself — ship a full-bleed opaque square.
  await write('apple-touch-icon.png', await renderIcon({ size: 180, cornerRatio: 0, glyphRatio: 0.56, opaque: true }, box, wordmark.d));

  // Maskable: the platform may crop to a circle of 80 % diameter. With the «В» aspect ratio a
  // 0.5·512 glyph has a 0.69·512 diagonal — comfortably inside the 0.8·512 safe zone.
  await write('icon-maskable-512.png', await renderIcon({ size: 512, cornerRatio: 0, glyphRatio: 0.5, opaque: true }, box, wordmark.d));

  const svgIcon =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="ВГУЛ">\n` +
    `  <rect width="512" height="512" rx="${round(512 * CORNER_RATIO)}" ry="${round(512 * CORNER_RATIO)}" fill="${BRAND_RED}"/>\n` +
    `  <svg x="${round((512 - 512 * 0.56 * (box.width / box.height)) / 2)}" y="${round((512 - 512 * 0.56) / 2)}"` +
    ` width="${round(512 * 0.56 * (box.width / box.height))}" height="${round(512 * 0.56)}"` +
    ` viewBox="${round(box.x)} ${round(box.y)} ${round(box.width)} ${round(box.height)}">\n` +
    `    <path d="${wordmark.d}" fill="${GLYPH_WHITE}"/>\n` +
    `  </svg>\n` +
    `</svg>\n`;
  await write('icon.svg', Buffer.from(svgIcon, 'utf8'));

  await write('manifest.webmanifest', Buffer.from(`${JSON.stringify(MANIFEST, null, 2)}\n`, 'utf8'));

  const og = await renderOgImage();
  await write('og-default.jpg', og.jpeg);

  const rel = path.relative(process.cwd(), OUT_DIR);
  console.log(`site icons → ${rel} (glyph bbox ${round(box.x)} ${round(box.y)} ${round(box.width)} ${round(box.height)}, og quality ${og.quality})`);
  for (const [name, bytes] of written) {
    console.log(`  ${name.padEnd(26)} ${(bytes / 1024).toFixed(1).padStart(7)} KB`);
  }
}

main().catch((err) => {
  console.error(`generate-site-icons: ${err.message}`);
  process.exitCode = 1;
});
