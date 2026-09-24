import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SectionId, SiteContent, SiteData } from './types';
import { fetchSitePayload } from './api';
import { resolveSiteData } from './resolve';

const SiteDataContext = createContext<SiteData | null>(null);

interface ProviderProps {
  /** Server-rendered data (window.__SITE_DATA__). Hydration MUST start from exactly this value. */
  initial: SiteData;
  children: ReactNode;
}

export function SiteDataProvider({ initial, children }: ProviderProps) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    // SSR already embedded live data — nothing to fetch. Only the static fallback snapshot
    // (SSR service down / first paint from CDN) upgrades itself once, after hydration.
    if (initial.source === 'api') return;
    let cancelled = false;
    fetchSitePayload()
      .then((payload) => {
        if (!cancelled) setData(resolveSiteData(payload));
      })
      .catch(() => {
        /* stay on bundled defaults: the page is fully usable without the API */
      });
    return () => {
      cancelled = true;
    };
  }, [initial.source]);

  return <SiteDataContext.Provider value={data}>{children}</SiteDataContext.Provider>;
}

export function useSiteData(): SiteData {
  const ctx = useContext(SiteDataContext);
  if (!ctx) throw new Error('useSiteData must be used inside <SiteDataProvider>');
  return ctx;
}

/** `const hero = useSection('hero')` — typed copy for one section. */
export function useSection<K extends SectionId>(id: K): SiteContent[K] {
  return useSiteData().content[id];
}
