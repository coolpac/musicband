import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AnimatePresence } from 'framer-motion';
import { useTelegramWebApp } from './telegram/useTelegramWebApp';
import { hapticImpact, hapticNotification, showAlert, enableClosingConfirmation, disableClosingConfirmation, getTelegramUser, getStartParam, getTelegramUserId } from './telegram/telegramWebApp';
import { setBookingDraftToCloud, clearAllBookingFromCloud } from './telegram/cloudStorage';
import { castVote } from './services/voteService';
import { submitReview } from './services/reviewService';
import HomeScreen from './screens/HomeScreen';
import Header from './components/Header';
import MenuOverlay from './components/MenuOverlay';
import { PageTransition } from './components/PageTransition';
import {
  type BookingDraft,
  NavigationScreen,
  RequestCalendarScreen,
  RequestFormScreen,
  RequestSuccessScreen,
} from './screens/RequestScreens';
import FormatScreen from './screens/FormatScreen';
import FormatDetailScreen from './screens/FormatDetailScreen';
import ReviewFormScreen from './screens/ReviewFormScreen';
import ReviewSuccessScreen from './screens/ReviewSuccessScreen';
import VotingScreen from './screens/VotingScreen';
import VotingResultsScreen from './screens/VotingResultsScreen';
import WinningSongScreen from './screens/WinningSongScreen';
import SongLyricsScreen from './screens/SongLyricsScreen';
import ResidentsScreen from './screens/ResidentsScreen';

