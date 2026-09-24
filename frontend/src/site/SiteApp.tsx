import { useEffect, useRef } from 'react';
import type { SiteData } from './content/types';
import { SiteDataProvider, useSiteData } from './content/SiteDataContext';
import { RouterProvider, useRouter } from './router/Router';
import type { RouteId } from './router/routes';
import { buildPageMeta, legalPageExists } from './seo/meta';
import { applyHead } from './seo/head';
import { trackPageView } from './seo/analytics';
import { initReveal } from './motion/reveal';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/HomePage';
import { LegalPage } from './pages/LegalPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BookingDatePage } from './booking/BookingDatePage';
import { BookingFormPage } from './booking/BookingFormPage';
import { BookingSuccessPage } from './booking/BookingSuccessPage';
import './styles/tokens.css';
import './styles/base.css';

function Page({ route, data }: { route: RouteId; data: SiteData }) {
  if (!legalPageExists(route, data)) return <NotFoundPage />;
  switch (route) {
    case 'home':
      return <HomePage />;
    case 'booking':
      return <BookingDatePage />;
    case 'bookingForm':
      return <BookingFormPage />;
    case 'bookingSuccess':
      return <BookingSuccessPage />;
    case 'privacy':
    case 'terms':
    case 'offer':
      return <LegalPage doc={route} />;
    default:
      return <NotFoundPage />;
  }
}

function Shell() {
  const { route } = useRouter();
  const data = useSiteData();
  const rootRef = useRef<HTMLDivElement>(null);
  const firstHead = useRef(true);

  // The server already rendered the correct <head>; only later navigations / data upgrades touch it.
  useEffect(() => {
    if (firstHead.current) {
      firstHead.current = false;
      return;
    }
    const meta = buildPageMeta(route, data);
    applyHead(meta);
  }, [route, data]);

  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false; // the initial hit is sent by initAnalytics
      return;
    }
    trackPageView(window.location.href, document.title);
  }, [route]);

  useEffect(() => (rootRef.current ? initReveal(rootRef.current) : undefined), []);

  return (
    <div className="site-shell" ref={rootRef}>
      <a className="site-skip-link" href="#main">
        Перейти к содержимому
      </a>
      <Header />
      <main id="main" className="site-main" tabIndex={-1}>
        <Page route={route} data={data} />
      </main>
      <Footer />
    </div>
  );
}

interface SiteAppProps {
  /** Request URL on the server, window.location on the client. */
  url: string;
  data: SiteData;
}

export function SiteApp({ url, data }: SiteAppProps) {
  return (
    <RouterProvider initialUrl={url}>
      <SiteDataProvider initial={data}>
        <Shell />
      </SiteDataProvider>
    </RouterProvider>
  );
}
