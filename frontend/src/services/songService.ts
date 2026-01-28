import { apiGet, isMockMode } from './apiClient';
import { mockSongs } from '../data/songs';
import { mockLyrics } from '../data/lyrics';
import { Song } from '../types/vote';

/**
 * Get all songs
 */
export async function getSongs(): Promise<Song[]> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockSongs;
  }

  try {
    return await apiGet<Song[]>('/api/songs');
  } catch (error) {
    console.warn('Failed to fetch songs from API, falling back to mock data', error);
    return mockSongs;
  }
}

/**
 * Get lyrics for a specific song
 */
export async function getSongLyrics(songId: string): Promise<string[]> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockLyrics[songId] ?? ['Текст песни пока недоступен.'];
  }

  try {
    const response = await apiGet<{ lyrics: string[] }>(`/api/songs/${songId}/lyrics`);
    return response.lyrics;
  } catch (error) {
    console.warn(`Failed to fetch lyrics for song ${songId}, falling back to mock data`, error);
    return mockLyrics[songId] ?? ['Текст песни пока недоступен.'];
  }
}
