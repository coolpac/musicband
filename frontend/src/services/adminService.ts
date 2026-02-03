import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

// Types
export type AdminStats = {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  conversionRate: number;
  pendingConfirmation: number;
};

export type TrackInput = {
  title: string;
  artist: string;
  coverUrl?: string;
  artistImageUrl?: string;
  lyrics?: string;
  isActive?: boolean;
  orderIndex?: number;
};

export type Track = TrackInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Get admin dashboard statistics (from bookings API)
 */
export async function getAdminStats(): Promise<AdminStats> {
  const data = await apiGet<{
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    totalIncome: number;
    conversionRate: number;
  }>('/api/admin/bookings/stats');
  return {
    totalBookings: data.total,
    confirmedBookings: data.confirmed,
    pendingBookings: data.pending,
    cancelledBookings: data.cancelled,
    totalRevenue: data.totalIncome ?? 0,
    conversionRate: data.conversionRate ?? 0,
    pendingConfirmation: data.pending,
  };
}

/**
 * Get all tracks (songs)
 */
export async function getTracks(): Promise<Track[]> {
  return apiGet<Track[]>('/api/admin/songs');
}

/**
 * Create a new track
 */
export async function createTrack(data: TrackInput): Promise<Track> {
  return apiPost<Track>('/api/admin/songs', data);
}

/**
 * Update a track
 */
export async function updateTrack(id: string, data: Partial<TrackInput>): Promise<Track> {
  return apiPut<Track>(`/api/admin/songs/${id}`, data);
}

/**
 * Delete a track
 */
export async function deleteTrack(id: string): Promise<void> {
  return apiDelete<void>(`/api/admin/songs/${id}`);
}
