interface AnalyticsIds {
  yandexMetrikaId: string;
  googleAnalyticsId: string;
}

type YmFn = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

declare global {
  interface Window {
    ym?: YmFn;
    dataLayer?: unknown[];
  }
}

/** GA reads `arguments` objects from dataLayer; a plain array is silently ignored. */
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer?.push(arguments);
}

function loadScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

let metrikaId = 0;
let gaId = '';

/** Called on idle from entry-client — only the third-party scripts are heavy, and they load async. IDs are validated: they come from admin input. */
export function initAnalytics({ yandexMetrikaId, googleAnalyticsId }: AnalyticsIds) {
  if (/^\d{4,12}$/.test(yandexMetrikaId)) {
    metrikaId = Number(yandexMetrikaId);
    const ym: YmFn = function (...args: unknown[]) {
      (ym.a = ym.a || []).push(args);
    };
    ym.l = Date.now();
    window.ym = window.ym || ym;
    loadScript('https://mc.yandex.ru/metrika/tag.js');
    // defer: true — the SPA reports page views itself (trackPageView) so none are double-counted.
    window.ym(metrikaId, 'init', { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true });
    window.ym(metrikaId, 'hit', window.location.href, { title: document.title });
  }
  if (/^G-[A-Z0-9]{4,16}$/.test(googleAnalyticsId)) {
    gaId = googleAnalyticsId;
    window.dataLayer = window.dataLayer || [];
    gtag('js', new Date());
    gtag('config', gaId, { send_page_view: true });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${gaId}`);
  }
}

/** Call after client-side navigation. No-op until analytics has loaded. */
export function trackPageView(url: string, title: string) {
  if (metrikaId && window.ym) window.ym(metrikaId, 'hit', url, { title });
  if (gaId) gtag('event', 'page_view', { page_location: url, page_title: title });
}

/** Conversion goals: `booking_started`, `booking_submitted`. Configure matching goals in Metrika. */
export function trackGoal(name: string) {
  if (metrikaId && window.ym) window.ym(metrikaId, 'reachGoal', name);
  if (gaId) gtag('event', name);
}
