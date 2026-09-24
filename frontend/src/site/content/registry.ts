import type { SiteContent, SectionId } from './types';
import type { SectionSchema } from './schema';
import { seoDefaults, seoSchema } from './sections/seo';
import { contactsDefaults, contactsSchema } from './sections/contacts';
import { headerDefaults, headerSchema } from './sections/header';
import { heroDefaults, heroSchema } from './sections/hero';
import { eventsDefaults, eventsSchema } from './sections/events';
import { whyUsDefaults, whyUsSchema } from './sections/whyUs';
import { formatsDefaults, formatsSchema } from './sections/formats';
import { videoDefaults, videoSchema } from './sections/video';
import { repertoireDefaults, repertoireSchema } from './sections/repertoire';
import { riderDefaults, riderSchema } from './sections/rider';
import { partnersDefaults, partnersSchema } from './sections/partners';
import { socialDefaults, socialSchema } from './sections/social';
import { ctaDefaults, ctaSchema } from './sections/cta';
import { footerDefaults, footerSchema } from './sections/footer';
import { bookingDefaults, bookingSchema } from './sections/booking';
import { legalDefaults, legalSchema } from './sections/legal';

/** Single source of truth for default copy. The backend stores only what the admin changed. */
export const defaultContent: SiteContent = {
  seo: seoDefaults,
  contacts: contactsDefaults,
  header: headerDefaults,
  hero: heroDefaults,
  events: eventsDefaults,
  whyUs: whyUsDefaults,
  formats: formatsDefaults,
  video: videoDefaults,
  repertoire: repertoireDefaults,
  rider: riderDefaults,
  partners: partnersDefaults,
  social: socialDefaults,
  cta: ctaDefaults,
  footer: footerDefaults,
  booking: bookingDefaults,
  legal: legalDefaults,
};

/** Order = order in the admin «Сайт → Контент» list (page order first, settings last). */
export const sectionSchemas: SectionSchema[] = [
  heroSchema,
  eventsSchema,
  whyUsSchema,
  formatsSchema,
  videoSchema,
  repertoireSchema,
  riderSchema,
  partnersSchema,
  socialSchema,
  ctaSchema,
  headerSchema,
  footerSchema,
  bookingSchema,
  contactsSchema,
  legalSchema,
  seoSchema,
];

export const SECTION_IDS = Object.keys(defaultContent) as SectionId[];
