# Max (max.ru) Messenger Integration — Design

Date: 2026-05-29
Status: Approved (architecture A)

## Goal

Add full integration with the Max messenger (max.ru) so the product works the
same as it does in Telegram: full Mini App parity (the web UI opens inside Max
with native auth) plus every bot-side feature (onboarding, broadcasts, booking
notifications + confirm/cancel, review requests, voting deep links + winner
notifications, referral deep links, admin stats).

The user has two Max bots already created (verified legal entity required by
Max):

- User bot: `id744719465529_bot` — https://max.ru/id744719465529_bot
- Admin bot: `id744719465529_1_bot` — https://max.ru/id744719465529_1_bot

Tokens were shared in chat and MUST be treated as compromised — rotate them in
the Max partner cabinet after setup. They live only in server env, never in the
repo.

## Background — current Telegram integration

- Library `node-telegram-bot-api` (polling). Two bots: `UserBot`, `AdminBot`,
  orchestrated by `botManager.ts`, wired in `app.ts`.
- Shared service/DB layer keyed on `User.telegramId` (BigInt @unique). JWT
  carries `telegramId`. `OnboardingAnswer.telegramId`, `VotingFollowUp.telegramIds`
  (JSON) also key on it.
- Frontend is a Telegram Mini App: `window.Telegram.WebApp`, `initData` HMAC
  auth (`shared/utils/telegram.ts`), `web_app` buttons, deep links
  `t.me/<bot>?start=...`, QR via `utils/qrcode.ts`.
- Public edge: host nginx → frontend container `127.0.0.1:8084`, which proxies
  `/api/` to the backend. Domain `vgulcover.ru`. So `/api/...` routes need no
  new nginx work.

## Max Bot API / Mini App — researched facts

- Official TS lib: `@maxhub/max-bot-api` (grammy-like: `new Bot(token)`,
  `bot.on('bot_started'|'message_created'|'message_callback')`, `bot.command`,
  `bot.hears`, `ctx.reply`, `bot.start()`).
- REST base `https://platform-api.max.ru`; auth header `Authorization: <token>`;
  rate limit 30 req/s. Endpoints: `POST /messages`, `POST /subscriptions`
  (webhook), `GET /updates` (long polling), `POST /uploads` (media), `POST /answers`
  (callbacks), `GET /me`.
- Deep links: `https://max.ru/<botName>?start=<payload>` (≤128 chars), delivered
  via `bot_started` events.
- Mini App bridge: `<script src="https://st.max.ru/js/max-web-app.js">` →
  `window.WebApp`. `initData` (URL-encoded, for server validation) +
  `initDataUnsafe` (user.id/first_name/last_name/username/photo_url, chat,
  start_param). Hash is HMAC-SHA256 with bot token (exact concat order to be
  confirmed against the lib). Methods: `openLink`, `openMaxLink`, `BackButton`,
  `requestContact`, `platform`, `version`.
- Inline keyboards: attachment `{type:'inline_keyboard', payload:{buttons:[[...]]}}`,
  button types `callback|link|message|open_app|request_contact|request_geo_location|clipboard`.

## Decisions

1. **Mini App scope:** full parity — UI runs inside Max with native auth.
2. **Identity model:** `platform` + `platformId` with composite uniqueness.
3. **Update delivery for Max:** webhook (prod-recommended).
4. **Transport architecture:** A — unified `BotManager` + per-platform adapters.

## Architecture A

Platform abstraction. Service/DB layer becomes platform-agnostic; only the
transport (bot lib, webhook ingest, initData validation, deep-link/QR scheme,
mini-app SDK on frontend) is platform-specific. Telegram behavior is unchanged.

## Design sections

### 1. Data model (Prisma)
- `enum Platform { telegram max }`.
- `User`: rename `telegramId` → `platformId` (BigInt); add `platform Platform
  @default(telegram)`; add optional `photoUrl`; replace single unique with
  `@@unique([platform, platformId])`.
- `OnboardingAnswer`: same rename + `platform` + composite unique.
- `VotingFollowUp.telegramIds` (JSON) → stores `{platform, platformId}` entries.
- Migration: existing rows get `platform=telegram`, `platformId` = old
  `telegramId`.
- JWT payload: `telegramId` → `platform` + `platformId`; update `JWTPayload`,
  `generateToken`, auth middleware (`req.user`).

