# Public website «ВГУЛ» + unified admin — design

Date: 2026-09-21 · Branch: `feat/website` · Figma: file `uGYI33VHTA0fp4bIT1zZEf`, 20 desktop frames (1440px)

## 1. Goal

A public marketing website (landing + 3-step booking) implemented from Figma, fully responsive
(360px → ultrawide), fast, with best-in-class SEO for Yandex and Google, plus a **«Сайт» mode inside
the existing admin** so the app and the site are managed in one place.

## 2. Architecture

```
                         ┌────────────── nginx (frontend container) ──────────────┐
 /?screen=… /?tgWebApp…  │  → index.html            Telegram Mini App (unchanged) │
 /app/*  /admin/*        │  → index.html                                          │
 /  /booking*  /privacy… │  → proxy site:4000  ──5xx/down──▶ dist/site-static/*.html
 /robots.txt /sitemap.xml│  → proxy site:4000                                     │
 /assets /js /site       │  → static, 1y immutable                                │
 /api /uploads /socket.io│  → proxy backend:3000                                  │
                         └─────────────────────────────────────────────────────────┘
 site (Node, zero deps): server/site-server.mjs = dist/site.html template + dist-ssr/entry-server.js
                         data: GET backend/api/public/site (SWR 30s, purge hook), falls back to bundled defaults
```

* **Separate HTML entry** `frontend/site.html` → `src/site/entry-client.tsx`. The site never loads the Mini App
  bundle (293 KB), its 100 KB CSS or the Telegram SDK. Only `vendor-react` is shared.
* **Real SSR** (not a client-rendered SPA): Yandex indexes server HTML far more reliably than JS-rendered pages.
  `entry-server.tsx → render(url, payload)` is pure and is used by the production server, the build-time
  prerender (static fallback snapshots) and the `vite dev` middleware (`plugins/site-ssr-dev.ts`) — one code path.
* **Telegram coexistence at `/`**: nginx sends Mini App query launches to `index.html`; a hash-only Telegram launch
  (invisible to servers) is caught by the inline shim at the top of `site.html` and handed to `/app/` with
  query + hash intact. No BotFather / QR / bot-link changes are required.
* **Content**: defaults live in the frontend (`src/site/content/sections/*.ts`). The backend stores only what the
  admin saved (JSON per section); `resolveSiteData()` deep-merges saved over defaults with type guards.
* **Shared collections**: афиша = `posters` (+ `eventDate`, `venue`), formats = `formats`, partners = `partners`.
  Website bookings land in the same `bookings` table the admin calendar already reads.

## 3. Frontend layout (`frontend/src/site/`)

| Path | What | Owner |
|---|---|---|
| `content/schema.ts`, `types.ts`, `registry.ts`, `resolve.ts`, `api.ts`, `SiteDataContext.tsx` | content contract + data layer | foundation (done) |
| `content/sections/<id>.ts` | **type + defaults + editor schema of ONE section** | section owner |
| `router/` | `RouterProvider`, `Link`, `useRouter`, routes | foundation (done) |
| `seo/` | `meta.ts` (title/desc/canonical/JSON-LD), `head.ts`, `analytics.ts` | foundation (done) |
| `styles/tokens.css`, `base.css` | design tokens, reset, utilities, reveal + view-transition CSS | foundation (done) |
| `components/ui/` | `Button`, `Picture`, `Reveal` | foundation (done) |
| `components/layout/` | `Header` (+ mobile menu), `Footer` | layout agent |
| `sections/<Name>/<Name>.tsx + .css` | landing sections | section agents |
| `booking/` | 3 pages + state + API | booking agent |
| `assets/<slug>/` raw Figma exports · `assets/opt/` generated AVIF/WebP + `manifest.ts` | | pipeline (done) |

## 4. Rules for every implementer (non-negotiable)

**Source of truth.** Your section's spec is in the scratchpad `spec/<slug>.md` (layout numbers, typography, verbatim
copy, asset table, reference code) and its render in `figma/full/<slug>.png`. At ≥1440px the result must match the
Figma frame. Figma contains designer slips (listed in each spec under «Ambiguities») — follow the spec's
recommendation, never reproduce an obvious bug (17-column calendar, 2px white sliver, clipped paddings…).

