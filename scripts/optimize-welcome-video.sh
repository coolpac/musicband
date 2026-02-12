#!/bin/bash
# Оптимизация приветственного видео для Telegram User Bot (/start).
# Лимит Telegram Bot API для отправки файла: 50 МБ.
#
# Использование:
#   ./scripts/optimize-welcome-video.sh путь/к/видео.mp4

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if ! command -v ffmpeg &> /dev/null; then
  echo -e "${RED}Ошибка: ffmpeg не установлен${NC}"
  echo "Установите: brew install ffmpeg (macOS) или apt-get install ffmpeg (Linux)"
  exit 1
fi

if [ $# -lt 1 ]; then
  echo -e "${RED}Укажите путь к видеофайлу${NC}"
  echo "Пример: $0 ~/Downloads/\"2026-02-12 21.59.07.mp4\""
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$PROJECT_ROOT/backend/assets/welcome-video"
OUT_FILE="$OUT_DIR/welcome.mp4"
INPUT="$1"

if [ ! -f "$INPUT" ]; then
  echo -e "${RED}Файл не найден: $INPUT${NC}"
  exit 1
fi

mkdir -p "$OUT_DIR"

# Целевой размер для Telegram: до 50 МБ. Ориентир: 720p, ~1.5–2 Мбит/с
# -movflags +faststart — быстрый старт воспроизведения в клиенте
echo -e "${YELLOW}Оптимизация для Telegram (макс. 50 МБ)...${NC}"
ffmpeg -i "$INPUT" \
  -c:v libx264 \
  -crf 23 \
  -preset medium \
  -vf "scale=-2:720" \
  -maxrate 2000k \
  -bufsize 4000k \
  -movflags +faststart \
  -c:a aac \
  -b:a 128k \
  -y \
  "$OUT_FILE" 2>&1 | grep -E "time=|Duration:|error|Error" || true

# Проверка размера (50 МБ лимит Telegram). Портируемо: stat для размера в байтах
BYTES=$(stat -f%z "$OUT_FILE" 2>/dev/null || stat -c%s "$OUT_FILE" 2>/dev/null)
LIMIT=$((50 * 1024 * 1024))
if [ -n "$BYTES" ] && [ "$BYTES" -gt "$LIMIT" ]; then
  SIZE_MB=$((BYTES / 1024 / 1024))
  echo -e "${YELLOW}Размер ${SIZE_MB} МБ > 50 МБ. Пережимаем сильнее...${NC}"
  ffmpeg -i "$OUT_FILE" \
    -c:v libx264 -crf 28 -preset fast -vf "scale=-2:720" \
    -maxrate 1200k -bufsize 2400k -movflags +faststart \
    -c:a aac -b:a 96k -y "$OUT_FILE.tmp" 2>/dev/null
  mv "$OUT_FILE.tmp" "$OUT_FILE"
fi

echo -e "${GREEN}Готово: $OUT_FILE${NC}"
echo "Размер: $(du -h "$OUT_FILE" | cut -f1)"
