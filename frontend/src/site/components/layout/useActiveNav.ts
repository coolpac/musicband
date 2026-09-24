import { useEffect, useMemo, useState } from 'react';
import type { NavItem } from '../../content/sections/header';
import { normalizePath } from '../../router/routes';

/** «/#formats» → «formats»; «/booking» → «». */
export function navHash(href: string): string {
  const i = href.indexOf('#');
  return i === -1 ? '' : href.slice(i + 1).trim();
}

/** «/#formats» → «/»; «/booking» → «/booking»; «https://…» → «» (never a route). */
function navPath(href: string): string {
  if (!href.startsWith('/')) return '';
  const i = href.indexOf('#');
  return normalizePath(i === -1 ? href : href.slice(0, i));
}

/**
 * Which nav item is «current».
 *
 * Off the home page it is decided by the route alone, which means the server already renders
 * the right item — no flash, no JS needed. On the home page every item that points at a
 * section is scroll-spied with ONE IntersectionObserver watching a band just under the header;
 * there is no scroll listener anywhere. Returns -1 when nothing is current.
 */
export function useActiveNav(nav: NavItem[], pathname: string): number {
  const isHome = pathname === '/';

  const routeIndex = useMemo(
    () => nav.findIndex((item) => !navHash(item.href) && navPath(item.href) === pathname),
    [nav, pathname]
  );

  const [spyIndex, setSpyIndex] = useState(-1);

  useEffect(() => {
    setSpyIndex(-1);
    if (!isHome || typeof IntersectionObserver === 'undefined') return;

    const main = document.getElementById('main');
    if (!main) return;

    // An item without a hash («Главная») spies the first section on the page, so scrolling
    // back to the top returns the highlight to it without hard-coding «hero» anywhere.
    const targets: { index: number; el: Element }[] = [];
    const claimed = new Set<Element>();
    nav.forEach((item, index) => {
      const hash = navHash(item.href);
      if (!hash && navPath(item.href) !== '/') return;
      const el = hash ? document.getElementById(hash) : main.querySelector('section[id]');
      if (!el || claimed.has(el)) return;
      claimed.add(el);
      targets.push({ index, el });
    });
    if (targets.length === 0) return;

    targets.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        // Deepest section currently crossing the band wins; when the band sits inside a long
        // section nothing fires at all and the previous answer simply stays correct.
        for (let i = targets.length - 1; i >= 0; i -= 1) {
          if (visible.has(targets[i].el)) {
            setSpyIndex(targets[i].index);
            return;
          }
        }
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );

    for (const target of targets) observer.observe(target.el);
    return () => observer.disconnect();
  }, [isHome, nav]);

  return isHome && spyIndex >= 0 ? spyIndex : routeIndex;
}
