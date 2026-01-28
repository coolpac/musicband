import { apiGet, isMockMode } from './apiClient';

export type Partner = {
  id: string;
  name: string;
  logoUrl?: string | null;
  link?: string | null;
};

/**
 * Get all partners
 */
export async function getPartners(): Promise<Partner[]> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return [];
  }

  try {
    return await apiGet<Partner[]>('/api/partners');
  } catch (error) {
    console.warn('Failed to fetch partners from API, returning empty array', error);
    return [];
  }
}
