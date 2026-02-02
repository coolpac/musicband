#!/bin/bash

# Скрипт оптимизации видео для веб-стриминга
# Использует рекомендации из docs/VIDEO_HOSTING_AND_SERVER.md
#
# Использование:
#   ./scripts/optimize-videos.sh путь/к/видео.mp4
#   или для всех видео в папке:
#   ./scripts/optimize-videos.sh путь/к/папке/*.mp4

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка наличия ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}Ошибка: ffmpeg не установлен${NC}"
    echo "Установите ffmpeg:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "  Windows: скачайте с https://ffmpeg.org/download.html"
    exit 1
fi

# Директории проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
ORIGINAL_DIR="$BACKEND_DIR/uploads/video/original"
OPTIMIZED_DIR="$BACKEND_DIR/uploads/video/optimized"
THUMB_DIR="$BACKEND_DIR/uploads/video/thumb"

# Создание директорий если их нет
mkdir -p "$ORIGINAL_DIR" "$OPTIMIZED_DIR" "$THUMB_DIR"

# Настройки оптимизации (согласно docs/VIDEO_HOSTING_AND_SERVER.md)
# Для 1080p: битрейт 2.5 Мбит/с
# Для 720p: битрейт 1.5 Мбит/с
VIDEO_CODEC="libx264"
AUDIO_CODEC="aac"
AUDIO_BITRATE="128k"
CRF=23  # Качество (18-28, где 23 - хороший баланс)
PRESET="medium"  # Скорость кодирования (ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow)

# Функция оптимизации одного видео
optimize_video() {
    local input_file="$1"
    local filename=$(basename "$input_file")
    local name="${filename%.*}"
    local ext="${filename##*.}"
    
    echo -e "${YELLOW}Обработка: $filename${NC}"
    
    # Копируем оригинал
    echo "  → Сохранение оригинала..."
    cp "$input_file" "$ORIGINAL_DIR/$filename"
    
    # Получаем разрешение видео
    resolution=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$input_file")
    width=$(echo $resolution | cut -d'x' -f1)
    height=$(echo $resolution | cut -d'x' -f2)
    
    echo "  → Исходное разрешение: ${width}x${height}"
    
    # Определяем целевое разрешение и битрейт
    if [ "$height" -gt 1080 ] || [ "$width" -gt 1920 ]; then
        target_height=1080
        video_bitrate="2500k"
        maxrate="3000k"
        bufsize="6000k"
        echo "  → Уменьшение до 1080p, битрейт 2.5 Мбит/с"
    elif [ "$height" -gt 720 ] || [ "$width" -gt 1280 ]; then
        target_height=1080
        video_bitrate="2500k"
        maxrate="3000k"
        bufsize="6000k"
        echo "  → Оптимизация для 1080p, битрейт 2.5 Мбит/с"
    else
        target_height=720
        video_bitrate="1500k"
        maxrate="2000k"
        bufsize="4000k"
        echo "  → Оптимизация для 720p, битрейт 1.5 Мбит/с"
    fi
    
    # Оптимизированная версия
    output_file="$OPTIMIZED_DIR/${name}_optimized.mp4"
    echo "  → Кодирование оптимизированной версии..."
    
    ffmpeg -i "$input_file" \
        -c:v "$VIDEO_CODEC" \
        -crf "$CRF" \
        -preset "$PRESET" \
        -vf "scale=-2:${target_height}" \
        -maxrate "$maxrate" \
        -bufsize "$bufsize" \
        -movflags +faststart \
        -c:a "$AUDIO_CODEC" \
        -b:a "$AUDIO_BITRATE" \
        -y \
        "$output_file" 2>&1 | grep -E "time=|Duration:" || true
    
    # Генерация превью (первый кадр)
    thumb_file="$THUMB_DIR/${name}_thumb.jpg"
    echo "  → Создание превью..."
    ffmpeg -i "$output_file" -ss 00:00:01 -vframes 1 -q:v 2 -y "$thumb_file" 2>&1 | grep -v "deprecated" || true
    
    # Статистика
    original_size=$(du -h "$input_file" | cut -f1)
    optimized_size=$(du -h "$output_file" | cut -f1)
    original_bytes=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file")
    optimized_bytes=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file")
    reduction=$(( 100 - (optimized_bytes * 100 / original_bytes) ))
    
    echo -e "${GREEN}  ✓ Готово!${NC}"
    echo "    Оригинал:       $original_size"
    echo "    Оптимизирован:  $optimized_size"
    echo "    Уменьшение:     ${reduction}%"
    echo "    Сохранено в:    $output_file"
    echo ""
}

# Главная логика
if [ $# -eq 0 ]; then
    echo -e "${RED}Ошибка: Не указаны файлы для обработки${NC}"
    echo ""
    echo "Использование:"
    echo "  $0 видео.mp4"
    echo "  $0 видео1.mp4 видео2.mp4 видео3.mp4"
    echo "  $0 /путь/к/папке/*.mp4"
    echo ""
    echo "Пример:"
    echo "  $0 ~/Downloads/\"7 лепесток с вами.mp4\""
    echo "  $0 ~/Downloads/*.mp4"
    exit 1
fi

echo -e "${GREEN}=== Оптимизация видео для веб-стриминга ===${NC}"
echo ""

total_files=$#
current=0

for video_file in "$@"; do
    current=$((current + 1))
    
    if [ ! -f "$video_file" ]; then
        echo -e "${RED}Файл не найден: $video_file${NC}"
        continue
    fi
    
    echo -e "${YELLOW}[$current/$total_files]${NC}"
    optimize_video "$video_file"
done

echo -e "${GREEN}=== Все видео обработаны! ===${NC}"
echo ""
echo "Результаты:"
echo "  Оригиналы:         $ORIGINAL_DIR"
echo "  Оптимизированные:  $OPTIMIZED_DIR"
echo "  Превью:            $THUMB_DIR"
echo ""
echo "Следующие шаги:"
echo "  1. Проверьте качество оптимизированных видео"
echo "  2. Удалите оригиналы если качество устраивает"
echo "  3. Используйте оптимизированные версии на сервере"
