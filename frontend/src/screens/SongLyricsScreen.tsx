import { useRef, useEffect, useState } from 'react';
import { getSongs } from '../services/songService';
import { getSongLyrics } from '../services/songService';
import { Song } from '../types/vote';
import votingBg from '../assets/figma/voting-bg-only.svg';
import '../styles/voting.css';
import '../styles/lyrics.css';

type SongLyricsScreenProps = {
  onBack?: () => void;
  songId?: string;
  /** 'figma' — как в макете: заголовок, текст слева. 'spotify' — центрированный, крупнее, в духе Spotify */
  variant?: 'figma' | 'spotify';
};

export default function SongLyricsScreen({ onBack, songId, variant = 'spotify' }: SongLyricsScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const songs = await getSongs();
        const foundSong = songId ? songs.find((s) => s.id === songId) || songs[0] : songs[0];
        setSong(foundSong || null);

        if (foundSong) {
          const lyrics = await getSongLyrics(foundSong.id);
          setLines(lyrics);
        }
      } catch (error) {
        console.error('Failed to load song lyrics:', error);
      }
    };

    loadData();
  }, [songId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [songId]);

  const isSpotify = variant === 'spotify';

  return (
    <main className={`screen screen--lyrics screen--lyrics-${variant}`}>
      {onBack && (
        <button className="voting-back-btn" onClick={onBack} type="button">
          Назад
        </button>
      )}
      <div className="voting-hero">
        <img alt="" className="voting-bg-image" src={votingBg} />
      </div>
      <div className="lyrics-container">
        <h1 className="lyrics-title">Текст песни</h1>
        {!song ? (
          <div className="voting-loading">Загрузка...</div>
        ) : (
          <>
        <div className="lyrics-meta">
          <span className="lyrics-song-name">{song.title}</span>
          <span className="lyrics-artist-name">{song.artist}</span>
        </div>
        <div
          ref={scrollRef}
          className={`lyrics-scroll ${isSpotify ? 'lyrics-scroll--spotify' : 'lyrics-scroll--figma'}`}
          role="article"
          aria-label={`Текст песни: ${song.title}`}
        >
          <div className="lyrics-content">
            {lines.map((line, i) => (
              <p
                key={i}
                className={line === '' ? 'lyrics-line lyrics-line--break' : 'lyrics-line'}
              >
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </main>
  );
}
