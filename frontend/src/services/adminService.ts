import { apiGet, apiPost, apiPut, apiDelete, isMockMode } from './apiClient';

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
  lyrics?: string;
  isActive?: boolean;
  orderIndex?: number;
};

export type Track = TrackInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

// Mock data
const mockStats: AdminStats = {
  totalBookings: 28,
  confirmedBookings: 3,
  pendingBookings: 24,
  cancelledBookings: 1,
  totalRevenue: 24000,
  conversionRate: 11,
  pendingConfirmation: 24,
};

const mockTracks: Track[] = [
  {
    id: '1',
    title: 'Черный дельфин',
    artist: 'Гио Пика',
    isActive: true,
    orderIndex: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    title: 'Никого не жалко',
    artist: 'Бумер',
    isActive: true,
    orderIndex: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats(): Promise<AdminStats> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockStats;
  }

  try {
    return await apiGet<AdminStats>('/api/admin/stats');
  } catch (error) {
    console.warn('Failed to fetch admin stats, falling back to mock data', error);
    return mockStats;
  }
}

/**
 * Get all tracks (songs)
 */
export async function getTracks(): Promise<Track[]> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockTracks;
  }

  try {
    return await apiGet<Track[]>('/api/admin/tracks');
  } catch (error) {
    console.warn('Failed to fetch tracks, falling back to mock data', error);
    return mockTracks;
  }
}

/**
 * Create a new track
 */
export async function createTrack(data: TrackInput): Promise<Track> {
  if (isMockMode()) {
    console.log('[Mock] Creating track:', data);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newTrack: Track = {
      ...data,
      id: `track-${Date.now()}`,
      isActive: data.isActive ?? false,
      orderIndex: data.orderIndex ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return newTrack;
  }

  try {
    return await apiPost<Track>('/api/admin/tracks', data);
  } catch (error) {
    console.error('Failed to create track:', error);
    throw error;
  }
}

/**
 * Update a track
 */
export async function updateTrack(id: string, data: Partial<TrackInput>): Promise<Track> {
  if (isMockMode()) {
    console.log('[Mock] Updating track:', id, data);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const track = mockTracks.find((t) => t.id === id);
    if (!track) throw new Error('Track not found');

    return {
      ...track,
      ...data,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    return await apiPut<Track>(`/api/admin/tracks/${id}`, data);
  } catch (error) {
    console.error('Failed to update track:', error);
    throw error;
  }
}

/**
 * Delete a track
 */
export async function deleteTrack(id: string): Promise<void> {
  if (isMockMode()) {
    console.log('[Mock] Deleting track:', id);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  try {
    await apiDelete<void>(`/api/admin/tracks/${id}`);
  } catch (error) {
    console.error('Failed to delete track:', error);
    throw error;
  }
}
