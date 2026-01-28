import { apiGet, isMockMode } from './apiClient';
import { mockFormats } from '../data/formats';
import { Format } from '../types/format';

/**
 * Get all formats
 */
export async function getFormats(): Promise<Format[]> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockFormats;
  }

  try {
    return await apiGet<Format[]>('/api/formats');
  } catch (error) {
    console.warn('Failed to fetch formats from API, falling back to mock data', error);
    return mockFormats;
  }
}

/**
 * Get a specific format by ID
 */
export async function getFormatById(id: string): Promise<Format | undefined> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockFormats.find((f) => f.id === id);
  }

  try {
    return await apiGet<Format>(`/api/formats/${id}`);
  } catch (error) {
    console.warn(`Failed to fetch format ${id} from API, falling back to mock data`, error);
    return mockFormats.find((f) => f.id === id);
  }
}
