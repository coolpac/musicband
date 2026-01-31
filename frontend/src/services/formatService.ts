import { apiGet, isMockMode } from './apiClient';
import { mockFormats } from '../data/formats';
import { Format } from '../types/format';

/**
 * Get all formats
 */
export async function getFormats(): Promise<Format[]> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockFormats;
  }

  return await apiGet<Format[]>('/api/formats');
}

/**
 * Get formats available for booking (status = 'available').
 * Used in the booking request form for format selection.
 */
export async function getFormatsForBooking(): Promise<Format[]> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockFormats.filter((f) => f.status === 'available');
  }

  return await apiGet<Format[]>('/api/formats/for-booking');
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

  return await apiGet<Format>(`/api/formats/${id}`);
}
