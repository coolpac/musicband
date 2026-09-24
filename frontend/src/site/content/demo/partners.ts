import type { SitePartner } from '../types';

/**
 * Local development only: used when the backend is unreachable (`source === 'fallback'`) AND
 * `import.meta.env.DEV`, so the partners section can be laid out without a database.
 *
 * Deliberately text-only — no invented brand names, no fake logos: production renders partners
 * from the admin collection or not at all. Tree-shaken from the production bundle by the
 * `import.meta.env.DEV` guard at the call site.
 */
export const demoPartners: SitePartner[] = [
  { id: 'demo-1', name: 'Партнёр 1', logo: null, link: null },
  { id: 'demo-2', name: 'Партнёр 2', logo: null, link: null },
  { id: 'demo-3', name: 'Партнёр 3', logo: null, link: null },
  { id: 'demo-4', name: 'Партнёр 4', logo: null, link: null },
  { id: 'demo-5', name: 'Партнёр 5', logo: null, link: null },
  { id: 'demo-6', name: 'Партнёр 6', logo: null, link: null },
];
