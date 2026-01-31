#!/usr/bin/env node
/**
 * find-unused-assets.mjs
 * Scans .ts/.tsx in src/ for imports from assets/ and lists files in src/assets/
 * that are never imported (candidates for removal).
 *
 * Usage: node scripts/find-unused-assets.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '../src');
const ASSETS_DIR = path.join(SRC_DIR, 'assets');

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function extractImportPaths(content) {
  const paths = new Set();
  // import x from '../assets/figma/foo.webp' or "assets/figma/foo.svg?url"
  const re = /from\s+['"]([^'"]*assets\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    paths.add(m[1].split('?')[0]); // drop ?url etc
  }
  return paths;
}

function resolveImportToAssetPath(importPath, fromFile) {
  // importPath is e.g. ../assets/figma/hero-image.webp or ../../assets/figma/foo.svg
  if (importPath.startsWith('assets/')) return path.join(SRC_DIR, importPath);
  const fromDir = path.dirname(fromFile);
  const resolved = path.normalize(path.join(fromDir, importPath));
  return resolved;
}

async function main() {
  const usedPaths = new Set();

  for await (const file of walk(SRC_DIR)) {
    const ext = path.extname(file);
    if (ext !== '.ts' && ext !== '.tsx') continue;
    const content = await fs.readFile(file, 'utf-8').catch(() => '');
    const imports = extractImportPaths(content);
    for (const imp of imports) {
      const resolved = resolveImportToAssetPath(imp, file);
      usedPaths.add(resolved);
    }
  }

  const assets = [];
  for await (const file of walk(ASSETS_DIR)) {
    assets.push(file);
  }

  const unused = [];
  for (const asset of assets) {
    const normalized = path.normalize(asset);
    const found = [...usedPaths].some((u) => path.normalize(u) === normalized);
    if (!found) {
      const stat = await fs.stat(asset).catch(() => null);
      const size = stat ? stat.size : 0;
      const rel = path.relative(SRC_DIR, asset);
      unused.push({ path: rel, size, full: asset });
    }
  }

  unused.sort((a, b) => b.size - a.size);

  console.log('Unused assets (not imported in any .ts/.tsx under src/):\n');
  let total = 0;
  for (const u of unused) {
    const sizeStr = (u.size / 1024).toFixed(1) + ' KB';
    console.log(`  ${u.path}  (${sizeStr})`);
    total += u.size;
  }
  console.log(`\nTotal: ${unused.length} files, ${(total / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
