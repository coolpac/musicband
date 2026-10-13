import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import './VideoLightbox.css';

/**
 * CONTRACT (do not change the exported names or prop types — Hero and Video both depend on them).
 */
export interface VideoLightboxProps {
  /** YouTube / VK Video / Rutube page URL, or a direct .mp4/.webm file. */
  url: string;
  /** Accessible dialog title, e.g. «Промо-видео ВГУЛ». */
  title: string;
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, video[controls], [tabindex]:not([tabindex="-1"])';

/** Ids are opaque strings on every provider; reject anything that is not id-shaped rather than build a broken embed. */
function isId(value: string | null): value is string {
  return !!value && /^[\w-]{4,64}$/.test(value);
}

function host(url: URL): string {
  return url.hostname.replace(/^(?:www|m|player)\./, '').toLowerCase();
}

/**
 * Anything that reaches `href`/`src` has to be provably http(s) or same-origin. The URL comes from
 * the admin, so `javascript:`/`data:` must never survive as far as the DOM.
 */
function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

function youtubeEmbed(url: URL): string | null {
  const name = host(url);
  let id: string | null = null;
  if (name === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] ?? null;
  } else if (name === 'youtube.com' || name === 'youtube-nocookie.com' || name === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  if (!isId(id)) return null;
  // -nocookie: no tracking cookie until the visitor actually plays something.
  const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
  // «?t=90» / «?t=90s» — anything fancier (1m30s) is dropped rather than guessed at.
  const start = (url.searchParams.get('t') ?? url.searchParams.get('start') ?? '').replace(/s$/, '');
  if (/^\d{1,6}$/.test(start) && Number(start) > 0) params.set('start', start);
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

function vkEmbed(url: URL): string | null {
  const name = host(url);
  if (name !== 'vk.com' && name !== 'vk.ru' && name !== 'vkvideo.ru') return null;
  let oid: string | null = null;
  let id: string | null = null;
  if (url.pathname === '/video_ext.php') {
    oid = url.searchParams.get('oid');
    id = url.searchParams.get('id');
  } else {
    // /video-220754053_456239018, /videos-123?z=video-123_456, /clip-123_456
    const match = `${url.pathname}${url.search}`.match(/(?:video|clip)(-?\d+)_(\d+)/);
    oid = match?.[1] ?? null;
    id = match?.[2] ?? null;
  }
  if (!oid || !id || !/^-?\d+$/.test(oid) || !/^\d+$/.test(id)) return null;
  const params = new URLSearchParams({ oid, id, hd: '2', autoplay: '1' });
  const hash = url.searchParams.get('hash');
  if (hash && /^[\w]+$/.test(hash)) params.set('hash', hash);
  return `https://vk.com/video_ext.php?${params.toString()}`;
}

function rutubeEmbed(url: URL): string | null {
  if (host(url) !== 'rutube.ru') return null;
  const id = url.pathname.match(/^\/(?:video\/private|video|play\/embed)\/([^/?#]+)/)?.[1] ?? null;
  if (!isId(id)) return null;
  const params = new URLSearchParams({ autoplay: '1' });
  const p = url.searchParams.get('p');
  if (p && /^[\w-]+$/.test(p)) params.set('p', p);
  return `https://rutube.ru/play/embed/${id}/?${params.toString()}`;
}

/** Page URL -> embeddable player URL (autoplay on). Returns null for direct files and unknown hosts. */
export function toEmbedUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw || isDirectVideo(raw)) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  return youtubeEmbed(parsed) ?? vkEmbed(parsed) ?? rutubeEmbed(parsed);
}

export function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

/**
 * Modal video player. Mounted through a portal only while open — nothing renders on the server
 * and no iframe (or third-party connection) is paid for before the visitor clicks. Focus is
 * trapped, Esc and a backdrop click close, focus returns to the trigger, scrolling is locked
 * without a layout shift, and both the entrance and the exit animate.
 */
export function VideoLightbox({ url, title, open, onClose }: VideoLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(open);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Callers may blank `url`/`title` the moment they close (Hero does, one lightbox for N promos).
  // Holding the last open values keeps the exit animation playing the video it started with
  // instead of flashing the "cannot embed" fallback on the way out.
  const lastShown = useRef({ url, title });
  useEffect(() => {
    if (open) lastShown.current = { url, title };
  }, [open, url, title]);

  // Portals need a real document: render nothing during SSR and on the very first hydration pass.
  useEffect(() => setMounted(true), []);

  // Keep the dialog in the DOM for the length of its exit animation, but never run that
  // teardown for a lightbox that was simply never opened.
  const everOpened = useRef(open);
  useEffect(() => {
    if (open) {
      everOpened.current = true;
      setPresent(true);
      setClosing(false);
      return;
    }
    if (!everOpened.current) return;
    everOpened.current = false;
    setClosing(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      setPresent(false);
      setClosing(false);
    }, reduced ? 0 : 260);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Scroll lock without a sideways nudge. `html` reserves a scrollbar gutter (styles/base.css)
  // and `overflow: hidden` on the root propagates to the viewport, which normally hands that
  // gutter back as content width. Measuring the viewport before and after the lock compensates
  // exactly what was gained — and nothing at all with overlay scrollbars, or in an engine that
  // keeps the gutter reserved.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousPadding = root.style.paddingRight;
    const before = root.clientWidth;
    root.style.overflow = 'hidden';
    const gained = root.clientWidth - before;
    if (gained > 0) root.style.paddingRight = `${gained}px`;
    return () => {
      root.style.overflow = previousOverflow;
      root.style.paddingRight = previousPadding;
    };
  }, [open]);

  // Back to the trigger on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      restoreRef.current?.focus({ preventScroll: true });
      restoreRef.current = null;
    };
  }, [open]);

  // Focus in once the dialog is actually in the DOM: on the first open `present` flips one render
  // after `open`, so focusing on `open` alone would find `closeRef` still empty.
  useEffect(() => {
    if (!open || !present) return;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, present]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const trapTab = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  const onBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose]
  );

  if (!mounted || !present) return null;

  const shown = open ? { url, title } : lastShown.current;
  const embed = toEmbedUrl(shown.url);
  const safe = safeUrl(shown.url);
  const direct = !embed && !!safe && isDirectVideo(safe);

  return createPortal(
    <div
      className={`site-lightbox${closing ? ' is-closing' : ''}`}
      role="presentation"
      // Focus is already back on the trigger while the exit animation plays; `inert` takes the
      // dying dialog (and the player iframe inside it) out of the tab order and the a11y tree too.
      inert={closing}
      onClick={onBackdropClick}
    >
      <div
        ref={dialogRef}
        className="site-lightbox__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapTab}
      >
        <h2 id={titleId} className="site-visually-hidden">
          {shown.title}
        </h2>
        <button ref={closeRef} type="button" className="site-lightbox__close" onClick={onClose} aria-label="Закрыть видео">
          <span className="site-lightbox__cross" aria-hidden="true" />
        </button>
        <div className="site-lightbox__frame">
          {embed ? (
            <iframe
              className="site-lightbox__player"
              src={embed}
              title={shown.title}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : direct && safe ? (
            <video className="site-lightbox__player" src={safe} controls autoPlay playsInline preload="auto" />
          ) : (
            <p className="site-lightbox__fallback">
              Это видео нельзя встроить в страницу.
              {safe ? (
                <a href={safe} target="_blank" rel="noopener noreferrer">
                  Открыть в новой вкладке
                </a>
              ) : null}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
