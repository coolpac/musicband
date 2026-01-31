/**
 * Admin API для отзывов.
 */

import { apiGet, apiDelete, isMockMode } from './apiClient';

export type AdminReview = {
  id: string;
  userId: string;
  rating: number;
  text: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

const BASE = '/api/admin/reviews';

const MOCK_REVIEWS: AdminReview[] = [
  {
    id: 'r1',
    userId: 'u1',
    rating: 5,
    text: 'Отличный концерт, всем рекомендую! Очень душевно и профессионально.',
    createdAt: '2026-01-15T12:00:00Z',
    updatedAt: '2026-01-15T12:00:00Z',
    user: { id: 'u1', username: 'fan1', firstName: 'Алексей', lastName: null },
  },
  {
    id: 'r2',
    userId: 'u2',
    rating: 4,
    text: null,
    createdAt: '2026-01-20T18:30:00Z',
    updatedAt: '2026-01-20T18:30:00Z',
    user: { id: 'u2', username: null, firstName: 'Мария', lastName: 'Петрова' },
  },
  {
    id: 'r3',
    userId: 'u3',
    rating: 5,
    text: 'Были на свадьбе — гости в восторге. Спасибо за атмосферу!',
    createdAt: '2026-01-22T10:15:00Z',
    updatedAt: '2026-01-22T10:15:00Z',
    user: { id: 'u3', username: 'happy_guest', firstName: 'Елена', lastName: 'Новикова' },
  },
  {
    id: 'r4',
    userId: 'u4',
    rating: 3,
    text: 'Нормально, но задержали начало на 20 минут.',
    createdAt: '2026-01-24T19:00:00Z',
    updatedAt: '2026-01-24T19:00:00Z',
    user: { id: 'u4', username: null, firstName: 'Павел', lastName: 'Иванов' },
  },
  {
    id: 'r5',
    userId: 'u5',
    rating: 5,
    text: 'Супер! Уже бронируем на следующий праздник.',
    createdAt: '2026-01-26T14:45:00Z',
    updatedAt: '2026-01-26T14:45:00Z',
    user: { id: 'u5', username: 'music_lover', firstName: 'Катя', lastName: null },
  },
  {
    id: 'r6',
    userId: 'u6',
    rating: 5,
    text: null,
    createdAt: '2026-01-28T09:00:00Z',
    updatedAt: '2026-01-28T09:00:00Z',
    user: { id: 'u6', username: null, firstName: 'Сергей', lastName: 'Козлов' },
  },
];

/** Моки для UI, когда API недоступен или пустой (как в adminBookingService) */
export function getMockReviewsPayload(params?: { page?: number; limit?: number; rating?: number }) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const list = params?.rating ? MOCK_REVIEWS.filter((r) => r.rating === params.rating) : [...MOCK_REVIEWS];
  const start = (page - 1) * limit;
  return {
    reviews: list.slice(start, start + limit),
    total: list.length,
    page,
    limit,
  };
}

export async function getAdminReviews(params?: {
  page?: number;
  limit?: number;
  rating?: number;
}): Promise<{ reviews: AdminReview[]; total: number; page: number; limit: number }> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 200));
    return getMockReviewsPayload(params);
  }
  try {
    const search = new URLSearchParams();
    if (params?.page != null) search.set('page', String(params.page));
    if (params?.limit != null) search.set('limit', String(params.limit));
    if (params?.rating != null) search.set('rating', String(params.rating));
    const q = search.toString();
    const apiData = await apiGet<{ reviews: AdminReview[]; total: number; page: number; limit: number }>(
      q ? `${BASE}?${q}` : BASE
    );
    const reviews = Array.isArray(apiData?.reviews) ? apiData.reviews : [];
    if (reviews.length > 0) {
      return {
        reviews,
        total: apiData.total ?? 0,
        page: apiData.page ?? 1,
        limit: apiData.limit ?? 20,
      };
    }
    return getMockReviewsPayload(params);
  } catch {
    return getMockReviewsPayload(params);
  }
}

export async function deleteAdminReview(id: string): Promise<void> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 150));
    const idx = MOCK_REVIEWS.findIndex((r) => r.id === id);
    if (idx !== -1) MOCK_REVIEWS.splice(idx, 1);
    return;
  }
  await apiDelete<void>(`${BASE}/${id}`);
}
