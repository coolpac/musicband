import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { hapticImpact } from '../../telegram/telegramWebApp';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import { getTracks, type Track } from '../../services/adminService';
import * as adminVoteService from '../../services/adminVoteService';
import '../../styles/admin.css';
import './VotingManagementScreen.css';

interface VotingSession {
  id: string;
  isActive: boolean;
  startedAt: string;
  endedAt?: string | null;
  totalVotes: number;
}

interface SongWithVotes {
  id: string;
  title: string;
  artist: string;
  voteCount?: number;
  percentage?: number;
}

interface VotingHistoryItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  totalVotes: number;
}

export default function VotingManagementScreen() {
  const [activeSession, setActiveSession] = useState<VotingSession | null>(null);
  const [allSongs, setAllSongs] = useState<Track[]>([]);
  const [liveResults, setLiveResults] = useState<SongWithVotes[]>([]);
  const [history, setHistory] = useState<VotingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showStartModal, setShowStartModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [qrDeepLink, setQrDeepLink] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await loadActiveSession();
      await loadAllSongs();
      await loadHistory();
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Не удалось загрузить данные');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveSession = async () => {
    const session = await adminVoteService.getActiveSession();
    if (session) {
      setActiveSession({
        id: session.id,
        isActive: session.isActive,
        startedAt: session.startedAt,
        endedAt: session.endedAt ?? undefined,
        totalVotes: session.totalVoters,
      });
      await loadLiveResults(session.id);
    } else {
      setActiveSession(null);
      setLiveResults([]);
    }
  };

  const loadAllSongs = async () => {
    const tracks = await getTracks();
    setAllSongs(tracks);
  };

  const loadLiveResults = async (sessionId: string) => {
    const stats = await adminVoteService.getStats(sessionId);
    const results: SongWithVotes[] = (stats.results ?? []).map((r) => ({
      id: r.song?.id ?? '',
      title: r.song?.title ?? '',
      artist: r.song?.artist ?? '',
      voteCount: r.votes,
      percentage: r.percentage,
    })).filter((s) => s.id);
    setLiveResults(results);
    setActiveSession((prev) => (prev && prev.id === sessionId ? { ...prev, totalVotes: stats.totalVotes } : prev));
  };

  const loadHistory = async () => {
    const data = await adminVoteService.getHistory(1, 10);
    setHistory(
      data.sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        totalVotes: s.totalVoters,
      }))
    );
  };

  const handleStartVoting = () => {
    setSelectedSongs(new Set());
    setShowStartModal(true);
  };

  const handleToggleSong = (songId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  const handleConfirmStart = async () => {
    if (selectedSongs.size < 2) {
      toast.error('Выберите минимум 2 песни');
      return;
    }

    try {
      const result = await adminVoteService.startSession(Array.from(selectedSongs));
      toast.success('Голосование запущено!');
      setShowStartModal(false);
      await loadData();
      if (result.qrCode) {
        setQrCodeDataUrl(result.qrCode.dataURL ?? '');
        setQrDeepLink(result.qrCode.deepLink ?? '');
        setShowQRModal(true);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error('Не удалось запустить голосование');
    }
  };

  const handleEndVoting = async () => {
    if (!activeSession) return;

    const confirmed = window.confirm(
      'Вы уверены, что хотите завершить голосование? Это действие нельзя отменить.'
    );

    if (!confirmed) return;

    try {
      await adminVoteService.endSession(activeSession.id);
      toast.success('Голосование завершено');
      await loadData();
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Не удалось завершить голосование');
    }
  };

  const handleShowQR = async () => {
    if (!activeSession) return;

    try {
      const data = await adminVoteService.getSessionQR(activeSession.id);
      setQrCodeDataUrl(data.qrCode?.dataURL ?? '');
      setQrDeepLink(data.qrCode?.deepLink ?? '');
      setShowQRModal(true);
    } catch (error) {
      console.error('Error loading QR:', error);
      toast.error('Не удалось загрузить QR-код');
    }
  };

  const handleDownloadQR = async () => {
    if (!qrCodeDataUrl) return;

    try {
      const res = await fetch(qrCodeDataUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `voting-qr-${activeSession?.id || 'session'}.png`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('QR-код скачан');
    } catch (error) {
      console.error('Error downloading QR:', error);
      toast.error('Не удалось скачать QR-код');
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        /* fallback below */
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  };

  const handleCopyLink = async () => {
    let deepLink = qrDeepLink;
    if (!deepLink && activeSession) {
      try {
        const data = await adminVoteService.getSessionQR(activeSession.id);
        deepLink = data.qrCode?.deepLink ?? '';
      } catch {
        deepLink = '';
      }
    }
    if (!deepLink) {
      toast.error('Не удалось получить ссылку');
      return;
    }
    const ok = await copyToClipboard(deepLink);
    if (ok) {
      toast.success('Ссылка Telegram скопирована');
    } else {
      toast.error('Не удалось скопировать (разрешите доступ к буферу или скопируйте ссылку вручную)');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const durationMs = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
  };

  const formatSessionDateRange = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    const sameDay = endDate && startDate.toDateString() === endDate.toDateString();
    const dateStr = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(startDate);
    const timeStr = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(startDate);
    if (sameDay && endDate) {
      const endTimeStr = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(endDate);
      return { date: dateStr, time: `${timeStr} – ${endTimeStr}` };
    }
    if (endDate) {
      const endStr = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(endDate);
      return { date: dateStr, time: `${timeStr} – ${endStr}` };
    }
    return { date: dateStr, time: timeStr };
  };

  if (isLoading) {
    return (
      <div className="admin-screen">
        <AdminHeader showBack onBack={() => window.history.back()} />
        <div className="admin-content">
          <div className="admin-loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-screen">
      <AdminHeader showBack onBack={() => window.history.back()} />

      <div className="admin-content">
        <h1 className="admin-title">Управление голосованием</h1>

        {/* Активная сессия */}
        {activeSession && activeSession.isActive ? (
          <div className="voting-active-session">
            <div className="admin-card admin-card--success admin-card--large">
              <div className="admin-card__header">
                <h3 className="admin-card__title">
                  <span className="status-dot status-dot--active"></span>
                  Активное голосование
                </h3>
              </div>

              <div className="voting-session-info">
                <div className="voting-info-item">
                  <span className="voting-info-label">Начало:</span>
                  <span className="voting-info-value">{formatDate(activeSession.startedAt)}</span>
                </div>
                <div className="voting-info-item">
                  <span className="voting-info-label">Длительность:</span>
                  <span className="voting-info-value">{formatDuration(activeSession.startedAt)}</span>
                </div>
                <div className="voting-info-item">
                  <span className="voting-info-label">Всего голосов:</span>
                  <span className="voting-info-value voting-info-value--large">{activeSession.totalVotes}</span>
                </div>
              </div>

              <div className="voting-actions">
                <button className="admin-btn admin-btn--secondary" onClick={() => { hapticImpact('light'); handleShowQR(); }}>
                  Показать QR-код
                </button>
                <button className="admin-btn admin-btn--secondary" onClick={() => { hapticImpact('light'); handleCopyLink(); }}>
                  Копировать ссылку
                </button>
                <button className="admin-btn admin-btn--danger" onClick={() => { hapticImpact('light'); handleEndVoting(); }}>
                  Завершить голосование
                </button>
              </div>
            </div>

            {/* Live результаты */}
            {liveResults.length > 0 && (
              <div className="voting-live-results">
                <h3 className="admin-section-title">Live результаты</h3>
                <div className="voting-results-list">
                  {liveResults.map((song) => (
                    <div key={song.id} className="voting-result-item">
                      <div className="voting-result-info">
                        <div className="voting-result-title">{song.title}</div>
                        <div className="voting-result-artist">{song.artist}</div>
                      </div>
                      <div className="voting-result-stats">
                        <div className="voting-result-votes">{song.voteCount} голосов</div>
                        <div className="voting-result-percentage">{song.percentage}%</div>
                      </div>
                      <div className="voting-result-bar">
                        <div
                          className="voting-result-bar-fill"
                          style={{ width: `${song.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="voting-no-session">
            <div className="admin-empty">
              <div className="admin-empty__icon">🗳️</div>
              <h3 className="admin-empty__title">Нет активного голосования</h3>
              <p className="admin-empty__text">Запустите новую сессию голосования</p>
              <button className="admin-btn admin-btn--glass-green" onClick={() => { hapticImpact('light'); handleStartVoting(); }}>
                Запустить голосование
              </button>
            </div>
          </div>
        )}

        {/* История сессий */}
        {history.length > 0 && (
          <section className="voting-history" aria-labelledby="voting-history-title">
            <h3 id="voting-history-title" className="voting-history__title">История сессий</h3>
            <ul className="voting-history-list" role="list">
              {history.map((session) => {
                const { date, time } = formatSessionDateRange(session.startedAt, session.endedAt);
                const duration = formatDuration(session.startedAt, session.endedAt ?? undefined);
                return (
                  <li key={session.id} className="voting-history-item">
                    <div className="voting-history-item__main">
                      <span className="voting-history-item__date">{date}</span>
                      <span className="voting-history-item__time">{time}</span>
                    </div>
                    <div className="voting-history-item__meta">
                      <span className="voting-history-item__votes">{session.totalVotes} голосов</span>
                      <span className="voting-history-item__sep">·</span>
                      <span className="voting-history-item__duration">{duration}</span>
                    </div>
                    <span className="voting-history-item__badge" aria-label="Сессия завершена">
                      Завершено
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Modal запуска голосования */}
      <Modal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        title="Запустить голосование"
        size="lg"
      >
        <div className="voting-start-modal">
          <p className="voting-modal-hint">Выберите песни для голосования (минимум 2):</p>

          <div className="voting-songs-list">
            {allSongs.map((song) => (
              <label key={song.id} className="voting-song-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSongs.has(song.id)}
                  onChange={() => handleToggleSong(song.id)}
                />
                <div className="voting-song-info">
                  <div className="voting-song-title">{song.title}</div>
                  <div className="voting-song-artist">{song.artist}</div>
                </div>
              </label>
            ))}
          </div>

          {selectedSongs.size > 0 && (
            <div className="voting-selected-count">
              Выбрано: {selectedSongs.size} {selectedSongs.size === 1 ? 'песня' : 'песен'}
            </div>
          )}

          <div className="admin-form">
            <button
              className="admin-btn admin-btn--full"
              onClick={() => { hapticImpact('medium'); handleConfirmStart(); }}
              disabled={selectedSongs.size < 2}
            >
              Начать голосование
            </button>
            <button
              className="admin-btn admin-btn--secondary admin-btn--full"
              onClick={() => { hapticImpact('light'); setShowStartModal(false); }}
            >
              Отмена
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal QR-кода */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="QR-код для голосования"
        size="sm"
      >
        <div className="voting-qr-modal">
          {qrCodeDataUrl && (
            <div className="voting-qr-container">
              <img src={qrCodeDataUrl} alt="QR Code" className="voting-qr-image" />
            </div>
          )}

          {qrDeepLink && (
            <div className="voting-qr-url">
              {qrDeepLink}
            </div>
          )}

          <div className="admin-form">
            <button className="admin-btn admin-btn--full" onClick={() => { hapticImpact('light'); handleDownloadQR(); }}>
              Скачать PNG
            </button>
            <button className="admin-btn admin-btn--secondary admin-btn--full" onClick={() => { hapticImpact('light'); handleCopyLink(); }}>
              Копировать ссылку
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