**Stack.** React 19 + TypeScript strict + plain CSS. No Tailwind, no CSS-in-JS, no new dependencies, no framer-motion
in the site bundle. One `.css` per component, imported by it. Class names: BEM with the `site-` prefix
(`site-hero__title`, `site-hero__title--accent`, state classes `is-open`).

**Tokens only.** Colours, font sizes, radii, spacing, durations, easings and z-indexes come from `styles/tokens.css`.
A missing token is added to `tokens.css` — never hardcoded. Brand red is `--c-accent` (#ff3135); Figma's
`#ff291f` / `#ff0000` are paste-in drift and map to it.

**Responsive (no mobile frames exist — you design them).** Mobile-first CSS. Must be flawless at
360, 390, 768, 1024, 1280, 1440, 1920 and not break at 320 or 2560. Use `.site-container`, `--gutter`,
`--section-y`, fluid `clamp()` tokens, CSS grid with `minmax`/`auto-fit`, container queries where they help.
No horizontal scroll ever (decor bleeds → `overflow: clip` on the section). Touch targets ≥ 44px. Hover effects
only inside `@media (hover: hover) and (pointer: fine)`. Use `svh/dvh`, never bare `100vh`, for full-height blocks.

**Text is text.** Every word in the design is real HTML text in a semantic element. Figma exported some labels as
outlined SVGs (`assets/events-afisha/text-*.svg`) — never use those. One `<h1>` per page (home: the hero headline);
sections use `<h2>`, cards `<h3>`. Landmarks: `<header> <nav> <main> <section aria-labelledby> <footer>`.

**Images.** Photos: only via `<Picture image={siteImages['<key>']} alt sizes />` from `assets/opt/manifest.ts`
(never import raw PNG/JPG). `sizes` must describe the real rendered width per breakpoint. `priority` only on the
hero poster. Meaningful Russian `alt`, or `alt=""` for decoration. Icons/decor SVGs: import the exported file
(`import url from '../../assets/<slug>/x.svg'` → `<img>` with explicit width/height, or CSS `mask`/`background`).
Never hand-draw or "improve" an SVG; never inline a path you authored. Content images from the admin arrive as
`RemoteImage | null`; `null` means "use the bundled one".

**SSR safety.** Components render identically on server and client: no `window`/`document`/`localStorage`/
`Date.now()`/`Math.random()` during render — only inside `useEffect` or event handlers. No `React.lazy`.
Date-dependent output (e.g. "today" in the calendar) is computed after mount.

**Motion** (modern, restrained, 60fps):
* Scroll entrances: `<Reveal variant index>` — CSS transitions toggled by one shared IntersectionObserver.
  Content is visible without JS. Stagger groups with `index` (≤ 6 steps).
* **Never** hold the hero poster (LCP) or the `<h1>` at `opacity:0` waiting for JS. Hero entrance = pure CSS
  `@keyframes` that start on first paint; the poster may scale/translate but not fade from 0.
* Animate only `transform`, `opacity`, `clip-path`, `filter` (sparingly). Never `width/height/top/left/margin`.
  Accordions use `grid-template-rows: 0fr → 1fr`.
* Scroll-linked effects (parallax, progress): CSS `animation-timeline: scroll()/view()` behind `@supports`,
  no scroll listeners. Pointer effects (tilt, spotlight): CSS variables set from a rAF-throttled handler, only on
  `(hover: hover) and (pointer: fine)`.
* Route changes already cross-fade via the View Transitions API (`router/Router.tsx`); add `view-transition-name`
  to elements that should morph between booking steps.
* Every animation must respect `prefers-reduced-motion` (tokens collapse durations to 1ms; disable loops and
  parallax explicitly). `will-change` only while animating.

**Accessibility.** Keyboard reachable + visible `:focus-visible` everywhere; dialogs/menus trap focus, close on Esc,
restore focus; `aria-expanded/controls/current/live` where applicable; form fields have `<label>`, inline errors
linked with `aria-describedby`, `aria-invalid`; icon-only buttons have `aria-label`. Colour contrast ≥ AA.

**Links and navigation.** Navigation = `<Link to>` / `<Button to>` (real `<a href>`), never `onClick={navigate}` on
a div/button. External links `target=_blank rel="noopener noreferrer"` (Button/Link do it for you).

**No fake content in production.** Placeholder data from Figma (masked phone «8922750ХХХХ», «LOGO» tiles,
`hello@vgul.ru`, `+7 (999) 123-45-67`, placeholder social icons) must not ship: empty value → the element or the
whole section is not rendered. Demo collections for local development live in `content/demo.ts` and are used only
when `data.source === 'fallback' && import.meta.env.DEV`.

**Section contract file** (`content/sections/<id>.ts`): export `XContent` (type), `xDefaults` (verbatim Figma copy,
fixing only unambiguous typos — list each fix in a comment), `xSchema: SectionSchema` describing EVERY editable
field with Russian labels and helpful hints (the admin form is generated from it).

## 5. Backend contract

All responses use the existing `{ success, data }` envelope.

```
GET  /api/public/site                      public, cached (Redis 60s) + ETag, own rate-limit bucket
  → { content: Partial<SiteContent>, events: SiteEvent[], formats: SiteFormat[], partners: SitePartner[], updatedAt }
     (shapes: frontend/src/site/content/types.ts; image URLs that are `data:` blobs are dropped → null)

GET  /api/bookings/available-dates?month=YYYY-MM     existing, public — reused by the site calendar

POST /api/public/site/bookings             public, strict IP rate limit (5/h), honeypot + min fill time
  body { bookingDate: YYYY-MM-DD, bookingTime?: HH:mm, fullName, phone, email?, city?, formatId?, comment?,
         consent: true, website: '' /*honeypot*/, elapsedMs: number }
  → 201 { id, bookingDate, bookingTime }   errors: 409 DATE_UNAVAILABLE, 422 VALIDATION, 429
  Creates a Booking with userId = null, origin = 'website'; notifies admins (fire-and-forget).

GET  /api/admin/site/content               admin → { content, updatedAt }
PUT  /api/admin/site/content/:section      admin, body = section JSON (≤ 256 KB, section id whitelisted)
     → invalidates the public cache and POSTs SITE_SSR_URL/__purge (best effort)
```

Prisma (hand-written SQL migration, additive only): `SiteContent { section @id, value Json, updatedAt }`;
`Booking.userId` nullable, `+ origin String @default("miniapp")`, `+ bookingTime String?`, `+ email String?`,
`+ comment String?`; `Poster + eventDate DateTime? @db.Date`, `+ venue String?`.

## 6. Admin «Сайт» mode

`mode: 'app' | 'site'` lives in `AdminContent` next to `activeTab`, persisted in `localStorage`, toggled by a segmented
switch in the admin top bar. `TabBar` is mode-keyed. Site-mode screens mount lazily on first switch inside their
own `<Suspense>`, so app-mode boot cost is unchanged. Site tabs: **Контент** (generic form renderer driven by
`sectionSchemas`), **Афиша** (existing posters screen + date/venue), **Заявки** (existing log, origin filter),
**SEO** (seo + contacts + legal sections). Existing app-mode behaviour must not change.

## 7. Decisions taken on Figma gaps (review these)

| Gap | Decision |
|---|---|
| Two variants of booking screens (plain / decorated) | Build the decorated v2 (newer node ids); v1 is its reduced-motion/low-power look |
| Репертуар: tracks 1–30 deleted in Figma | List is admin-editable; ships with the 30 tracks that exist, numbered from the data, two columns on desktop |
| Репертуар collapsed (red) vs expanded (dark) | One accordion section; list stays in the DOM when collapsed (SEO) |
| РАЙДЕР frame is an empty red band | Heading + optional text + «Скачать райдер» button; hidden button when no file |
| Partners are «LOGO» placeholders | Rendered only from real admin partners; section hidden when none |
| Social: VK/Telegram icons are placeholders, no URLs | Only networks with a URL render; exported Instagram/YouTube assets used, others text-badge until real icons are supplied |
| Footer «© 2026 КГУЛ» | Typo → «ВГУЛ», year is dynamic |
| Header nav ≠ footer nav | Header nav from Figma header frame is canonical; footer mirrors it |
| Hero right headline duplicates the left | Kept as default, editable per panel |
| Formats card 1 has no photo; orphan tile 345:2003 is exactly a card photo | Tile photo goes to card 1 |
| Masked phone, filler e-mail | Empty by default → hidden until set in admin |
| CTA band drawn below footer | Placed before the footer |
| No consent text on the form (152-ФЗ) | Consent line with link to /privacy added under the submit button |
