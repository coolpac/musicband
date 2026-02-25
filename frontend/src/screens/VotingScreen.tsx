import { motion } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { hapticImpact, hapticSelection } from '../telegram/telegramWebApp';
import { Song } from '../types/vote';
import { getSongs } from '../services/songService';
import { getVoteSessionWithSongs } from '../services/voteService';
import { useApiRequest } from '../hooks/useApiRequest';
import NetworkError from '../components/NetworkError';
import votingBg from '../assets/figma/voting-bg-only.svg';
import { OptimizedImage } from '../components/OptimizedImage';
import { getOptimizedImageProps } from '../types/image';
import '../styles/voting.css';

const SESSION_TIMEOUT_MS = 8000;
const SLOW_LOADING_MS = 5000;

type VotingScreenProps = {
  /** sessionId из URL — загружаем песни через эндпоинт сессии (стабильнее на Android) */
  sessionId?: string | null;
  /** Не используется: навигация назад — кнопка Telegram. */
  onBack?: () => void;
  onSubmit?: (songId: string) => void | Promise<void>;
};

function toSong(s: { id: string; title: string; artist: string; coverUrl: string | null }): Song {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    coverUrl: s.coverUrl ?? undefined,
    isActive: true,
    orderIndex: 0,
  };
}

export default function VotingScreen({ sessionId, onSubmit }: VotingScreenProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { execute } = useApiRequest<Song[]>();
  const mountedRef = useRef(true);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  const loadSongs = useCallback(() => {
    setError(null);
    setLoading(true);
    setSlowLoading(false);
    loadingRef.current = true;
    slowTimerRef.current && clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) setSlowLoading(true);
    }, SLOW_LOADING_MS);

    const fetcher = sessionId
      ? (signal: AbortSignal) =>
          getVoteSessionWithSongs(sessionId, { signal, timeoutMs: SESSION_TIMEOUT_MS }).then((r) => {
            if (r.status !== 'active') return [];
            return r.songs.map(toSong);
          })
      : (signal: AbortSignal) => getSongs({ signal });

    execute(fetcher)
      .then((data) => {
        if (mountedRef.current) setSongs(data);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError' && mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        loadingRef.current = false;
        slowTimerRef.current && clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
        if (mountedRef.current) setLoading(false);
      });
  }, [execute, sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    loadSongs();
    return () => {
      mountedRef.current = false;
      slowTimerRef.current && clearTimeout(slowTimerRef.current);
    };
  }, [loadSongs]);

  const handleSongSelect = (songId: string) => {
    hapticSelection();
    setSelectedSongId(songId);
  };

  const handleConfirm = () => {
    if (!selectedSongId || isSubmitting || !onSubmit) return;
    hapticImpact('medium');
    setIsSubmitting(true);
    Promise.resolve()
      .then(() => onSubmit(selectedSongId))
      .catch(() => undefined)
      .finally(() => setIsSubmitting(false));
  };

  if (error) {
    return (
      <main className="screen screen--voting">
        <div className="voting-hero">
          <img alt="" className="voting-bg-image" src={votingBg} />
        </div>
        <div className="voting-container">
          <NetworkError
            message="Не удалось загрузить список песен."
            onRetry={loadSongs}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="screen screen--voting">
      <div className="voting-hero">
        <img alt="" className="voting-bg-image" src={votingBg} />
      </div>
      <div className="voting-container">
        <h1 className="voting-title">
          Выберите финальную<br />композицию
        </h1>
        {loading ? (
          <div className="voting-loading">
            <span>Загрузка...</span>
            {slowLoading && (
              <button
                type="button"
                className="voting-loading-retry"
                onClick={() => {
                  loadSongs();
                }}
              >
                Медленное соединение. Повторить?
              </button>
            )}
          </div>
        ) : songs.length === 0 ? (
          <div className="voting-empty">
            <p>Список композиций пуст.</p>
            <button type="button" className="btn btn-secondary" onClick={loadSongs}>
              Повторить загрузку
            </button>
          </div>
        ) : (
          <div className="voting-songs-list">
          {songs.map((song, index) => {
            const coverProps = getOptimizedImageProps(song.coverUrl);
            return (
            <motion.button
              key={song.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              type="button"
              className={`voting-song-card ${selectedSongId === song.id ? 'voting-song-card--selected' : ''}`}
              onClick={() => handleSongSelect(song.id)}
            >
              <div className="voting-song-cover">
                {coverProps ? (
                  <OptimizedImage
                    {...coverProps}
                    alt={song.title}
                    className="voting-song-cover-image"
                    loading="lazy"
                    sizes="(max-width: 440px) 100vw, 200px"
                    objectFit="cover"
                  />
                ) : (
                  <div className="voting-song-cover-placeholder"></div>
                )}
              </div>
              <div className="voting-song-info">
                <div className="voting-song-title">{song.title}</div>
                <div className="voting-song-artist">{song.artist}</div>
              </div>
              <div className="voting-song-heart">
                {selectedSongId === song.id ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      fill="white"
                    />
                  </svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      stroke="white"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                )}
              </div>
            </motion.button>
            );
          })}
        </div>
        )}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="btn btn-primary voting-confirm-btn"
          onClick={handleConfirm}
          type="button"
          disabled={!selectedSongId || isSubmitting}
        >
          {isSubmitting ? 'Отправка…' : 'Подтвердить выбор'}
        </motion.button>
      </div>
    </main>
  );
}
