import { apiGet, isMockMode } from './apiClient';
import posterImage from '../assets/figma/poster.png';

export type Poster = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  link?: string | null;
};

// Mock data
const posterMocks: Poster[] = [
  {
    id: 'poster-1',
    title: 'Название афиши',
    description: 'Краткое описание афиши и текст для примера',
    imageUrl: posterImage,
  },
  {
    id: 'poster-2',
    title: 'Большой концерт',
    description: 'Лучшая программа и новые хиты в живом исполнении',
    imageUrl: posterImage,
  },
  {
    id: 'poster-3',
    title: 'Свадебный вечер',
    description: 'Живой звук и персональный сет под ваше событие',
    imageUrl: posterImage,
  },
];

/**
 * Get all posters
 */
export async function getPosters(): Promise<Poster[]> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return posterMocks;
  }

  try {
    return await apiGet<Poster[]>('/api/posters');
  } catch (error) {
    console.warn('Failed to fetch posters from API, falling back to mock data', error);
    return posterMocks;
  }
}
