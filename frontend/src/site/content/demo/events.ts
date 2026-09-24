/**
 * The four афиша cards drawn in Figma (frame 345:1327), for local development only.
 * Used by the Events section when `data.source === 'fallback' && import.meta.env.DEV`, i.e.
 * when there is no backend to talk to — never in production, where an empty афиша simply
 * hides the section. The only reference to it is guarded by `import.meta.env.DEV`, which the
 * production build folds to `false`, so nothing here can reach a visitor.
 *
 * Copy is verbatim from the design, with the two fixes the spec asks for:
 *   · cards 1–2 used English curly quotes “…” — normalised to Russian guillemets «…» (§9.7);
 *   · «Парк «Зеленый»» was missing its ё → «Зелёный» (§9.8).
 */
import type { RemoteImage, SiteEvent } from '../types';
import { siteImages, type SiteImageKey } from '../../assets/opt/manifest';
import { toSrcSet } from '../../components/ui/Picture';

/** Bundled image -> the `RemoteImage` shape the API would have delivered. */
function bundled(key: SiteImageKey): RemoteImage {
  const image = siteImages[key];
  return {
    // Same mid-size fallback <Picture> picks for a bundled image: the <source> srcSets carry the
    // real work, and `src` must not hand a 2560px file to a browser that ignores them.
    src: image.webp[Math.min(2, image.webp.length - 1)].url,
    avifSrcSet: toSrcSet(image.avif),
    webpSrcSet: toSrcSet(image.webp),
    width: image.width,
    height: image.height,
  };
}

/**
 * Cards 2 and 3 carry a link so the «Подробнее» branch of the CTA is exercised locally;
 * it points at this site's own афиша anchor rather than inventing a third-party URL.
 */
const DEMO_LINK = 'https://vgulcover.ru/#events';

export const demoEvents: SiteEvent[] = [
  {
    id: 'demo-1',
    title: '«КАМОН В КАРДАМОН»',
    date: '2026-05-12',
    venue: 'Начинаем в 21:30',
    description: null,
    image: bundled('events-afisha/event-card-1-photo'),
    link: null,
  },
  {
    id: 'demo-2',
    title: '«MONTEBRAU»',
    date: '2026-05-18',
    venue: 'Начало в 20:30',
    description: null,
    image: bundled('events-afisha/event-card-2-photo'),
    link: DEMO_LINK,
  },
  {
    id: 'demo-3',
    title: 'Свадьба в «Белом доме»',
    date: '2026-05-25',
    venue: '«Белый дом» (зал)',
    description: null,
    image: bundled('events-afisha/event-card-3-photo'),
    link: DEMO_LINK,
  },
  {
    id: 'demo-4',
    title: 'Фестиваль «Лето 2026»',
    date: '2026-06-02',
    venue: 'Парк «Зелёный»',
    description: null,
    image: null,
    link: null,
  },
];
