/**
 * Извлекает встроенные base64 JPEG/PNG из SVG-обёрток резидентов
 * и конвертирует в оптимизированные WebP файлы.
 *
 * SVG файлы: 55MB (base64 JPEG/PNG внутри SVG контейнера)
 * WebP файлы: ~3-4MB суммарно (ожидаемая экономия 90%+)
 *
 * Использование: node scripts/convert-residents-svg.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import sharp from 'sharp';

const RESIDENTS_DIR = join(import.meta.dirname, '..', 'public', 'residents');

const SVG_FILES = [
  'sasha.svg',
  'alexandr.svg',
  'roma.svg',
  'egor.svg',
  'vadim.svg',
  'anya.svg',
  'sasha-full.svg',
];

async function extractAndConvert(svgFile) {
  const filePath = join(RESIDENTS_DIR, svgFile);
  const name = basename(svgFile, '.svg');

  if (!existsSync(filePath)) {
    console.warn(`  [SKIP] ${svgFile} — файл не найден`);
    return null;
  }

  const svgContent = readFileSync(filePath, 'utf-8');

  // Извлекаем base64 данные из <image xlink:href="data:image/...;base64,...">
  const base64Match = svgContent.match(/data:image\/(jpeg|png);base64,([A-Za-z0-9+/=\s]+)/);

  if (!base64Match) {
    console.warn(`  [SKIP] ${svgFile} — нет встроенного base64 изображения`);
    return null;
  }

  const format = base64Match[1]; // jpeg или png
  const base64Data = base64Match[2].replace(/\s/g, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const originalSizeKB = (readFileSync(filePath).length / 1024).toFixed(0);
  const rawImageSizeKB = (buffer.length / 1024).toFixed(0);

  // Получаем размеры из viewBox SVG
  const viewBoxMatch = svgContent.match(/viewBox="0 0 (\d+) (\d+)"/);
  const targetWidth = viewBoxMatch ? parseInt(viewBoxMatch[1]) : undefined;
  const targetHeight = viewBoxMatch ? parseInt(viewBoxMatch[2]) : undefined;

  // Конвертируем в WebP
  const webpPath = join(RESIDENTS_DIR, `${name}.webp`);
  const webpBuffer = await sharp(buffer)
    .resize(targetWidth, targetHeight, {
      fit: 'cover',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  writeFileSync(webpPath, webpBuffer);

  const webpSizeKB = (webpBuffer.length / 1024).toFixed(0);
  const savings = (((readFileSync(filePath).length - webpBuffer.length) / readFileSync(filePath).length) * 100).toFixed(1);

  console.log(
    `  ${svgFile}: ${originalSizeKB}KB (SVG) → ${rawImageSizeKB}KB (raw ${format}) → ${webpSizeKB}KB (WebP) | экономия ${savings}%`
  );

  return { name, webpPath, webpSizeKB, originalSizeKB, savings };
}

async function main() {
  console.log('=== Конвертация SVG резидентов в WebP ===\n');
  console.log(`Директория: ${RESIDENTS_DIR}\n`);

  let totalOriginal = 0;
  let totalWebp = 0;

  for (const file of SVG_FILES) {
    const result = await extractAndConvert(file);
    if (result) {
      totalOriginal += parseInt(result.originalSizeKB);
      totalWebp += parseInt(result.webpSizeKB);
    }
  }

  console.log('\n=== Итого ===');
  console.log(`  SVG оригиналы: ${(totalOriginal / 1024).toFixed(1)} MB`);
  console.log(`  WebP результат: ${(totalWebp / 1024).toFixed(1)} MB`);
  console.log(`  Экономия: ${(((totalOriginal - totalWebp) / totalOriginal) * 100).toFixed(1)}%`);
  console.log('\nГотово! WebP файлы созданы в public/residents/');
  console.log('Не забудьте обновить residents.ts: .svg → .webp');
}

main().catch(console.error);
