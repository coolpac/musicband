import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { matchRoute, normalizePath, type RouteId } from './routes';

interface Location {
  pathname: string;
  hash: string;
}

interface NavigateOptions {
  replace?: boolean;
}

interface RouterValue extends Location {
  route: RouteId;
  navigate: (to: string, options?: NavigateOptions) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function parse(to: string): Location {
  const url = new URL(to, 'http://site.local');
  return { pathname: normalizePath(url.pathname), hash: url.hash };
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Scroll to `#id`, retrying briefly: after a route change the target may mount a frame later. */
function scrollToHash(hash: string, smooth: boolean) {
  const id = decodeURIComponent(hash.slice(1));
  if (!id) return;
  let tries = 0;
  const attempt = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto', block: 'start' });
      return;
    }
    if (tries++ < 20) requestAnimationFrame(attempt);
  };
  attempt();
}

interface ProviderProps {
  /** Request URL during SSR; ignored on the client after the first render. */
  initialUrl: string;
  children: ReactNode;
}

export function RouterProvider({ initialUrl, children }: ProviderProps) {
  const [location, setLocation] = useState<Location>(() => parse(initialUrl));
  const isFirstRender = useRef(true);

  useEffect(() => {
    const onPop = () => setLocation({ pathname: normalizePath(window.location.pathname), hash: window.location.hash });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Arriving on «/#formats» from a cold load: the browser's native jump can fire before hydration.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (window.location.hash) scrollToHash(window.location.hash, false);
    }
  }, []);

  const navigate = useCallback((to: string, options: NavigateOptions = {}) => {
    const next = parse(to);
    const current = { pathname: normalizePath(window.location.pathname), hash: window.location.hash };
    const samePage = next.pathname === current.pathname;

    const url = `${next.pathname}${next.hash}`;
    if (options.replace) window.history.replaceState(null, '', url);
    else if (!samePage || next.hash !== current.hash) window.history.pushState(null, '', url);

    if (samePage) {
      setLocation(next);
      if (next.hash) scrollToHash(next.hash, true);
      else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      return;
    }

    const commit = () => {
      // flushSync: the View Transition snapshot must see the new DOM synchronously.
      flushSync(() => setLocation(next));
      if (next.hash) scrollToHash(next.hash, false);
      else window.scrollTo(0, 0);
      // Screen readers and keyboard users land at the top of the new page, not mid-document.
      const main = document.getElementById('main');
      main?.focus({ preventScroll: true });
    };

    if (typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  }, []);

  const value = useMemo<RouterValue>(
    () => ({ ...location, route: matchRoute(location.pathname), navigate }),
    [location, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>');
  return ctx;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Site path, optionally with hash: «/booking», «/#formats». External URLs render a plain <a>. */
  to: string;
  replace?: boolean;
}

function isInternal(to: string): boolean {
  return to.startsWith('/') && !to.startsWith('//');
}

/** A real <a href> (crawlable, middle-click/⌘-click work) that upgrades to client navigation. */
export function Link({ to, replace, onClick, target, rel, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (target && target !== '_self') return;
    if (!isInternal(to)) return;
    e.preventDefault();
    navigate(to, { replace });
  };

  const external = !isInternal(to) && /^https?:/i.test(to);
  return (
    <a
      href={to}
      target={target ?? (external ? '_blank' : undefined)}
      rel={rel ?? (external ? 'noopener noreferrer' : undefined)}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </a>
  );
}
