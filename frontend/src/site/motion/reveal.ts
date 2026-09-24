/**
 * Scroll reveal, the cheap way: ONE IntersectionObserver for the whole page toggles a class;
 * the animation itself is pure CSS (styles/base.css) running on the compositor.
 * A MutationObserver picks up elements that mount later (route change, accordion, API upgrade).
 */
export function initReveal(root: HTMLElement): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supported = 'IntersectionObserver' in window;

  const revealNow = (el: Element) => el.classList.add('is-revealed');

  if (reduced || !supported) {
    root.querySelectorAll('[data-reveal]').forEach(revealNow);
    const mo = new MutationObserver(() => root.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach(revealNow));
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        revealNow(entry.target);
        io.unobserve(entry.target);
      }
    },
    // Fire a little before the element is fully in view so it is already moving when the eye arrives.
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );

  const scan = () => root.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach((el) => io.observe(el));
  scan();

  let scheduled = false;
  const mo = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  });
  mo.observe(root, { childList: true, subtree: true });

  return () => {
    io.disconnect();
    mo.disconnect();
  };
}