type Screen = 'home' | 'nav' | 'calendar' | 'form' | 'success' | 'formats' | 'format-detail' | 'review-form' | 'review-success' | 'voting' | 'voting-results' | 'winning-song' | 'song-lyrics' | 'residents';
type MenuTarget = 'home' | 'formats' | 'live' | 'partners' | 'socials';

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const screenParam = searchParams.get('screen');
  const formatIdParam = searchParams.get('formatId');
  const initialScreen: Screen =
    screenParam === 'home' ||
    screenParam === 'nav' ||
    screenParam === 'calendar' ||
    screenParam === 'form' ||
    screenParam === 'success' ||
    screenParam === 'formats' ||
    screenParam === 'format-detail' ||
    screenParam === 'review-form' ||
    screenParam === 'review-success' ||
    screenParam === 'voting' ||
    screenParam === 'voting-results' ||
    screenParam === 'winning-song' ||
    screenParam === 'song-lyrics'
      ? screenParam
      : 'home';
  const showDebugPanel = import.meta.env.DEV && searchParams.has('debug');

  const [currentScreen, setCurrentScreen] = useState<Screen>(initialScreen);
  const [currentFormatId, setCurrentFormatId] = useState<string | null>(formatIdParam);
  const [votingSessionId, setVotingSessionId] = useState<string | null>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'reconnecting' | 'disconnected' | 'error' | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [liveResults, setLiveResults] = useState<import('./screens/VotingResultsScreen').LiveResultsPayload | null>(null);
  const tg = useTelegramWebApp({ initOnMount: true });

  useEffect(() => {
    if (!tg.isTelegram) return;
    if (currentScreen === 'home') {
      tg.hideBackButton();
      return;
    }
    tg.showBackButton();
    const cleanup = tg.onBackButtonClick(() => {
      hapticImpact('light');
      window.history.back();
    });
    return () => {
      cleanup?.();
      tg.hideBackButton();
    };
  }, [currentScreen, tg.isTelegram, tg.showBackButton, tg.hideBackButton, tg.onBackButtonClick]);

  // Подтверждение закрытия на экране формы заявки — чтобы не потерять данные
  useEffect(() => {
    if (!tg.isTelegram) return;
    if (currentScreen === 'form') {
      enableClosingConfirmation();
      return () => disableClosingConfirmation();
    }
    disableClosingConfirmation();
  }, [currentScreen, tg.isTelegram]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const screenParam = params.get('screen');
      const formatIdParam = params.get('formatId');
      if (
        screenParam === 'home' ||
        screenParam === 'nav' ||
        screenParam === 'calendar' ||
        screenParam === 'form' ||
        screenParam === 'success' ||
        screenParam === 'formats' ||
        screenParam === 'format-detail' ||
        screenParam === 'review-form' ||
        screenParam === 'review-success' ||
        screenParam === 'voting' ||
        screenParam === 'voting-results' ||
        screenParam === 'winning-song' ||
        screenParam === 'song-lyrics' ||
        screenParam === 'residents'
      ) {
        setCurrentScreen(screenParam);
        if (formatIdParam) {
          setCurrentFormatId(formatIdParam);
        } else {
          setCurrentFormatId(null);
        }
      } else {
        setCurrentScreen('home');
        setCurrentFormatId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    // Also listen for custom navigation events
    const handleNavigation = () => handlePopState();
    window.addEventListener('pushstate', handleNavigation);
    handlePopState(); // Initial load

    return () => {
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('pushstate', handleNavigation);
    };
  }, []);

  // Загрузить сессию голосования по sessionId и перейти на нужный экран
  const loadVotingSession = (sessionId: string) => {
    setVotingSessionId(sessionId);

    const base = import.meta.env.VITE_API_URL || '';
    fetch(`${base}/api/public/vote/session/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;

        const { status, winningSong } = data.data;

        if (status === 'active') {
          setCurrentScreen('voting');
          window.history.replaceState({}, '', `?screen=voting&sessionId=${sessionId}`);
        } else if (status === 'ended_with_winner' && winningSong) {
          setCurrentScreen('winning-song');
          window.history.replaceState(
            {},
            '',
            `?screen=winning-song&songId=${winningSong.id}&sessionId=${sessionId}`
          );
        } else {
          setCurrentScreen('home');
        }
      })
      .catch((err) => {
        console.error('Failed to load voting session:', err);
      });
  };

  // Deep link vote_{sessionId}: парсим start_param, URL или pending session из Redis
  useEffect(() => {
    const startParam = getStartParam();
    const urlSessionId = new URLSearchParams(window.location.search).get('sessionId');

    // 1. Проверяем start_param (direct link t.me/bot/app?startapp=vote_SESSION)
    if (startParam && startParam.startsWith('vote_')) {
      const sessionId = startParam.substring(5);
      loadVotingSession(sessionId);
      return;
    }

    // 2. Проверяем URL параметр sessionId
    if (urlSessionId) {
      loadVotingSession(urlSessionId);
      return;
    }

    // 3. Проверяем pending session в Redis (сохраняется ботом при /start vote_SESSION)
    const telegramId = getTelegramUserId();
    if (telegramId) {
      const base = import.meta.env.VITE_API_URL || '';
      fetch(`${base}/api/public/vote/pending/${telegramId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data.sessionId) {
            console.log('Found pending vote session:', data.data.sessionId);
            loadVotingSession(data.data.sessionId);
          }
        })
        .catch((err) => {
          console.error('Failed to check pending vote session:', err);
        });
    }
  }, []);

  // Socket.io: live-обновления результатов и реакция на завершение голосования (только на экранах voting / voting-results)
  useEffect(() => {
    if (currentScreen !== 'voting' && currentScreen !== 'voting-results') {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setSocketStatus(null);
      setLiveResults(null);
      return;
    }

    if (socket?.connected) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const token = localStorage.getItem('auth_token');

    if (!token) {
      console.warn('No auth token for socket connection');
      return;
    }

    const newSocket = io(apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const manager = (newSocket as Socket & { io?: { reconnecting?: boolean; on?: (e: string, fn: () => void) => void } }).io;

    newSocket.on('connect', () => {
      setSocketStatus('connected');
      newSocket.emit('vote:join', { sessionId: votingSessionId || undefined });
    });

    newSocket.on('disconnect', (reason: string) => {
      const reconnecting = manager?.reconnecting === true;
      setSocketStatus(reconnecting ? 'reconnecting' : 'disconnected');
    });

    newSocket.on('connect_error', () => {
      setSocketStatus('error');
    });

    if (manager?.on) {
      manager.on('reconnect_attempt', () => setSocketStatus('reconnecting'));
      manager.on('reconnect', () => setSocketStatus('connected'));
    }

    newSocket.on('vote:results:updated', (data) => {
      setLiveResults(data);
    });

    newSocket.on('vote:session:ended', (data: { winningSong?: { id: string; title: string; artist: string; coverUrl: string | null } }) => {
      const { winningSong } = data;
      if (winningSong) {
        setCurrentScreen('winning-song');
        window.history.pushState({}, '', `?screen=winning-song&songId=${winningSong.id}`);
      }
    });

    setSocket(newSocket);
    setSocketStatus(newSocket.connected ? 'connected' : 'reconnecting');

    return () => {
      newSocket.disconnect();
    };
  }, [currentScreen]);

  const handleRetryConnection = () => {
    if (socket && !socket.connected) {
      setSocketStatus('reconnecting');
      socket.connect();
    }
    setRetryTrigger((t) => t + 1);
  };

  const handleMenuNavigate = (target: MenuTarget) => {
    setMenuOpen(false);
    if (target === 'formats') {
      setCurrentScreen('formats');
      setCurrentFormatId(null);
      window.history.pushState({}, '', '?screen=formats');
      return;
    }
    if (currentScreen !== 'home') {
      setCurrentScreen('home');
    }
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (target === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFormatClick = (formatId: string) => {
    setCurrentFormatId(formatId);
    setCurrentScreen('format-detail');
    window.history.pushState({}, '', `?screen=format-detail&formatId=${formatId}`);
  };

  const handleFormatBack = () => {
    setCurrentScreen('formats');
    setCurrentFormatId(null);
    window.history.pushState({}, '', '?screen=formats');
  };

  const handleRequestPrice = () => {
    setCurrentScreen('form');
    window.history.pushState({}, '', '?screen=form');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'nav':
        return <NavigationScreen />;
      case 'calendar':
        return (
          <RequestCalendarScreen
            onContinue={(draft) => {
              setBookingDraft(draft);
              setBookingDraftToCloud(draft);
              setCurrentScreen('form');
              window.history.pushState({}, '', '?screen=form');
            }}
          />
        );
      case 'form':
        return (
          <RequestFormScreen
            bookingDraft={bookingDraft}
            initialFullName={getTelegramUser()?.fullName}
            onSubmit={() => {
              hapticNotification('success');
              setCurrentScreen('success');
              setBookingDraft(null);
              clearAllBookingFromCloud();
              window.history.pushState({}, '', '?screen=success');
            }}
            onSubmitError={(message) => {
              hapticNotification('error');
              showAlert(message);
            }}
          />
        );
      case 'success':
        return <RequestSuccessScreen onBackHome={() => setCurrentScreen('home')} />;
      case 'formats':
        return (
          <FormatScreen
            onFormatClick={handleFormatClick}
            onBack={() => {
              setCurrentScreen('home');
              window.history.pushState({}, '', '?screen=home');
            }}
          />
        );
      case 'format-detail':
        return currentFormatId ? (
          <FormatDetailScreen
            formatId={currentFormatId}
            onBack={handleFormatBack}
            onRequestPrice={handleRequestPrice}
          />
        ) : (
          <FormatScreen
            onFormatClick={handleFormatClick}
            onBack={handleFormatBack}
          />
        );
      case 'review-form':
        return (
          <ReviewFormScreen
            onBack={() => {
              setCurrentScreen('home');
              window.history.pushState({}, '', '?screen=home');
            }}
            onSubmit={async (rating, text) => {
              try {
                await submitReview({ rating, text });
                hapticNotification('success');
                setCurrentScreen('review-success');
                window.history.pushState({}, '', '?screen=review-success');
              } catch (error) {
                console.error('Failed to submit review:', error);
                hapticNotification('error');
                showAlert('Не удалось отправить отзыв. Попробуйте позже.');
              }
            }}
          />
        );
      case 'review-success':
        return (
          <ReviewSuccessScreen
            onBackHome={() => {
              setCurrentScreen('home');
              window.history.pushState({}, '', '?screen=home');
            }}
          />
        );
      case 'voting':
        return (
          <VotingScreen
            onBack={() => {
              setCurrentScreen('home');
              window.history.pushState({}, '', '?screen=home');
            }}
            onSubmit={async (songId) => {
              try {
                await castVote(songId);
                hapticNotification('success');
                setCurrentScreen('voting-results');
                window.history.pushState({}, '', '?screen=voting-results');
              } catch (error) {
                console.error('Failed to submit vote:', error);
                hapticNotification('error');
              }
            }}
          />
        );
      case 'voting-results':
        return (
          <VotingResultsScreen
            onBack={() => {
              setCurrentScreen('home');
              window.history.pushState({}, '', '?screen=home');
            }}
            onSongClick={(songId) => {
              setCurrentScreen('winning-song');
              window.history.pushState({}, '', `?screen=winning-song&songId=${songId}`);
            }}
            liveResults={liveResults}
            socketStatus={currentScreen === 'voting-results' ? socketStatus : null}
            retryTrigger={retryTrigger}
            onRetryConnection={handleRetryConnection}
          />
        );
      case 'winning-song': {
        const songIdParam = new URLSearchParams(window.location.search).get('songId');
        return (
          <WinningSongScreen
            songId={songIdParam || undefined}
            onBack={() => {
              setCurrentScreen('voting-results');
              window.history.pushState({}, '', '?screen=voting-results');
            }}
            onViewLyrics={() => {
              setCurrentScreen('song-lyrics');
              window.history.pushState({}, '', `?screen=song-lyrics&songId=${songIdParam || ''}`);
            }}
          />
        );
      }
      case 'song-lyrics': {
        const lyricsSongId = new URLSearchParams(window.location.search).get('songId');
        return (
          <SongLyricsScreen
            songId={lyricsSongId || undefined}
            variant="spotify"
            onBack={() => {
              setCurrentScreen('winning-song');
              window.history.pushState({}, '', `?screen=winning-song&songId=${lyricsSongId || ''}`);
            }}
          />
        );
      }
      case 'residents':
        return <ResidentsScreen />;
      default:
        return (
          <HomeScreen
            onMenuOpen={() => setMenuOpen(true)}
            onGoToCalendar={() => {
              setCurrentScreen('calendar');
              window.history.pushState({}, '', '?screen=calendar');
            }}
            onGoToResidents={() => {
              setCurrentScreen('residents');
              window.history.pushState({}, '', '?screen=residents');
            }}
          />
        );
    }
  };

  const showSocketBanner =
    (currentScreen === 'voting' || currentScreen === 'voting-results') &&
    socket != null &&
    socketStatus != null &&
    socketStatus !== 'connected';

  return (
    <div className="app-shell">
      <Header />
      {showSocketBanner && (
        <div className="socket-status-banner" role="status" aria-live="polite">
          {socketStatus === 'reconnecting' ? (
            <>
              <span className="socket-status-banner__spinner" aria-hidden />
              <span className="socket-status-banner__text">Переподключение…</span>
            </>
          ) : (
            <>
              <span className="socket-status-banner__text">Потеряно соединение. Обновить данные?</span>
              <button
                type="button"
                className="socket-status-banner__btn"
                onClick={() => { hapticImpact('light'); handleRetryConnection(); }}
              >
                Обновить
              </button>
            </>
          )}
        </div>
      )}
      
      <AnimatePresence mode="wait">
        <PageTransition key={currentScreen + (currentFormatId || '')} id={currentScreen + (currentFormatId || '')}>
          {renderScreen()}
        </PageTransition>
      </AnimatePresence>

      <MenuOverlay
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />
      {showDebugPanel && (
        <div
          style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            zIndex: 9999,
            display: 'flex',
            gap: '5px',
            flexDirection: 'column',
            background: 'rgba(0,0,0,0.8)',
            padding: '10px',
            borderRadius: '8px',
          }}
        >
          <button
            onClick={() => { hapticImpact('light'); setCurrentScreen('home'); }}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Home
          </button>
          <button
            onClick={() => { hapticImpact('light'); setCurrentScreen('nav'); }}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Nav
          </button>
          <button
            onClick={() => { hapticImpact('light'); setCurrentScreen('calendar'); }}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Calendar
          </button>
          <button
            onClick={() => { hapticImpact('light'); setCurrentScreen('form'); }}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Form
          </button>
          <button
            onClick={() => { hapticImpact('light'); setCurrentScreen('success'); }}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Success
          </button>
        </div>
      )}
    </div>
  );
}
