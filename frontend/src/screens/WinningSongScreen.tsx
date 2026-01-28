import { useState, useEffect } from 'react';
import { Song } from '../types/vote';
import { getSongs } from '../services/songService';
import votingBg from '../assets/figma/voting-bg-only.svg';
import LyricsOverlay from '../components/LyricsOverlay';
import '../styles/voting.css';
import '../styles/lyrics.css';

type WinningSongScreenProps = {
  onBack?: () => void;
  onViewLyrics?: () => void;
  songId?: string;
};

export default function WinningSongScreen({ onBack, onViewLyrics, songId }: WinningSongScreenProps) {
  const [winningSong, setWinningSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  useEffect(() => {
    const loadSong = async () => {
      try {
        const songs = await getSongs();
        const song = songId
          ? songs.find((s) => s.id === songId) || songs[0]
          : songs[0];
        setWinningSong(song || null);
      } catch (error) {
        console.error('Failed to load winning song:', error);
      }
    };

    loadSong();
  }, [songId]);

  const handlePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handlePrevious = () => {
    // TODO: Переключить на предыдущий трек
  };

  const handleNext = () => {
    // TODO: Переключить на следующий трек
  };

  return (
    <main className="screen screen--winning-song">
      {onBack && (
        <button className="voting-back-btn" onClick={onBack} type="button">
          Назад
        </button>
      )}
      <div className="voting-hero">
        <img alt="" className="voting-bg-image" src={votingBg} />
      </div>
      <div className="voting-container">
        <h1 className="winning-song-title">Выбранная композиция</h1>

        {!winningSong ? (
          <div className="voting-loading">Загрузка...</div>
        ) : (
          <>
        <div className="winning-song-cover-wrapper">
          <div className="winning-song-cover">
            {winningSong.coverUrl ? (
              <img alt={winningSong.title} className="winning-song-cover-image" src={winningSong.coverUrl} />
            ) : (
              <div className="winning-song-cover-placeholder"></div>
            )}
          </div>
        </div>

        <div className="winning-song-info">
          <div className="winning-song-artist-avatar">
            <div className="winning-song-artist-avatar-placeholder"></div>
          </div>
          <div className="winning-song-text">
            <div className="winning-song-name">{winningSong.title}</div>
            <div className="winning-song-artist-name">{winningSong.artist}</div>
          </div>
        </div>

        <div className="winning-song-player">
          <button
            className="winning-song-control winning-song-control--prev"
            type="button"
            onClick={handlePrevious}
            aria-label="Предыдущий трек"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 6v12L4 12l6-6z" />
              <path d="M18 6v12l-6-6 6-6z" />
              <rect x="20" y="4" width="2" height="16" />
            </svg>
          </button>

          <button
            className="winning-song-control winning-song-control--play"
            type="button"
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
          >
            {isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                <rect x="14" y="4" width="4" height="16" fill="currentColor" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 3l18 9-18 9V3z" fill="currentColor" />
              </svg>
            )}
          </button>

          <button
            className="winning-song-control winning-song-control--next"
            type="button"
            onClick={handleNext}
            aria-label="Следующий трек"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4" width="2" height="16" />
              <path d="M6 6l6 6-6 6V6z" />
              <path d="M14 6l6 6-6 6V6z" />
            </svg>
          </button>
        </div>

        <button
          className="btn btn-primary winning-song-lyrics-btn"
          type="button"
          onClick={() => setLyricsOpen(true)}
        >
          Текст песни
        </button>
        </>
        )}
      </div>

      {winningSong && (
      <LyricsOverlay
        isOpen={lyricsOpen}
        onClose={() => setLyricsOpen(false)}
        songId={songId}
      />
      )}
    </main>
  );
}
