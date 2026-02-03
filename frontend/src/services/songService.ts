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
  // Проверяем, что response существует и содержит lyrics
  if (response && typeof response === 'object' && 'lyrics' in response) {
    return Array.isArray(response.lyrics) ? response.lyrics : ['Текст песни пока недоступен.'];
  }
  return ['Текст песни пока недоступен.'];
}
