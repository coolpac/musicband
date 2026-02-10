import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

const BASE = '/api/admin/posters';

export interface AdminPoster {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  link?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePosterInput {
  title: string;
  description?: string;
  imageUrl?: string;
  link?: string;
}

export interface UpdatePosterInput {
  title?: string;
  description?: string;
  imageUrl?: string;
  link?: string;
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
  });
}

export async function updateAdminPoster(id: string, input: UpdatePosterInput): Promise<AdminPoster> {
  return apiPut<AdminPoster>(`${BASE}/${id}`, {
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    link: input.link,
  });
}

export async function deleteAdminPoster(id: string): Promise<void> {
  await apiDelete(`${BASE}/${id}`);
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
    const msg = (err && typeof err === 'object' && (err as any).error?.message) || (err as any).message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const json = await res.json();
  const data = json?.data;
  const url = data?.originalUrl ?? data?.original?.url;
  if (typeof url !== 'string') {
    throw new Error('Сервер не вернул URL изображения');
  }
  return url;
}
