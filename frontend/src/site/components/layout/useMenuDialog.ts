import { useCallback, useEffect, useState, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface MenuDialog {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

function isReachable(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

/**
 * Modal behaviour for the mobile menu: scroll lock without a layout jump, Esc, a focus trap
 * that also contains the burger (it is the visible «close» control but lives outside the
 * panel), focus restore, and an automatic close as soon as the desktop layout takes over.
 *
 * Everything touches the DOM only inside effects, so the server render is unaffected.
 */
export function useMenuDialog(
  panelRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  /** Width at which the burger disappears and the menu must not stay open. */
  desktopQuery = '(min-width: 1024px)'
): MenuDialog {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia(desktopQuery);
    if (mq.matches) {
      setOpen(false);
      return;
    }
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open, desktopQuery]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const { body } = document;

    // Lock the page. `scrollbar-gutter: stable` (base.css) normally keeps the width identical;
    // measure it anyway so browsers without that support do not shift the layout either.
    const widthBefore = root.clientWidth;
    const prevOverflow = root.style.overflow;
    const prevPadding = body.style.paddingRight;
    root.style.overflow = 'hidden';
    const gap = root.clientWidth - widthBefore;
    if (gap > 0) {
      body.style.paddingRight = `${gap}px`;
      root.style.setProperty('--site-scroll-lock-gap', `${gap}px`);
    }

    const panel = panelRef.current;
    const stops = (): HTMLElement[] => {
      const trigger = triggerRef.current;
      const inPanel = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
      // Trigger first: it precedes the panel in the DOM, so Tab order stays visually sane.
      return [...(trigger && isReachable(trigger) ? [trigger] : []), ...inPanel.filter(isReachable)];
    };

    panel?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = stops();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const index = active ? items.indexOf(active) : -1;

      if (index === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      root.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      root.style.removeProperty('--site-scroll-lock-gap');

      // Give focus back to the burger — but never steal it from a page the router has just
      // opened (it focuses #main itself after a link inside the menu was followed).
      const active = document.activeElement;
      const cameFromMenu = !active || active === body || panel?.contains(active) || active === triggerRef.current;
      if (cameFromMenu) triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open, panelRef, triggerRef]);

  return { open, toggle, close };
}
