import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { SiteApp } from './SiteApp';
import type { SiteData } from './content/types';
import { resolveSiteData } from './content/resolve';
import { initAnalytics } from './seo/analytics';

declare global {
  interface Window {
    __SITE_DATA__?: SiteData;
    /** Read by the inline failsafe in site.html: if it never flips, reveal gating is switched off. */
    __SITE_BOOTED__?: boolean;
  }
}

const container = document.getElementById('site-root');

if (container) {
  // Must be byte-identical to what the server rendered with, or hydration would mismatch.
  const data = window.__SITE_DATA__ ?? resolveSiteData(null);
  const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const app = (
    <StrictMode>
      <SiteApp url={url} data={data} />
    </StrictMode>
  );

  if (container.firstElementChild) {
    hydrateRoot(container, app, {
      onRecoverableError(error) {
        // A hydration mismatch is a bug worth seeing in dev, never worth breaking the page for.
        if (import.meta.env.DEV) console.warn('[site] hydration recovered:', error);
      },
    });
  } else {
    createRoot(container).render(app);
  }
  window.__SITE_BOOTED__ = true;

  // Analytics is never on the critical path: load it when the browser is idle, only if configured.
  const { yandexMetrikaId, googleAnalyticsId } = data.content.seo;
  if (yandexMetrikaId || googleAnalyticsId) {
    const start = () => initAnalytics({ yandexMetrikaId, googleAnalyticsId });
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 });
    else setTimeout(start, 2500);
  }
}
