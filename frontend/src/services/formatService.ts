import { apiGet, type ApiRequestOptions } from './apiClient';
import { Format } from '../types/format';

/**
 * Get all formats
 */
export async function getFormats(options?: ApiRequestOptions): Promise<Format[]> {
  return apiGet<Format[]>('/api/formats', options);
}

/**
 * Get formats available for booking (status = 'available').
 * Used in the booking request form for format selection.
 */
export async function getFormatsForBooking(options?: ApiRequestOptions): Promise<Format[]> {
  return apiGet<Format[]>('/api/formats/for-booking', options);
}

/**
 * Get a specific format by ID (resolved from full list; backend has no single-format endpoint).
 */
export async function getFormatById(id: string, options?: ApiRequestOptions): Promise<Format | undefined> {
  const formats = await apiGet<Format[]>('/api/formats', options);
  return formats.find((f) => f.id === id);
}


