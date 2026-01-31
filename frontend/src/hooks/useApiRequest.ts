import { useCallback, useEffect, useRef } from 'react';

/**
 * Хук для выполнения API-запросов с отменой при unmount и при новом вызове.
 * Возвращает execute(fetcher) — при вызове отменяет предыдущий запрос и выполняет fetcher(signal).
 *
 * @example
 * const { execute } = useApiRequest<Song[]>();
 *
 * useEffect(() => {
 *   execute(async (signal) => getSongs(signal)).then(setSongs).catch((e) => {
 *     if (e.name !== 'AbortError') setError(e);
 *   });
 * }, [execute]);
 */
export function useApiRequest<T>() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(
    async (fetcher: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      return fetcher(controllerRef.current.signal);
    },
    []
  );

  return { execute };
}
