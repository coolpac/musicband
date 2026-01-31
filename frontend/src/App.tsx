import { useEffect, useState } from 'react';
import { castVote } from './services/voteService';
import { submitReview } from './services/reviewService';
import HomeScreen from './screens/HomeScreen';
import Header from './components/Header';
import MenuOverlay from './components/MenuOverlay';
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
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
              setCurrentScreen('form');
              window.history.pushState({}, '', '?screen=form');
            }}
          />
        );
      case 'form':
        return (
          <RequestFormScreen
            bookingDraft={bookingDraft}
            onSubmit={() => {
              setCurrentScreen('success');
              setBookingDraft(null);
              window.history.pushState({}, '', '?screen=success');
            }}
            onSubmitError={(message) => {
              alert(message);
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
                setCurrentScreen('review-success');
                window.history.pushState({}, '', '?screen=review-success');
              } catch (error) {
                console.error('Failed to submit review:', error);
                alert('Не удалось отправить отзыв. Попробуйте позже.');
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
                // После успешного голосования переходим на экран результатов
                setCurrentScreen('voting-results');
                window.history.pushState({}, '', '?screen=voting-results');
              } catch (error) {
                console.error('Failed to submit vote:', error);
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

  return (
    <div className="app-shell">
      <Header />
      {renderScreen()}
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
            onClick={() => setCurrentScreen('home')}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Home
          </button>
          <button
            onClick={() => setCurrentScreen('nav')}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Nav
          </button>
          <button
            onClick={() => setCurrentScreen('calendar')}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Calendar
          </button>
          <button
            onClick={() => setCurrentScreen('form')}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Form
          </button>
          <button
            onClick={() => setCurrentScreen('success')}
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            Success
          </button>
        </div>
      )}
    </div>
  );
}
