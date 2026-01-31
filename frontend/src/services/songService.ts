import { apiGet, isMockMode, type ApiRequestOptions } from './apiClient';
import { mockSongs } from '../data/songs';
import { mockLyrics } from '../data/lyrics';
import { Song } from '../types/vote';

/**
 * Get all songs
 * @param options.signal — для отмены при unmount (useApiRequest)
 */
export async function getSongs(options?: ApiRequestOptions): Promise<Song[]> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockSongs;
  }

  return await apiGet<Song[]>('/api/songs', options);
}

/**
 * Get lyrics for a specific song
 */
export async function getSongLyrics(
  songId: string,
  options?: ApiRequestOptions
): Promise<string[]> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockLyrics[songId] ?? ['Текст песни пока недоступен.'];
  }

  const response = await apiGet<{ lyrics: string[] }>(
    `/api/songs/${songId}/lyrics`,
    options
  );
  return response.lyrics;
}
