import { apiGet, isMockMode } from './apiClient';

export type Partner = {
  id: string;
  name: string;
  logoUrl?: string | null;
  link?: string | null;
};

/** Моки партнёров: изображения — picsum.photos (стабильные URL по seed), названия и ссылки */
const MOCK_PARTNERS: Partner[] = [
  { id: 'mock-1', name: 'Студия звукозаписи', logoUrl: 'https://picsum.photos/seed/partner1/400/300', link: 'https://example.com' },
  { id: 'mock-2', name: 'Event-площадка', logoUrl: 'https://picsum.photos/seed/partner2/400/300', link: 'https://example.com' },
  { id: 'mock-3', name: 'Музыкальная школа', logoUrl: 'https://picsum.photos/seed/partner3/400/300', link: 'https://example.com' },
  { id: 'mock-4', name: 'Продюсерский центр', logoUrl: 'https://picsum.photos/seed/partner4/400/300', link: 'https://example.com' },
  { id: 'mock-5', name: 'Клуб «Живая сцена»', logoUrl: 'https://picsum.photos/seed/partner5/400/300', link: 'https://example.com' },
  { id: 'mock-6', name: 'Лейбл', logoUrl: 'https://picsum.photos/seed/partner6/400/300', link: 'https://example.com' },
];

/**
 * Get all partners (from API or mock)
 */
export async function getPartners(): Promise<Partner[]> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return MOCK_PARTNERS;
  }

  try {
    const res = await apiGet<{ success: boolean; data: Partner[] }>('/api/partners');
    const list = res?.data ?? [];
    if (list.length === 0) return MOCK_PARTNERS;
    return list;
  } catch (error) {
    console.warn('Failed to fetch partners from API, using mocks', error);
    return MOCK_PARTNERS;
  }
}
