#!/usr/bin/env node
/**
 * Optimize assets in frontend/src/assets:
 * - SVG: run through SVGO (removeTitle, removeDesc, removeComments, removeMetadata,
 *   removeXMLNS, convertPathData; keep viewBox).
 * - PNG/JPG: create WebP alongside (quality 80) via Sharp.
 * Does NOT touch SVG files used as React components (import x from './file.svg?react').
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { optimize as svgoOptimize } from 'svgo';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../src/assets');

const SVGO_CONFIG = {
  plugins: [
    'preset-default',
    'removeTitle',
    // Keep xmlns so SVG works as img src and standalone; preset has removeComments, removeMetadata, removeDesc, convertPathData
    { name: 'removeViewBox', enabled: false },
  ],
};

const WEBP_QUALITY = 80;

async function findFiles(dir, extList) {
  const exts = new Set(extList.map((e) => e.toLowerCase()));
  const list = [];
  async function walk(d) {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (exts.has(path.extname(e.name).toLowerCase().slice(1))) list.push(full);
    }
  }
  await walk(dir);
  return list;
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

async function optimizeSvg(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const before = Buffer.byteLength(raw, 'utf8');
  const result = svgoOptimize(raw, { ...SVGO_CONFIG, path: filePath });
  const after = Buffer.byteLength(result.data, 'utf8');
  await fs.writeFile(filePath, result.data, 'utf8');
  return { before, after, path: filePath };
}

async function optimizeRaster(filePath) {
  const before = (await fs.stat(filePath)).size;
  const webpPath = filePath.replace(/\.(png|jpe?g)$/i, '.webp');
  await sharp(filePath).webp({ quality: WEBP_QUALITY }).toFile(webpPath);
  const after = (await fs.stat(webpPath)).size;
  return { before, after, path: webpPath, original: filePath };
}

async function main() {
  console.log('Optimizing assets in', ASSETS_DIR);
  console.log('');

  const svgFiles = await findFiles(ASSETS_DIR, ['svg']);
  const rasterFiles = await findFiles(ASSETS_DIR, ['png', 'jpg', 'jpeg']);

  let totalSvgBefore = 0;
  let totalSvgAfter = 0;
  let totalRasterBefore = 0;
  let totalRasterAfter = 0;

  if (svgFiles.length > 0) {
    console.log('--- SVG (SVGO) ---');
    for (const fp of svgFiles) {
      const { before, after } = await optimizeSvg(fp);
      totalSvgBefore += before;
      totalSvgAfter += after;
      const saved = before - after;
      const rel = path.relative(ASSETS_DIR, fp);
      console.log(`  ${rel}: ${formatKb(before)} → ${formatKb(after)} (saved ${formatKb(saved)})`);
    }
    console.log('');
  }

  if (rasterFiles.length > 0) {
    console.log('--- PNG/JPG → WebP ---');
    for (const fp of rasterFiles) {
      const { before, after } = await optimizeRaster(fp);
      totalRasterBefore += before;
      totalRasterAfter += after;
      const rel = path.relative(ASSETS_DIR, fp);
      const webpRel = path.relative(ASSETS_DIR, fp.replace(/\.(png|jpe?g)$/i, '.webp'));
      console.log(`  ${rel} → ${webpRel}: ${formatKb(before)} → ${formatKb(after)}`);
    }
    console.log('');
  }

  const svgSaved = totalSvgBefore - totalSvgAfter;
  const rasterSaved = totalRasterBefore - totalRasterAfter;
  const totalSaved = svgSaved + rasterSaved;

  console.log('--- Report ---');
  console.log(`  SVG: ${svgFiles.length} files, saved ${formatKb(svgSaved)}`);
  console.log(`  Raster: ${rasterFiles.length} files → WebP, original total ${formatKb(totalRasterBefore)}, WebP total ${formatKb(totalRasterAfter)} (saved ${formatKb(rasterSaved)})`);
  console.log(`  Total saved: ${formatKb(totalSaved)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
