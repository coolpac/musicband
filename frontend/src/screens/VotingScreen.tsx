import { useState, useEffect } from 'react';
import { Song } from '../types/vote';
import { getSongs } from '../services/songService';
import votingBg from '../assets/figma/voting-bg-only.svg';
import '../styles/voting.css';

type VotingScreenProps = {
  onBack?: () => void;
  onSubmit?: (songId: string) => void;
};

export default function VotingScreen({ onBack, onSubmit }: VotingScreenProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSongs = async () => {
      try {
        const data = await getSongs();
        setSongs(data);
      } catch (error) {
        console.error('Failed to load songs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSongs();
  }, []);

  const handleSongSelect = (songId: string) => {
    setSelectedSongId(songId);
  };

  const handleConfirm = () => {
    if (selectedSongId) {
      onSubmit?.(selectedSongId);
    }
  };

  return (
    <main className="screen screen--voting">
      {onBack && (
        <button className="voting-back-btn" onClick={onBack} type="button">
          Назад
        </button>
      )}
      <div className="voting-hero">
        <img alt="" className="voting-bg-image" src={votingBg} />
      </div>
      <div className="voting-container">
        <h1 className="voting-title">
          Выберите финальную<br />композицию
        </h1>
        {loading ? (
          <div className="voting-loading">Загрузка...</div>
        ) : (
          <div className="voting-songs-list">
          {songs.map((song) => (
            <button
              key={song.id}
              type="button"
              className={`voting-song-card ${selectedSongId === song.id ? 'voting-song-card--selected' : ''}`}
              onClick={() => handleSongSelect(song.id)}
            >
              <div className="voting-song-cover">
                {song.coverUrl ? (
                  <img alt={song.title} className="voting-song-cover-image" src={song.coverUrl} />
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
            </button>
          ))}
        </div>
        )}
        <button
          className="btn btn-primary voting-confirm-btn"
          onClick={handleConfirm}
          type="button"
          disabled={!selectedSongId}
        >
          Подтвердить выбор
        </button>
      </div>
    </main>
  );
}