### 2. Backend transport layer
- New `backend/src/infrastructure/messaging/` with
  `interface PlatformBots { userBot, adminBot, start(), stop() }`.
- Wrap existing `UserBot`/`AdminBot` as `TelegramBots`.
- New `MaxUserBot`/`MaxAdminBot` on `@maxhub/max-bot-api`: `bot_started`
  (deep-link → onboarding/referral/vote), `command`, `message_created`,
  `message_callback`, `ctx.reply`, inline_keyboard, media via two-step
  `POST /uploads`.
- `BotManager` holds `Map<Platform, PlatformBots>` and routes notifications by
  `user.platform`.

### 3. Max update delivery — webhook
- `POST /api/max/webhook/user` and `/api/max/webhook/admin` (through existing
  `/api/` proxy; no new nginx). Verify by secret (path/header), return 200 fast,
  process async, idempotent by update id.
- On startup register subscription `POST /subscriptions` with
  `https://vgulcover.ru/api/max/webhook/...`.

### 4. Mini App auth
- `shared/utils/max.ts` → `validateMaxInitData(raw, botToken)` (Max HMAC scheme).
- `AuthService.authenticateWithMax(raw, startParam)` — tries user then admin
  token.
- New endpoint `POST /api/auth/max` (mirror of `/api/auth/telegram`).

### 5. Frontend platform adapter
- Generalize `src/telegram/` into a platform facade: `getPlatform()` detects
  `window.Telegram?.WebApp` vs Max `window.WebApp`. Unified `webApp`: initData,
  startParam, user, ready/expand, openLink, BackButton, haptics (Max no-op where
  absent), alerts/confirm, viewport/safe-area.
- Load Max script `https://st.max.ru/js/max-web-app.js` in `index.html`.
- `App.tsx` auth effect calls the endpoint matching the detected platform.

### 6. Deep links / QR
- `qrcode.ts` parameterized by platform: Telegram `t.me/<bot>?start=...` (+
  `/<app>?startapp=`), Max `max.ru/<bot>?start=...` (+ startapp).
- Admin voting QR generated for both platforms.

### 7. Avatars
- Telegram: proxy via bot API (unchanged). Max: store `photo_url` from initData
  on `User.photoUrl`; `/api/auth/me/avatar` becomes platform-aware
  (telegram=proxy, max=redirect/proxy stored URL).

### 8. Notification routing
- `notifyNewUser`, booking received/confirmed, review request, voting winner,
  broadcast, scheduled follow-ups: resolve target user's platform → dispatch via
  that adapter. Broadcast segmented as today plus per-platform split; rate-limit
  per platform.

### 9. Error handling
- `maxErrors.ts` mirroring `telegramErrors.ts` (user-blocked-bot, rate
  limit/backoff). Max config optional — absent tokens => Max skipped gracefully
  (mirrors current Telegram behavior).

### 10. Env / config
- New: `MAX_USER_BOT_TOKEN`, `MAX_ADMIN_BOT_TOKEN`, `MAX_USER_BOT_USERNAME`
  (`id744719465529_bot`), `MAX_ADMIN_BOT_USERNAME` (`id744719465529_1_bot`),
  `MAX_WEBHOOK_SECRET`, `PUBLIC_BASE_URL` (`https://vgulcover.ru`).
- Added to `.env.example` and `backend/.env.example`. `BotManager.initialize`
  reads them; skips Max if absent.

### 11. Testing
- Unit: `validateMaxInitData` (valid/expired/tampered), deep-link URL builders,
  platform routing in `BotManager` (mock adapters), `/api/auth/max`.
- TDD. Manual limits: cannot fully test inside Max without verified org/device —
  webhook tested with simulated payloads, mini-app auth via token-signed
  initData.

## Risks to confirm during implementation
1. Exact Max initData HMAC algorithm (confirm against `@maxhub/max-bot-api`
   source) — security-critical.
2. Max mini-app deep-link/`startapp` format and whether `open_app` needs app
   registration.
3. `X-Frame-Options: SAMEORIGIN` / CSP — if Max embeds the mini app in an
   iframe, may need to allow `max.ru`.
4. `@maxhub/max-bot-api` webhook helper surface (handleUpdate / subscription
   registration).
5. Max media upload (two-step `/uploads`) and presence of `web_app`-equivalent
   buttons (`open_app`).
