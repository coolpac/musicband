/**
 * Admin API for formats (requires admin auth via cookie/credentials).
 * Status: 'available' = показывать в бронировании, 'hidden' = скрыт.
 */

import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';

export type AdminFormatStatus = 'available' | 'hidden';

export type AdminFormat = {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  suitableFor: unknown;
  performers: unknown;
  status: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminFormatCreate = {
  name: string;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  suitableFor?: unknown;
  performers?: unknown;
  status?: AdminFormatStatus;
  order?: number;
};

export type AdminFormatUpdate = Partial<AdminFormatCreate>;

const BASE = '/api/admin/formats';

export async function getAdminFormats(): Promise<AdminFormat[]> {
  return apiGet<AdminFormat[]>(BASE);
}

export async function createAdminFormat(data: AdminFormatCreate): Promise<AdminFormat> {
  return apiPost<AdminFormat>(BASE, data);
}

export async function updateAdminFormat(id: string, data: AdminFormatUpdate): Promise<AdminFormat> {
  return apiPut<AdminFormat>(`${BASE}/${id}`, data);
}

export async function deleteAdminFormat(id: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${id}`);
}
