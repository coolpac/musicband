import { apiGet, apiPost, apiPut, apiDelete, getMessageFromErrorBody } from './apiClient';

const BASE = '/api/admin/posters';

export interface AdminPoster {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  link?: string | null;
  order?: number;
  /**
   * Дата события для сайта. Бэкенд отдаёт `@db.Date`, поэтому в JSON приходит
   * либо 'YYYY-MM-DD', либо ISO-строка; null — афиша без даты.
   * Поле появилось вместе с сайтом — у старого бэкенда его может не быть.
   */
  eventDate?: string | null;
  /** Площадка и/или время свободным текстом: «Парк «Зелёный», 20:30». */
  venue?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePosterInput {
  title: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  order?: number;
  /** 'YYYY-MM-DD' или null (очистить). */
  eventDate?: string | null;
  venue?: string | null;
}

export interface UpdatePosterInput {
  title?: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  order?: number;
  eventDate?: string | null;
  venue?: string | null;
}

/** Нормализует дату афиши к значению <input type="date"> ('' — даты нет). */
export function posterDateInputValue(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.length < 10) return '';
  const candidate = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}

/** «2026-05-12» → «12 мая 2026». Возвращает null, если даты нет или она битая. */
export function formatPosterDate(value: string | null | undefined): string | null {
  const iso = posterDateInputValue(value);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function getAdminPosters(): Promise<AdminPoster[]> {
  const data = await apiGet<AdminPoster[]>(BASE);
  return Array.isArray(data) ? data : [];
}

export async function createAdminPoster(input: CreatePosterInput): Promise<AdminPoster> {
  return apiPost<AdminPoster>(BASE, {
    title: input.title,
    description: input.description || undefined,
    imageUrl: input.imageUrl || undefined,
    link: input.link || undefined,
    order: input.order,
    eventDate: input.eventDate,
    venue: input.venue,
  });
}

export async function updateAdminPoster(id: string, input: UpdatePosterInput): Promise<AdminPoster> {
  return apiPut<AdminPoster>(`${BASE}/${id}`, {
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    link: input.link,
    order: input.order,
    eventDate: input.eventDate,
    venue: input.venue,
  });
}

export async function deleteAdminPoster(id: string): Promise<void> {
  await apiDelete(`${BASE}/${id}`);
}

/** Скрыть/показать афишу без удаления. Возвращает обновлённую афишу. */
export async function toggleAdminPoster(id: string): Promise<AdminPoster> {
  return apiPost<AdminPoster>(`${BASE}/${id}/toggle`, {});
}

/**
 * Загружает изображение на сервер и возвращает URL для сохранения в афише.
 * Конвертирует data URL (из FileUpload) в File и отправляет на POST /api/upload/image.
 */
export async function uploadPosterImage(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const apiBase = import.meta.env.VITE_API_URL || '';
  const uploadUrl = apiBase ? `${apiBase}/upload/image` : '/api/upload/image';
  const token = typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token')) : null;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    body: (() => {
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/data:([^;]+)/)?.[1] || 'image/png';
      const bstr = atob(arr[1] || '');
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while (n--) u8[n] = bstr.charCodeAt(n);
      const file = new File([u8], 'poster.jpg', { type: mime });
      const fd = new FormData();
      fd.append('image', file);
      return fd;
    })(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getMessageFromErrorBody(err, `HTTP ${res.status}`));
  }

  const json = await res.json();
  const data = json?.data;
  const url = data?.originalUrl ?? data?.original?.url;
  if (typeof url !== 'string') {
    throw new Error('Сервер не вернул URL изображения');
  }
  return url;
}
