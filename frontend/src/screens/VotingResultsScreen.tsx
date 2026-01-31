import { useState, useEffect, useCallback } from 'react';
import { Song } from '../types/vote';
import { getSongs } from '../services/songService';
import { getVoteResults, VoteResult } from '../services/voteService';
import NetworkError from '../components/NetworkError';
import votingBg from '../assets/figma/voting-bg-only.svg';
import { OptimizedImage } from '../components/OptimizedImage';
import { getOptimizedImageProps } from '../types/image';
import '../styles/voting.css';

type VotingResultsScreenProps = {
  onBack?: () => void;
  onSongClick?: (songId: string) => void;
};

export default function VotingResultsScreen({ onBack, onSongClick }: VotingResultsScreenProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [songsData, resultsData] = await Promise.all([
          getSongs(),
          getVoteResults(),
        ]);
        setSongs(songsData);
        setResults(resultsData);
      } catch (error) {
        console.error('Failed to load voting results:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getSongPercentage = (songId: string) => {
    const result = results.find((r) => r.songId === songId);
    return result?.percentage || 0;
  };

  // Сортируем песни по проценту голосов (от большего к меньшему)
  const sortedSongs = [...songs].sort((a, b) => {
    const aPercent = getSongPercentage(a.id);
    const bPercent = getSongPercentage(b.id);
    return bPercent - aPercent;
  });

  if (error) {
    return (
      <main className="screen screen--voting-results">
        {onBack && (
          <button className="voting-back-btn" onClick={onBack} type="button">
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
        <button className="voting-back-btn" onClick={onBack} type="button">
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
                onClick={() => onSongClick?.(song.id)}
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
                  <div className="voting-result-percentage">{percentage}%</div>
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
