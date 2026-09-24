#!/usr/bin/env node
/**
 * Site image pipeline: frontend/src/site/assets/<section>/*.{png,jpg,jpeg}
 *   -> frontend/src/site/assets/opt/<section>/<name>-w<width>.{avif,webp}
 *      (the `-w<width>` suffix is what vite.config.ts uses to skip re-encoding these files)
 *   -> frontend/src/site/assets/opt/manifest.ts (typed, statically imported by Vite)
 *
 * Raw Figma exports are 2-12 MB each and must never be imported by site code.
 * Components import `siteImages` from the manifest and render them via <Picture>.
 *
 * Re-run after adding/replacing a raw image:  npm run optimize:site
 * Output is deterministic; existing up-to-date variants are skipped.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../src/site/assets');
const OUT_DIR = path.join(ASSETS_DIR, 'opt');

const WIDTHS = [480, 768, 1080, 1440, 1920, 2560];
const AVIF = { quality: 50, effort: 6, chromaSubsampling: '4:2:0' };
const WEBP = { quality: 74, effort: 5 };
/** Rasters smaller than this are icons/previews, not photos — skipped. */
const MIN_BYTES = 20 * 1024;
const SKIP = new Set(['hero/hero-poster-bg-480']);

async function listRasters() {
  const out = [];
  const sections = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
  for (const dir of sections) {
    if (!dir.isDirectory() || dir.name === 'opt') continue;
    const files = await fs.readdir(path.join(ASSETS_DIR, dir.name));
    for (const file of files) {
      if (!/\.(png|jpe?g)$/i.test(file)) continue;
      const full = path.join(ASSETS_DIR, dir.name, file);
      const key = `${dir.name}/${file.replace(/\.[^.]+$/, '')}`;
      const { size } = await fs.stat(full);
      if (size < MIN_BYTES || SKIP.has(key)) continue;
      out.push({ key, full, section: dir.name, name: file.replace(/\.[^.]+$/, '') });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function pickWidths(originalWidth) {
  const widths = WIDTHS.filter((w) => w <= originalWidth);
  const last = widths[widths.length - 1];
  // Keep the native width when it adds real resolution over the largest preset.
  if (!last || originalWidth > last * 1.1) widths.push(Math.min(originalWidth, 2560));
  return [...new Set(widths)];
}

async function isOpaque(file) {
  const meta = await sharp(file).metadata();
  if (!meta.hasAlpha) return true;
  const { channels } = await sharp(file).stats();
  return channels[3].min === 255;
}

async function upToDate(src, dest) {
  try {
    const [a, b] = await Promise.all([fs.stat(src), fs.stat(dest)]);
    return b.mtimeMs >= a.mtimeMs && b.size > 0;
  } catch {
    return false;
  }
}

function ident(key, suffix) {
  return `${key}-${suffix}`.replace(/[^a-zA-Z0-9]+/g, '_');
}

async function main() {
  const rasters = await listRasters();
  const entries = [];
  let written = 0;
  let bytesIn = 0;
  let bytesOut = 0;

  for (const img of rasters) {
    const meta = await sharp(img.full).metadata();
    const opaque = await isOpaque(img.full);
    const widths = pickWidths(meta.width);
    const outDir = path.join(OUT_DIR, img.section);
    await fs.mkdir(outDir, { recursive: true });
    bytesIn += (await fs.stat(img.full)).size;

    const variants = { avif: [], webp: [] };
    for (const w of widths) {
      for (const format of ['avif', 'webp']) {
        const dest = path.join(outDir, `${img.name}-w${w}.${format}`);
        if (!(await upToDate(img.full, dest))) {
          let pipeline = sharp(img.full).rotate().resize({ width: w, withoutEnlargement: true });
          if (opaque) pipeline = pipeline.flatten({ background: '#000000' });
          pipeline = format === 'avif' ? pipeline.avif(AVIF) : pipeline.webp(WEBP);
          await pipeline.toFile(dest);
          written++;
        }
        variants[format].push({ w, file: `./${img.section}/${img.name}-w${w}.${format}` });
      }
    }
    // Largest AVIF is what a desktop visitor actually downloads — use it for the report.
    bytesOut += (await fs.stat(path.join(OUT_DIR, variants.avif[variants.avif.length - 1].file))).size;

    // 20px blurred placeholder + dominant colour: paints instantly, removes the "white flash".
    const placeholderBuf = await sharp(img.full)
      .resize({ width: 20 })
      .flatten({ background: '#000000' })
      .blur(1.2)
      .webp({ quality: 40 })
      .toBuffer();
    const { dominant } = await sharp(img.full).flatten({ background: '#000000' }).stats();
    const hex = (n) => n.toString(16).padStart(2, '0');

    entries.push({
      key: img.key,
      width: meta.width,
      height: meta.height,
      variants,
      placeholder: `data:image/webp;base64,${placeholderBuf.toString('base64')}`,
      color: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
    });
  }

  const imports = [];
  const body = [];
  for (const e of entries) {
    const fmt = (format) =>
      e.variants[format]
        .map((v) => {
          const id = ident(e.key, `${v.w}_${format}`);
          imports.push(`import ${id} from '${v.file}';`);
          return `{ w: ${v.w}, url: ${id} }`;
        })
        .join(', ');
    body.push(
      `  '${e.key}': {\n` +
        `    width: ${e.width},\n    height: ${e.height},\n` +
        `    avif: [${fmt('avif')}],\n    webp: [${fmt('webp')}],\n` +
        `    placeholder: '${e.placeholder}',\n    color: '${e.color}',\n  },`
    );
  }

  const manifest =
    `// AUTO-GENERATED by scripts/optimize-site-images.mjs — do not edit by hand.\n` +
    `import type { OptimizedImage } from '../../components/ui/Picture';\n\n` +
    `${imports.join('\n')}\n\n` +
    `export const siteImages = {\n${body.join('\n')}\n} satisfies Record<string, OptimizedImage>;\n\n` +
    `export type SiteImageKey = keyof typeof siteImages;\n`;
  await fs.writeFile(path.join(OUT_DIR, 'manifest.ts'), manifest, 'utf8');

  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  console.log(`site images: ${entries.length} sources, ${written} variants written`);
  console.log(`raw ${mb(bytesIn)} MB  ->  largest AVIF per image, summed: ${mb(bytesOut)} MB`);
  for (const e of entries) {
    console.log(`  ${e.key}  ${e.width}x${e.height}  [${e.variants.avif.map((v) => v.w).join(', ')}]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
