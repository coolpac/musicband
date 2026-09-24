import { useEffect, useMemo, useState } from 'react';
import { useSection, useSiteData } from '../../content/SiteDataContext';
import { Link } from '../../router/Router';
import { Picture } from '../../components/ui/Picture';
import { Reveal } from '../../components/ui/Reveal';
import { demoEvents } from '../../content/demo/events';
import type { SiteEvent } from '../../content/types';
import './Events.css';

const HEADING_ID = 'site-events-heading';

/** Card width per breakpoint: 4 columns of a 1280 container, 2 on tablets, a 80%-wide rail on phones. */
const CARD_SIZES = '(min-width: 1440px) 296px, (min-width: 1200px) 23vw, (min-width: 768px) 45vw, 80vw';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ISO `YYYY-MM-DD` -> `DD.MM.YYYY`. Pure string work: no Date, so no timezone can shift the day. */
function formatRuDate(iso: string): string {
  const parts = ISO_DATE.exec(iso);
  return parts ? `${parts[3]}.${parts[2]}.${parts[1]}` : '';
}

/** Today in the visitor's own calendar. Never `toISOString()` — that is UTC and drops a day at night. */
function localToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function eventDate(event: SiteEvent): string {
  return event.date && ISO_DATE.test(event.date) ? event.date : '';
}

/**
 * `event.link` is admin-entered, so it has to be provably harmless before it reaches an `href`:
 * only site-internal paths and absolute http(s) URLs survive. `javascript:`, `data:` and
 * protocol-relative `//host` are treated as «no link», and the card falls back to the booking CTA.
 */
function safeLink(raw: string | null): string | null {
  const value = raw?.trim() ?? '';
  if (!value || value.startsWith('//')) return null;
  if (value.startsWith('/')) return value;
  return /^https?:\/\//i.test(value) ? value : null;
}

/** Soonest first; undated posters keep their admin order at the end. Pure, so SSR and client agree. */
function byDate(events: SiteEvent[]): SiteEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const left = eventDate(a.event);
      const right = eventDate(b.event);
      if (left && right && left !== right) return left < right ? -1 : 1;
      if (left !== '' && right === '') return -1;
      if (left === '' && right !== '') return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.event);
}

interface CardProps {
  event: SiteEvent;
  detailsLabel: string;
  bookLabel: string;
  index: number;
}

function EventCard({ event, detailsLabel, bookLabel, index }: CardProps) {
  const date = eventDate(event);
  const venue = event.venue?.trim() ?? '';
  const href = safeLink(event.link);
  const label = (href ? detailsLabel : bookLabel).trim();

  return (
    <Reveal as="li" className="site-events__item" index={Math.min(index, 5)}>
      <article className={event.image ? 'site-event-card site-event-card--photo' : 'site-event-card'}>
        {event.image ? (
          <div className="site-event-card__media">
            {/* Backdrop only: the card's meaning is fully carried by the text next to it. */}
            <Picture
              image={event.image}
              alt=""
              sizes={CARD_SIZES}
              wrapperClassName="site-event-card__frame"
              className="site-event-card__photo"
            />
          </div>
        ) : null}

        <div className="site-event-card__meta">
          {date ? (
            <time className="site-event-card__date" dateTime={date}>
              {formatRuDate(date)}
            </time>
          ) : null}
          <h3 className="site-event-card__title">{event.title}</h3>
          {venue ? <p className="site-event-card__venue">{venue}</p> : null}
        </div>

        {/* The visible CTA is also the card's hit target — it stretches over the whole card.
            Every card repeats the same label, so the event's name is appended for screen
            readers: a links list of four identical «Подробнее» is useless. <Link> renders a
            real <a href> and adds target/rel itself when the destination is external. */}
        {label ? (
          <Link className="site-event-card__cta" to={href ?? '/booking'}>
            {label}
            <span className="site-visually-hidden">: {event.title}</span>
          </Link>
        ) : null}
      </article>
    </Reveal>
  );
}

/**
 * Афиша. Cards come from the shared `posters` collection; the section disappears entirely
 * when there is nothing coming up, rather than showing an empty shelf.
 */
export function Events() {
  const { heading, detailsLabel, bookLabel } = useSection('events');
  const data = useSiteData();

  // Filtering «past» needs today's date, which the server must not guess: rendering it on the
  // server would bake one day's answer into a cached/prerendered page. So the backend is the
  // canonical filter, and this is the guard that heals a stale static snapshot after mount.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(localToday());
  }, []);

  const isDemo = import.meta.env.DEV && data.source === 'fallback';
  const source = isDemo ? demoEvents : data.events;

  const events = useMemo(() => {
    // A poster with no title would render an empty <h3> and an unnameable card.
    const sorted = byDate(source.filter((event) => event.title.trim().length > 0));
    // The demo set carries the verbatim Figma dates, which are in the past by now: a dev preview
    // that filtered them would show no афиша at all. Real data is always filtered.
    if (!today || isDemo) return sorted;
    return sorted.filter((event) => {
      const date = eventDate(event);
      return date === '' || date >= today;
    });
  }, [source, today, isDemo]);

  if (events.length === 0) return null;

  const title = heading.trim();

  return (
    <section id="events" className="site-events" aria-labelledby={title ? HEADING_ID : undefined}>
      <div className="site-container">
        {title ? (
          <Reveal as="h2" id={HEADING_ID} className="site-events__heading">
            {title}
          </Reveal>
        ) : null}
        {/* `list-style: none` (styles/base.css) drops list semantics in Safari/VoiceOver. */}
        <ul className="site-events__grid" role="list">
          {events.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              detailsLabel={detailsLabel}
              bookLabel={bookLabel}
              index={index}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
