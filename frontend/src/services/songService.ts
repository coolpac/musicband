import { apiGet, type ApiRequestOptions } from './apiClient';
import { Song } from '../types/vote';

/**
 * Get all songs
 * @param options.signal — для отмены при unmount (useApiRequest)
 */
export async function getSongs(options?: ApiRequestOptions): Promise<Song[]> {
  return apiGet<Song[]>('/api/songs', options);
}

/**
 * Get lyrics for a specific song
 */
export async function getSongLyrics(
  songId: string,
  options?: ApiRequestOptions
): Promise<string[]> {
  const response = await apiGet<{ lyrics: string[] }>(
    `/api/songs/${songId}/lyrics`,
    options
  );
  return response?.lyrics ?? ['Текст песни пока недоступен.'];
}
