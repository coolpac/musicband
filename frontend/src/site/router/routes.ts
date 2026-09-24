export type RouteId =
  | 'home'
  | 'booking'
  | 'bookingForm'
  | 'bookingSuccess'
  | 'privacy'
  | 'terms'
  | 'offer'
  | 'notFound';

export const ROUTE_PATHS: Record<Exclude<RouteId, 'notFound'>, string> = {
  home: '/',
  booking: '/booking',
  bookingForm: '/booking/form',
  bookingSuccess: '/booking/success',
  privacy: '/privacy',
  terms: '/terms',
  offer: '/offer',
};

/** Every path the site owns. nginx and the SSR server route exactly this list. */
export const SITE_PATHS = Object.values(ROUTE_PATHS);

/** Transactional steps: real URLs (back button, refresh) but no value in search results. */
export const NOINDEX_ROUTES: ReadonlySet<RouteId> = new Set(['bookingForm', 'bookingSuccess', 'notFound']);

export function normalizePath(pathname: string): string {
  const clean = pathname.replace(/\/{2,}/g, '/');
  return clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean || '/';
}

export function matchRoute(pathname: string): RouteId {
  const path = normalizePath(pathname);
  const hit = (Object.keys(ROUTE_PATHS) as Exclude<RouteId, 'notFound'>[]).find((id) => ROUTE_PATHS[id] === path);
  return hit ?? 'notFound';
}
