import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AnimatePresence } from 'framer-motion';
import { useTelegramWebApp } from './telegram/useTelegramWebApp';
import { hapticImpact, hapticNotification, showAlert, enableClosingConfirmation, disableClosingConfirmation, getTelegramUser, getStartParam, getTelegramUserId, getInitData } from './telegram/telegramWebApp';
import { setBookingDraftToCloud, clearAllBookingFromCloud } from './telegram/cloudStorage';
import { useVoteSubmit } from './hooks/useVoteSubmit';
import { submitReview } from './services/reviewService';
import { apiPost } from './services/apiClient';
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
type MenuTarget = 'home' | 'formats' | 'live' | 'promo' | 'partners' | 'socials';

export default function App() {
  const HOME_SCROLL_KEY = 'homeScrollY';
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
  const [votingSessionEnded, setVotingSessionEnded] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    localStorage.getItem('auth_token') || localStorage.getItem('admin_token')
  );
  const tg = useTelegramWebApp({ initOnMount: true });
  const currentScreenRef = useRef<Screen>(initialScreen);
  const handleVoteSubmit = useVoteSubmit({
    authToken,
    votingSessionId,
    setAuthToken,
    setCurrentScreen,
  });

  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  const getPageScrollTop = () =>
    Math.max(
      window.scrollY || 0,
      document.documentElement?.scrollTop || 0,
      document.body?.scrollTop || 0
    );

  const saveHomeScroll = () => {
    try {
      sessionStorage.setItem(HOME_SCROLL_KEY, String(getPageScrollTop()));
    } catch {
      /* ignore storage errors */
    }
  };

  const restoreSavedHomeScroll = (): boolean => {
    try {
      const raw = sessionStorage.getItem(HOME_SCROLL_KEY);
      if (!raw) return false;
      const target = parseInt(raw, 10);
      if (!Number.isFinite(target) || target < 0) return false;

      const RETRY_DELAYS_MS = [0, 40, 120, 260, 480, 760, 1100];
      const attemptRestore = (attempt: number) => {
        const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const clampedTop = Math.min(target, maxTop);
        window.scrollTo({ top: clampedTop, behavior: 'auto' });

        const currentTop = getPageScrollTop();
        const reachedTarget = Math.abs(currentTop - clampedTop) <= 2;
        const canReachOriginalTarget = maxTop + 2 >= target;
        const isLastAttempt = attempt >= RETRY_DELAYS_MS.length - 1;

        if ((reachedTarget && canReachOriginalTarget) || isLastAttempt) {
          sessionStorage.removeItem(HOME_SCROLL_KEY);
          return;
        }

        window.setTimeout(() => attemptRestore(attempt + 1), RETRY_DELAYS_MS[attempt + 1]);
      };

      requestAnimationFrame(() => attemptRestore(0));
      return true;
    } catch {
      return false;
    }
  };

  const goHomeFromFormats = (historyMode: 'push' | 'replace' = 'push') => {
    setCurrentScreen('home');
    setCurrentFormatId(null);
    if (historyMode === 'replace') {
      window.history.replaceState({}, '', '?screen=home');
    } else {
      window.history.pushState({}, '', '?screen=home');
    }
    requestAnimationFrame(() => {
      const restored = restoreSavedHomeScroll();
      if (!restored) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    });
  };

  // Авторизация Mini App через Telegram initData → JWT (cookie + localStorage для сокетов)
  // initData может быть пустой при первом рендере — на Android особенно часто (WebView асинхронно)
  useEffect(() => {
    if (!tg.isTelegram) return;
    if (authToken) return;

    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 12; // Android: до ~10 сек ожидания
    const RETRY_DELAY = 800; // ms

    const tryAuth = () => {
      if (cancelled) return;
      attempt++;

      const initData = getInitData();
      if (!initData) {
        if (attempt < MAX_ATTEMPTS) {
          if (import.meta.env.DEV) console.warn(`Telegram initData empty, retry ${attempt}/${MAX_ATTEMPTS}`);
          setTimeout(tryAuth, RETRY_DELAY);
        }
        return;
      }

      apiPost<{ user: unknown; token: string; startParam?: string }>('/api/auth/telegram', {
        initData,
        startParam: getStartParam(),
      })
        .then((data) => {
          if (!cancelled && data?.token) {
            localStorage.setItem('auth_token', data.token);
            setAuthToken(data.token);
          }
        })
        .catch((error) => {
          console.error('Telegram auth failed:', error);
        });
    };

    tryAuth();

    return () => {
      cancelled = true;
    };
  }, [tg.isTelegram, authToken]);

  // Кнопка «Назад»: при открытом меню — закрываем меню; иначе — навигация по экранам.
  // Иначе в Telegram при нажатии «Назад» в меню закрывается всё приложение.
  useEffect(() => {
    if (!tg.isTelegram) return;
    if (menuOpen) {
      tg.showBackButton();
      const cleanup = tg.onBackButtonClick(() => {
        hapticImpact('light');
        setMenuOpen(false);
      });
      return () => {
        cleanup?.();
        tg.hideBackButton();
      };
    }
    if (currentScreen === 'home') {
      tg.hideBackButton();
      return;
    }
    tg.showBackButton();
    const cleanup = tg.onBackButtonClick(() => {
      hapticImpact('light');
      if (currentScreen === 'format-detail') {
        setCurrentScreen('formats');
        setCurrentFormatId(null);
        window.history.replaceState({}, '', '?screen=formats');
      } else if (currentScreen === 'formats') {
        goHomeFromFormats('replace');
      } else if (currentScreen === 'form') {
        setCurrentScreen('calendar');
        window.history.replaceState({}, '', '?screen=calendar');
      } else {
        setCurrentScreen('home');
        window.history.replaceState({}, '', '?screen=home');
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      }
    });
    return () => {
      cleanup?.();
      tg.hideBackButton();
    };
  }, [currentScreen, menuOpen, tg.isTelegram, tg.showBackButton, tg.hideBackButton, tg.onBackButtonClick]);

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
        // При возврате из форматов восстанавливаем сохранённый скролл home.
        if (screenParam === 'home' || !screenParam) {
          requestAnimationFrame(() => {
            const fromScreen = currentScreenRef.current;
            if (fromScreen === 'formats' || fromScreen === 'format-detail') {
              const restored = restoreSavedHomeScroll();
              if (!restored) window.scrollTo({ top: 0, behavior: 'auto' });
            } else {
              window.scrollTo({ top: 0, behavior: 'auto' });
            }
          });
        }
      } else {
        setCurrentScreen('home');
        setCurrentFormatId(null);
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
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

  /** Загрузить сессию и перейти на нужный экран. fromScreen: не переключать на voting, если уже смотрим результаты. */
  const loadVotingSession = (sessionId: string, fromScreen?: 'voting' | 'voting-results') => {
    setVotingSessionId(sessionId);
    setVotingSessionEnded(false);

    const base = import.meta.env.VITE_API_URL || '';
    fetch(`${base}/api/public/vote/session/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          console.warn('Vote session not found or error:', data);
          return;
        }

        const { status, winningSong } = data.data;
        if (import.meta.env.DEV) console.log('Vote session loaded:', { sessionId, status, winningSong });

        if (status === 'active') {
          // Уже на voting-results (после голоса) — не переключать на форму
          if (fromScreen !== 'voting-results') {
            setCurrentScreen('voting');
            window.history.replaceState({}, '', `?screen=voting&sessionId=${sessionId}`);
          }
        } else if (status === 'ended_with_winner' && winningSong) {
          setCurrentScreen('winning-song');
          window.history.replaceState(
            {},
            '',
            `?screen=winning-song&songId=${winningSong.id}&sessionId=${sessionId}`
          );
        } else if (status === 'ended') {
          setCurrentScreen('voting-results');
          window.history.replaceState({}, '', `?screen=voting-results&sessionId=${sessionId}`);
        } else if (status === 'expired') {
          setCurrentScreen('home');
          window.history.replaceState({}, '', '?screen=home');
        }
      })
      .catch((err) => {
        console.error('Failed to load voting session:', err);
      });
  };

  // Deep link vote_{sessionId}: парсим start_param, URL или pending session из Redis
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const startParam = getStartParam();
    const urlSessionId = params.get('sessionId');
    const urlScreen = params.get('screen');

    // voting-results + sessionId: проверяем статус — если завершено, редирект на победителя
    if (urlSessionId && urlScreen === 'voting-results') {
      setVotingSessionId(urlSessionId);
      loadVotingSession(urlSessionId, 'voting-results');
      return;
    }
    if (urlSessionId && urlScreen === 'voting') {
      setVotingSessionId(urlSessionId);
      loadVotingSession(urlSessionId);
      return;
    }

    // 1. Проверяем start_param (direct link t.me/bot/app?startapp=vote_SESSION)
    if (startParam && startParam.startsWith('vote_')) {
      const sessionId = startParam.substring(5);
      if (import.meta.env.DEV) console.log('Found vote session in start_param:', sessionId);
      loadVotingSession(sessionId);
      return;
    }

    // 2. Проверяем URL параметр sessionId (если screen не voting — нужно загрузить сессию)
    if (urlSessionId && urlScreen !== 'voting') {
      if (import.meta.env.DEV) console.log('Found sessionId in URL, loading session:', urlSessionId);
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
            if (import.meta.env.DEV) console.log('Found pending vote session:', data.data.sessionId);
            loadVotingSession(data.data.sessionId);
          }
        })
        .catch((err) => {
          console.error('Failed to check pending vote session:', err);
        });
    }
  }, []);

  // Ref для votingSessionId — чтобы не переподключать сокет при смене sessionId
  const votingSessionIdRef = useRef(votingSessionId);
  votingSessionIdRef.current = votingSessionId;

  // При смене votingSessionId — только перевходим в комнату, БЕЗ пересоздания сокета
  useEffect(() => {
    if (socket?.connected && votingSessionId) {
      socket.emit('vote:join', { sessionId: votingSessionId });
    }
  }, [votingSessionId, socket]);

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

    // Если сокет уже подключен — не пересоздаём
    if (socket?.connected) {
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const token = authToken;

    if (!token) {
      console.warn('No auth token for socket connection');
      return;
    }

    // На всякий случай: если есть старый объект сокета — закрываем
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }

    const newSocket = io(apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const manager = (newSocket as Socket & { io?: { reconnecting?: boolean; on?: (e: string, fn: () => void) => void } }).io;

    newSocket.on('connect', () => {
      setSocketStatus('connected');
      newSocket.emit('vote:join', { sessionId: votingSessionIdRef.current || undefined });
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

    newSocket.on('vote:session:ended', (data: { winningSong?: { id: string; title: string; artist: string; coverUrl: string | null }; sessionId?: string }) => {
      const { winningSong, sessionId: evtSessionId } = data;
      setVotingSessionEnded(true);
      if (winningSong) {
        setCurrentScreen('winning-song');
        const sid = evtSessionId || votingSessionIdRef.current || new URLSearchParams(window.location.search).get('sessionId');
        window.history.replaceState({}, '', sid ? `?screen=winning-song&songId=${winningSong.id}&sessionId=${sid}` : `?screen=winning-song&songId=${winningSong.id}`);
      }
    });

    setSocket(newSocket);
    setSocketStatus(newSocket.connected ? 'connected' : 'reconnecting');

    return () => {
      newSocket.disconnect();
    };
  }, [currentScreen, authToken]);

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
      if (currentScreen === 'home') {
        saveHomeScroll();
      }
      setCurrentScreen('formats');
      setCurrentFormatId(null);
      window.history.pushState({}, '', '?screen=formats');
      return;
    }
    if (currentScreen !== 'home') {
      setCurrentScreen('home');
      window.history.pushState({}, '', '?screen=home');
    }
    // Задержка скролла пока overlay меню закрывается (CSS transition 450ms).
    // Без задержки scrollIntoView конфликтует с transition и позиция съезжает.
    const MENU_CLOSE_DELAY = 460;
    const scrollToTarget = () => {
      if (target === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const el = document.getElementById(target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    setTimeout(scrollToTarget, MENU_CLOSE_DELAY);
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
              goHomeFromFormats('push');
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
            sessionId={votingSessionId || new URLSearchParams(window.location.search).get('sessionId')}
            onBack={() => {
              setCurrentScreen('home');
              window.history.pushState({}, '', '?screen=home');
            }}
            onSubmit={handleVoteSubmit}
            onSessionNotActive={() => {
              const sid = votingSessionId || new URLSearchParams(window.location.search).get('sessionId');
              if (sid) {
                loadVotingSession(sid);
              } else {
                setCurrentScreen('home');
                window.history.replaceState({}, '', '?screen=home');
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
              const sid = votingSessionId || new URLSearchParams(window.location.search).get('sessionId');
              window.history.pushState({}, '', sid ? `?screen=winning-song&songId=${songId}&sessionId=${sid}` : `?screen=winning-song&songId=${songId}`);
            }}
            onSessionEnded={(winningSongId) => {
              setVotingSessionEnded(true);
              setCurrentScreen('winning-song');
              const sid = votingSessionId || new URLSearchParams(window.location.search).get('sessionId');
              window.history.replaceState({}, '', sid ? `?screen=winning-song&songId=${winningSongId}&sessionId=${sid}` : `?screen=winning-song&songId=${winningSongId}`);
            }}
            onSessionExpired={() => {
              setCurrentScreen('home');
              window.history.replaceState({}, '', '?screen=home');
            }}
            liveResults={liveResults}
            socketStatus={currentScreen === 'voting-results' ? socketStatus : null}
            retryTrigger={retryTrigger}
            onRetryConnection={handleRetryConnection}
            sessionEnded={votingSessionEnded}
            sessionId={votingSessionId}
          />
        );
      case 'winning-song': {
        const songIdParam = new URLSearchParams(window.location.search).get('songId');
        return (
          <WinningSongScreen
            songId={songIdParam || undefined}
            onBack={() => {
              setCurrentScreen('voting-results');
              const sid = new URLSearchParams(window.location.search).get('sessionId') || votingSessionId;
              const qs = sid ? `?screen=voting-results&sessionId=${sid}` : '?screen=voting-results';
              window.history.pushState({}, '', qs);
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
            onGoToFormats={() => {
              saveHomeScroll();
              setCurrentScreen('formats');
              setCurrentFormatId(null);
              window.history.pushState({}, '', '?screen=formats');
            }}
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
      
      <AnimatePresence mode="wait" initial={false}>
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
