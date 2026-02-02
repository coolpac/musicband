import { useState, useEffect, useCallback } from 'react';
import { hapticImpact } from '../telegram/telegramWebApp';
import { Song } from '../types/vote';
import { getSongs } from '../services/songService';
import { getVoteResults, VoteResult } from '../services/voteService';
import NetworkError from '../components/NetworkError';
import votingBg from '../assets/figma/voting-bg-only.svg';
import { OptimizedImage } from '../components/OptimizedImage';
import { getOptimizedImageProps } from '../types/image';
import '../styles/voting.css';

export type LiveResultsPayload = {
  sessionId?: string;
  songs?: Array<{
    song: { id: string; title: string; artist: string; coverUrl: string | null };
    votes: number;
    percentage: number;
  }>;
  totalVotes?: number;
};

type VotingResultsScreenProps = {
  onBack?: () => void;
  onSongClick?: (songId: string) => void;
  liveResults?: LiveResultsPayload | null;
  socketStatus?: 'connected' | 'reconnecting' | 'disconnected' | 'error' | null;
  retryTrigger?: number;
  onRetryConnection?: () => void;
};

export default function VotingResultsScreen({
  onBack,
  onSongClick,
  liveResults,
  socketStatus,
  retryTrigger = 0,
  onRetryConnection,
}: VotingResultsScreenProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [songsData, resultsData] = await Promise.all([
        getSongs(),
        getVoteResults(),
      ]);
      setSongs(songsData);
      setResults(resultsData);
    } catch (err) {
      console.error('Failed to load voting results:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // Если данные уже пришли по сокету (liveResults), не дергаем API — показываем их сразу
  useEffect(() => {
    if (liveResults?.songs?.length) {
      setLoading(false);
      return;
    }
    loadData();
  }, [loadData, liveResults?.songs?.length]);

  // По кнопке «Обновить» в баннере — перезапросить результаты с API
  useEffect(() => {
    if (retryTrigger > 0) loadData();
  }, [retryTrigger, loadData]);

  const getSongPercentage = (songId: string) => {
    if (liveResults?.songs) {
      const item = liveResults.songs.find((s) => s.song.id === songId);
      return item?.percentage ?? 0;
    }
    const result = results.find((r) => r.songId === songId);
    return result?.percentage || 0;
  };

  // При liveResults используем данные из сокета (уже отсортированы по percentage); иначе — из API
  const sortedSongs: Song[] = liveResults?.songs?.length
    ? [...liveResults.songs]
        .sort((a, b) => b.percentage - a.percentage)
        .map((item) => ({
          id: item.song.id,
          title: item.song.title,
          artist: item.song.artist,
          coverUrl: item.song.coverUrl ?? undefined,
          isActive: true,
          orderIndex: 0,
        }))
    : [...songs].sort((a, b) => {
        const aPercent = getSongPercentage(a.id);
        const bPercent = getSongPercentage(b.id);
        return bPercent - aPercent;
      });

  if (error) {
    return (
      <main className="screen screen--voting-results">
        {onBack && (
          <button className="voting-back-btn" onClick={() => { hapticImpact('light'); onBack(); }} type="button">
            Назад
          </button>
        )}
        <div className="voting-hero">
          <img alt="" className="voting-bg-image" src={votingBg} />
        </div>
        <div className="voting-container">
          <NetworkError
            message="Не удалось загрузить результаты голосования."
            onRetry={loadData}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="screen screen--voting-results">
      {onBack && (
        <button className="voting-back-btn" onClick={() => { hapticImpact('light'); onBack(); }} type="button">
          Назад
        </button>
      )}
      <div className="voting-hero">
        <img alt="" className="voting-bg-image" src={votingBg} />
      </div>
      <div className="voting-container">
        <h1 className="voting-results-title">Результаты голосования</h1>
        {loading ? (
          <div className="voting-loading">Загрузка...</div>
        ) : (
          <div className="voting-results-list">
          {sortedSongs.map((song, index) => {
            const percentage = getSongPercentage(song.id);
            const coverProps = getOptimizedImageProps(song.coverUrl);
            return (
              <button
                key={song.id}
                type="button"
                className="voting-result-card voting-result-card--clickable"
                style={{ animationDelay: `${index * 0.06}s` }}
                onClick={() => { hapticImpact('light'); onSongClick?.(song.id); }}
              >
                <div className="voting-result-progress" style={{ width: `${percentage}%` }}></div>
                <div className="voting-result-content">
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
                  <div className="voting-result-percentage">
                    <span key={percentage} className="voting-result-percentage-value">
                      {percentage}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        )}
      </div>
    </main>
  );
}
