/**
 * Admin API режима «Сайт»: контент публичного сайта (JSON по секциям) и загрузка картинок.
 *
 * Контракт (docs/plans/2026-09-21-website-design.md §5):
 *   GET  /api/admin/site/content            -> { content, updatedAt }
 *   PUT  /api/admin/site/content/:section   -> { section, updatedAt }   (тело = JSON секции целиком)
 *
 * Дефолты контента живут во фронтенде (src/site/content/sections/*), бэкенд хранит
 * только то, что админ сохранил. Поэтому `content` здесь — частичный объект: ключ секции
 * есть, только если её хоть раз сохраняли.
 */

import { apiGet, apiPut, getMessageFromErrorBody } from './apiClient';
import type { RemoteImage, SectionId } from '../site/content/types';

const BASE = '/api/admin/site';

/** То, что реально лежит в базе: сырой JSON по секциям (проверяется mergeContent при чтении). */
export type SavedSiteContent = Partial<Record<SectionId, unknown>>;

export interface AdminSiteContent {
  content: SavedSiteContent;
  /** ISO-время последней правки любой секции; null — ничего не сохраняли. */
  updatedAt: string | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Кеш на уровне модуля: экраны «Контент» и «SEO» монтируются одновременно и читают
 * один и тот же endpoint. Инвалидация — только явная (после сохранения или по кнопке
 * «Обновить»), поэтому здесь нет TTL: устареть за время сессии контент не может —
 * его меняет только эта же вкладка админки.
 */
let cache: AdminSiteContent | null = null;
let inFlight: Promise<AdminSiteContent> | null = null;

export async function getAdminSiteContent(force = false): Promise<AdminSiteContent> {
  if (!force) {
    if (cache) return cache;
    if (inFlight) return inFlight;
  }

  const request = (async (): Promise<AdminSiteContent> => {
    const raw = await apiGet<{ content?: unknown; updatedAt?: unknown }>(`${BASE}/content`);
    const result: AdminSiteContent = {
      content: isPlainObject(raw?.content) ? (raw.content as SavedSiteContent) : {},
      updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : null,
    };
    cache = result;
    return result;
  })();

  inFlight = request;
  try {
    return await request;
  } finally {
    if (inFlight === request) inFlight = null;
  }
}

/** Сохранить секцию целиком. Пустой объект `{}` = «вернуть стандартный текст». */
export async function saveSiteSection(
  section: SectionId,
  value: Record<string, unknown>
): Promise<{ section: string; updatedAt: string | null }> {
  const saved = await apiPut<{ section?: unknown; updatedAt?: unknown }>(
    `${BASE}/content/${encodeURIComponent(section)}`,
    value
  );

  const updatedAt = typeof saved?.updatedAt === 'string' ? saved.updatedAt : null;

  // Держим модульный кеш согласованным, чтобы соседний экран не показал старое значение.
  // Кладём копию: дальше этот объект живёт как черновик в состоянии экрана.
  if (cache) {
    cache = {
      content: { ...cache.content, [section]: JSON.parse(JSON.stringify(value)) as unknown },
      updatedAt: updatedAt ?? cache.updatedAt,
    };
  }

  return { section, updatedAt };
}

/* ──────────────────────────── загрузка изображений ──────────────────────────── */

interface UploadImageResponse {
  original?: { url?: unknown; width?: unknown; height?: unknown };
  originalUrl?: unknown;
  srcSet?: { webp?: unknown; avif?: unknown };
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [head, payload = ''] = dataUrl.split(',');
  const mime = head.match(/data:([^;]+)/)?.[1] || 'image/png';
  const binary = atob(payload);
  let n = binary.length;
  const bytes = new Uint8Array(n);
  while (n--) bytes[n] = binary.charCodeAt(n);
  return new File([bytes], filename, { type: mime });
}

/**
 * Загружает data-URL (из компонента FileUpload) на существующий admin-endpoint
 * POST /api/upload/image и возвращает `RemoteImage` для контента сайта:
 * оригинал + готовые srcSet-строки AVIF/WebP.
 */
export async function uploadSiteImage(dataUrl: string, filename = 'site-image.jpg'): Promise<RemoteImage> {
  if (!dataUrl.startsWith('data:')) {
    // Уже загруженный URL — просто оборачиваем.
    return { src: dataUrl };
  }

  const apiBase = import.meta.env.VITE_API_URL || '';
  const uploadUrl = apiBase ? `${apiBase}/upload/image` : '/api/upload/image';
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('admin_token') || localStorage.getItem('auth_token')
      : null;

  const formData = new FormData();
  formData.append('image', dataUrlToFile(dataUrl, filename));

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getMessageFromErrorBody(body, `Не удалось загрузить изображение (HTTP ${res.status})`));
  }

  const json = await res.json().catch(() => null);
  const data = (json?.data ?? {}) as UploadImageResponse;

  const src = typeof data.originalUrl === 'string' ? data.originalUrl : data.original?.url;
  if (typeof src !== 'string' || src.length === 0) {
    throw new Error('Сервер не вернул адрес изображения');
  }

  const image: RemoteImage = { src };
  if (typeof data.srcSet?.avif === 'string' && data.srcSet.avif) image.avifSrcSet = data.srcSet.avif;
  if (typeof data.srcSet?.webp === 'string' && data.srcSet.webp) image.webpSrcSet = data.srcSet.webp;
  if (typeof data.original?.width === 'number') image.width = data.original.width;
  if (typeof data.original?.height === 'number') image.height = data.original.height;

  return image;
}
