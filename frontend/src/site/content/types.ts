import type { HeaderContent } from './sections/header';
import type { HeroContent } from './sections/hero';
import type { EventsContent } from './sections/events';
import type { WhyUsContent } from './sections/whyUs';
import type { FormatsContent } from './sections/formats';
import type { VideoContent } from './sections/video';
import type { RepertoireContent } from './sections/repertoire';
import type { RiderContent } from './sections/rider';
import type { PartnersContent } from './sections/partners';
import type { SocialContent } from './sections/social';
import type { CtaContent } from './sections/cta';
import type { FooterContent } from './sections/footer';
import type { BookingContent } from './sections/booking';
import type { SeoContent } from './sections/seo';
import type { ContactsContent } from './sections/contacts';
import type { LegalContent } from './sections/legal';

/**
 * An image referenced by URL — what the admin upload API produces
 * (POST /api/upload/image -> srcSet.avif / srcSet.webp are ready "url 480w, ..." strings).
 * In content, `null` always means "use the image bundled with the site".
 */
export interface RemoteImage {
  src: string;
  avifSrcSet?: string;
  webpSrcSet?: string;
  width?: number;
  height?: number;
}

/** Editable copy + settings, one key per section. Stored as JSON per section on the backend. */
export interface SiteContent {
  seo: SeoContent;
  contacts: ContactsContent;
  header: HeaderContent;
  hero: HeroContent;
  events: EventsContent;
  whyUs: WhyUsContent;
  formats: FormatsContent;
  video: VideoContent;
  repertoire: RepertoireContent;
  rider: RiderContent;
  partners: PartnersContent;
  social: SocialContent;
  cta: CtaContent;
  footer: FooterContent;
  booking: BookingContent;
  legal: LegalContent;
}

export type SectionId = keyof SiteContent;

/* ── Collections shared with the Telegram app (managed in the same admin) ── */

/** Афиша. Backed by the `posters` table (+ eventDate/venue added for the site). */
export interface SiteEvent {
  id: string;
  title: string;
  /** ISO date YYYY-MM-DD, or null when the poster has no date. */
  date: string | null;
  /** Free text, e.g. «Начало в 20:30» or «Парк «Зелёный»». */
  venue: string | null;
  description: string | null;
  image: RemoteImage | null;
  link: string | null;
}

export interface SiteFormat {
  id: string;
  name: string;
  shortDescription: string | null;
  image: RemoteImage | null;
}

export interface SitePartner {
  id: string;
  name: string;
  logo: RemoteImage | null;
  link: string | null;
}

/** Everything a page needs. Produced by resolveSiteData() on server and client alike. */
export interface SiteData {
  content: SiteContent;
  events: SiteEvent[];
  formats: SiteFormat[];
  partners: SitePartner[];
  /** 'api' = live backend data; 'fallback' = bundled defaults (API unreachable). */
  source: 'api' | 'fallback';
}

type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Shape of GET /api/public/site. `content` holds only what the admin has saved. */
export interface SiteApiPayload {
  content: DeepPartial<SiteContent>;
  events: SiteEvent[];
  formats: SiteFormat[];
  partners: SitePartner[];
  updatedAt: string | null;
}
