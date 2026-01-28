import { useRef, useEffect, useState } from 'react';
import { getSongs } from '../services/songService';
import { getSongLyrics } from '../services/songService';
import { Song } from '../types/vote';
import votingBg from '../assets/figma/voting-bg-only.svg';
import '../styles/lyrics.css';

type LyricsOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  songId?: string;
};

export default function LyricsOverlay({ isOpen, onClose, songId }: LyricsOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLElement>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const ariaLabel = song ? `Текст песни: ${song.title}` : 'Текст песни';

  useEffect(() => {
    const loadData = async () => {
      try {
        const songs = await getSongs();
        const foundSong = songId ? songs.find((s) => s.id === songId) || songs[0] : songs[0];
        setSong(foundSong || null);
        setLines([]);

        if (foundSong) {
          const lyrics = await getSongLyrics(foundSong.id);
          setLines(lyrics);
        }
      } catch (error) {
        console.error('Failed to load song lyrics:', error);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, songId]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isOpen, songId]);

  if (!isOpen) return null;

  return (
    <aside
      ref={overlayRef}
      className="lyrics-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="lyrics-overlay__backdrop" onClick={onClose} aria-hidden />
      <div className="lyrics-overlay__panel">
        <div className="lyrics-overlay__bg" aria-hidden>
          <img alt="" className="lyrics-overlay__bg-image" src={votingBg} />
        </div>
        <div className="lyrics-overlay__handle" aria-hidden />
        <button
          type="button"
          className="lyrics-overlay__close"
          onClick={onClose}
          aria-label="Свернуть"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 9l-6 6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="lyrics-overlay__title">Текст песни</h2>
        {!song ? (
          <div className="lyrics-overlay__loading">Загрузка...</div>
        ) : (
          <>
            <div className="lyrics-overlay__meta">
              <span className="lyrics-overlay__song-name">{song.title}</span>
              <span className="lyrics-overlay__artist">{song.artist}</span>
            </div>
            <div ref={scrollRef} className="lyrics-overlay__scroll" role="article">
              <div className="lyrics-overlay__content">
                {lines.map((line, i) => (
                  <p key={i} className={line === '' ? 'lyrics-line lyrics-line--break' : 'lyrics-line'}>
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
