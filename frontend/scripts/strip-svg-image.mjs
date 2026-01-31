/**
 * Удаляет из SVG встроенное base64-изображение и делает фон прозрачным.
 * Результат — лёгкий оверлей для наложения на уже загруженное фото карточки.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const srcPath = path.join(projectRoot, 'Саша описание.svg');
const outPath = path.join(projectRoot, 'frontend/public/residents/sasha-description-overlay.svg');

let s = fs.readFileSync(srcPath, 'utf8');

// Удаляем элемент <image> с base64 (целиком)
s = s.replace(/<image[^>]*xlink:href="data:image[^"]*"[^/]*\/>/g, '');

// Серый фон — делаем прозрачным
s = s.replace(
  /<rect width="1080" height="1350" fill="#505050"[^>]*\/>/,
  '<rect width="1080" height="1350" fill="none"/>'
);

// Rect с фото (pattern) — делаем прозрачным
s = s.replace(
  /<rect y="-247" width="1257" height="1891" fill="url\(#pattern0_100_3056\)"[^>]*\/>/,
  '<rect y="-247" width="1257" height="1891" fill="none"/>'
);

// Удаляем блок <pattern>...</pattern> (он ссылается на удалённый image)
s = s.replace(
  /<pattern id="pattern0_100_3056"[^>]*>\s*<use[^>]*\/>\s*<\/pattern>/g,
  ''
);

fs.writeFileSync(outPath, s);
const sizeKB = (s.length / 1024).toFixed(1);
console.log(`Written ${outPath} (${sizeKB} KB)`);
