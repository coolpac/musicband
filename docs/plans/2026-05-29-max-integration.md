# Max (max.ru) Messenger Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full Max (max.ru) messenger support — Mini App parity plus every bot feature — by introducing a platform abstraction so the existing Telegram behavior is unchanged.

**Architecture:** Platform abstraction (design doc: `docs/plans/2026-05-29-max-integration-design.md`, architecture A). Service/DB layer becomes platform-agnostic via a `platform` + `platformId` identity model. A unified `BotManager` holds a `Map<Platform, PlatformBots>` and routes by `user.platform`. Telegram code is wrapped behind a `PlatformBots` adapter; a new Max adapter uses `@maxhub/max-bot-api` with long-polling delivery. The frontend gains a platform facade that detects Telegram vs Max and auths against the right endpoint.

**Tech Stack:** TypeScript, Express, Prisma/PostgreSQL, Redis, Jest, `node-telegram-bot-api` (existing), `@maxhub/max-bot-api` (new), React/Vite frontend, Telegram + Max Mini App SDKs.

**Conventions:**
- Tests live under `src/**/__tests__/*.test.ts`; run with `npm test` (from `backend/`).
- Type-check: `npm run type-check`. Lint: `npm run lint`. Build: `npm run build:dev`.
- Migrations: `npm run prisma:migrate:dev -- --name <name>`.
- Follow @superpowers:test-driven-development and @superpowers:verification-before-completion. Commit after each task.
- All work happens from repo root `/Users/who/музыканты`; backend commands run inside `backend/`.

---

## Phase 0 — Scaffolding & dependencies

### Task 0.1: Install the Max bot library

**Files:**
- Modify: `backend/package.json`, `backend/package-lock.json`

**Step 1:** From `backend/`, run `npm install @maxhub/max-bot-api`.
**Step 2:** Verify it resolves: `node -e "require('@maxhub/max-bot-api')"` → no error.
**Step 3:** Run `npm run type-check` → still passes.
**Step 4:** Commit.
```bash
git add backend/package.json backend/package-lock.json
git commit -m "build: add @maxhub/max-bot-api dependency"
```

### Task 0.2: Confirm the Max SDK surface (research, no code) — DONE

Findings (inspected `@maxhub/max-bot-api` v0.2.2 typings/js):
- Exports: `Bot, Api, Composer, Context, Keyboard` (namespace), `MaxError`, attachment classes.
- **Polling-only.** `bot.start({ allowedUpdates })` = `GET /updates` loop; `bot.stop()`. No public webhook handler; no subscription register in the lib. → **Delivery = long polling** (user-confirmed change from webhook).
- Handlers: `bot.command(t, fn)`, `bot.hears(t, fn)`, `bot.action(t, fn)` (message_callback), `bot.on('bot_started'|'message_created'|'message_callback', fn)`.
- Context: `ctx.startPayload` (bot_started deep-link), `ctx.user` (Max `User`), `ctx.callback`, `ctx.chatId`, `ctx.reply(text, extra)`, `ctx.answerOnCallback(extra)`.
- Send w/o ctx: `bot.api.sendMessageToUser(userId:number, text, extra:SendMessageExtra)`; `extra.attachments` carries keyboards/media.
- Keyboards: `import { Keyboard } from '@maxhub/max-bot-api'` → `Keyboard.inlineKeyboard([[ Keyboard.button.callback(text,payload), Keyboard.button.link(text,url) ]])`.
- Media: `bot.api.uploadImage|uploadVideo|uploadFile(options)` → attachment, pass via `extra.attachments`.
- Commands: `bot.api.setMyCommands([{ name, description }])`.
- **Bot-side `User` = `{ user_id, name, username, is_bot, last_activity_time }`** — only `name` (no first/last). Mini App `initData` user splits first_name/last_name/photo_url.
- **No initData validator in the lib** → Task 2.1 implements + confirms HMAC from bridge docs.

No commit (research only).

---

## Phase 1 — Identity model (`platform` + `platformId`)

This phase renames `telegramId` → `platformId` and adds `platform` across schema, repositories, services, JWT, and controllers. Existing Telegram behavior must be byte-for-byte equivalent (platform defaults to `telegram`).

### Task 1.1: Prisma schema — add Platform + platformId

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1:** Add enum near the other enums:
```prisma
enum Platform {
  telegram
  max
}
```
**Step 2:** In `model User`, replace `telegramId BigInt @unique @map("telegram_id")` with:
```prisma
  platform   Platform @default(telegram)
  platformId BigInt   @map("platform_id")
  photoUrl   String?  @map("photo_url")
```
and remove the standalone unique; add to the indexes block:
```prisma
  @@unique([platform, platformId])
```
**Step 3:** In `model OnboardingAnswer`, apply the same rename: `platform Platform @default(telegram)`, `platformId BigInt @map("platform_id")`, replace its `@unique` with `@@unique([platform, platformId])`.
**Step 4:** Run `npx prisma format` then `npm run prisma:generate`. Expected: client regenerates without error.
**Step 5:** Do NOT migrate yet (next task writes the data-preserving migration). Commit schema only.
```bash
git add backend/prisma/schema.prisma
git commit -m "feat(db): add Platform enum and platformId to User/OnboardingAnswer schema"
```

### Task 1.2: Write the data-preserving migration

**Files:**
- Create: `backend/prisma/migrations/20260529000000_add_platform_identity/migration.sql`

**Step 1:** Hand-write SQL so existing rows are preserved (do not use `migrate dev` auto-gen, which may drop columns). Content:
```sql
-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('telegram', 'max');

-- Users
ALTER TABLE "users" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'telegram';
ALTER TABLE "users" ADD COLUMN "photo_url" TEXT;
ALTER TABLE "users" RENAME COLUMN "telegram_id" TO "platform_id";
DROP INDEX IF EXISTS "users_telegram_id_key";
CREATE UNIQUE INDEX "users_platform_platform_id_key" ON "users"("platform", "platform_id");

-- Onboarding answers
ALTER TABLE "onboarding_answers" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'telegram';
ALTER TABLE "onboarding_answers" RENAME COLUMN "telegram_id" TO "platform_id";
DROP INDEX IF EXISTS "onboarding_answers_telegram_id_key";
CREATE UNIQUE INDEX "onboarding_answers_platform_platform_id_key" ON "onboarding_answers"("platform", "platform_id");
```
(Adjust the exact old index names to match what's in earlier migrations — grep `telegram_id` under `backend/prisma/migrations/` to confirm constraint names.)
**Step 2:** Apply to a dev DB: `npm run prisma:migrate:dev` (it should detect the migration as already-written and apply it). Expected: applies cleanly, `prisma migrate status` shows up to date.
**Step 3:** Spot-check data preserved: `npx prisma studio` or a quick query — existing users have `platform='telegram'` and their old IDs in `platform_id`.
**Step 4:** Commit.
```bash
git add backend/prisma/migrations/20260529000000_add_platform_identity/
git commit -m "feat(db): migration renaming telegram_id to platform_id with platform"
```

### Task 1.3: UserRepository — generalize to platform + platformId

**Files:**
- Modify: `backend/src/infrastructure/database/repositories/UserRepository.ts`
- Test: `backend/src/infrastructure/database/repositories/__tests__/UserRepository.test.ts` (create if absent)

**Step 1 (test):** Write a failing test (mock PrismaClient) asserting `findOrCreateByIdentity({platform:'max', platformId: 123n, ...})` queries with the composite key and returns `{user, created}`. Also keep a `findByIdentity(platform, platformId)`.
**Step 2:** Run `npm test -- UserRepository` → FAIL (method missing).
**Step 3:** Implement: rename `CreateUserData.telegramId` → `platformId` and add `platform: Platform`; rename `findByTelegramId`→`findByIdentity(platform, platformId)` and `findOrCreateByTelegramId`→`findOrCreateByIdentity`. Use `where: { platform_platformId: { platform, platformId } }` for unique lookups. Keep the race-safe create-then-catch-unique pattern.
**Step 4:** `npm test -- UserRepository` → PASS. Then `npm run type-check` will fail elsewhere (callers) — that's expected and fixed in 1.4–1.6.
**Step 5:** Commit (allow type errors in dependent files; they're fixed next tasks — OR sequence by committing the whole phase at 1.7). Prefer: commit repo + its test now.
```bash
git add backend/src/infrastructure/database/repositories/UserRepository.ts backend/src/infrastructure/database/repositories/__tests__/UserRepository.test.ts
git commit -m "refactor(db): UserRepository keyed on (platform, platformId)"
```

### Task 1.4: JWT payload + AuthService

**Files:**
- Modify: `backend/src/domain/services/AuthService.ts`
- Test: `backend/src/domain/services/__tests__/AuthService.test.ts` (create)

**Step 1 (test):** Failing test: `generateToken`/`verifyToken` round-trips a payload `{userId, platform, platformId, role}` (no `telegramId`).
**Step 2:** `npm test -- AuthService` → FAIL.
**Step 3:** Implement: change `JWTPayload` to `{ userId; platform: Platform; platformId: string; role; jti?; iat?; exp? }`. Update `AuthResult.user` to expose `platform` + `platformId` (keep `username/firstName/lastName`). Update `authenticateWithTelegram` to pass `platform: 'telegram'` into `findOrCreateByIdentity`, build token with platform fields, and route the new-user notification with platform. Rename `authenticateAdmin(telegramId,...)` parameter to operate on `(platformId)` with platform fixed to `telegram` (admin login is Telegram-only today) OR accept `{platform, platformId}` — keep telegram default to avoid behavior change.
**Step 4:** `npm test -- AuthService` → PASS.
**Step 5:** Commit.
```bash
git add backend/src/domain/services/AuthService.ts backend/src/domain/services/__tests__/AuthService.test.ts
git commit -m "refactor(auth): JWT and AuthService carry platform + platformId"
```

### Task 1.5: Auth middleware + AuthController + DTO

**Files:**
- Modify: `backend/src/presentation/middleware/auth.ts`, `backend/src/presentation/controllers/AuthController.ts`, `backend/src/application/dto/auth.dto.ts`, and the `req.user` type (search `telegramId` in `src/presentation` and `src/@types`/`express.d.ts`).

**Step 1:** Grep: `grep -rn "telegramId" backend/src/presentation backend/src/shared` to enumerate references.
**Step 2:** Update `req.user` augmentation to `{ userId; platform; platformId; role }`. Update `getCurrentUser` to return `platform` + `platformId` (keep an `avatarUrl` field). Update `getAvatar` to branch by `req.user.platform` (telegram path unchanged; Max path implemented in Phase 7 — for now telegram-only, max returns 404).
**Step 3:** `npm run type-check` for these files → passes.
**Step 4:** Commit.
```bash
git add backend/src/presentation/middleware/auth.ts backend/src/presentation/controllers/AuthController.ts backend/src/application/dto/auth.dto.ts
git commit -m "refactor(auth): middleware/controller use platform identity"
```

### Task 1.6: Sweep remaining `telegramId` references (services/controllers)

**Files:** whatever `grep -rn "telegramId\|findByTelegramId\|findOrCreateByTelegramId" backend/src` reports — likely `OnboardingRepository.ts`, `BookingController.ts`, `AdminBookingController.ts`, `AdminVoteController.ts`, `VoteService.ts`, bot files (bot files handled in Phase 3).

**Step 1:** Run the grep; list each call site.
**Step 2:** For each non-bot site, switch to `platform`/`platformId`. For OnboardingRepository, mirror the repo change (composite key). For controllers that read `req.user.telegramId`, use `req.user.platformId` (+ platform where a messenger send is implied — defer actual send routing to Phase 5).
**Step 3:** `npm run type-check` → passes for all non-`infrastructure/telegram` files (bot files still reference old names; they're refactored in Phase 3 — if they break the type-check, add a thin temporary shim OR proceed to Phase 3 before type-checking the whole project). To keep commits green, do Phase 3 Task 3.1 immediately after if needed.
**Step 4:** Commit.
```bash
git add -A backend/src
git commit -m "refactor: sweep telegramId -> platform/platformId across services and controllers"
```

---

## Phase 2 — Max Mini App auth

### Task 2.1: `validateMaxInitData`

**Files:**
- Create: `backend/src/shared/utils/max.ts`
- Test: `backend/src/shared/utils/__tests__/max.test.ts`

**Step 1 (confirm algorithm):** Using Task 0.2 findings + the Max docs (`https://dev.max.ru/docs/webapps/bridge`), pin the exact HMAC scheme. Working hypothesis to verify: data-check-string = params (excluding `hash`) sorted by key, joined by `\n` as `key=value`; secret = HMAC-SHA256(botToken) keyed by a constant, or HMAC directly with botToken. **Do not finalize until the algorithm matches a known-good signature** (generate one with a token and compare, or use the lib's own validator if present).
**Step 2 (test):** Write tests: (a) a correctly-signed payload validates and returns `{user:{id,first_name,...}, auth_date, hash, start_param}`; (b) tampered hash → null; (c) expired `auth_date` → null; (d) future `auth_date` → null; (e) missing hash → null. Build the valid fixture by signing with the confirmed algorithm so the test is self-consistent.
**Step 3:** `npm test -- max` → FAIL.
**Step 4:** Implement `validateMaxInitData(rawInitData, botToken, maxAge=3600, options?)` mirroring the structure of `shared/utils/telegram.ts` but with Max's algorithm and `MaxUser`/`MaxInitData` interfaces.
**Step 5:** `npm test -- max` → PASS.
**Step 6:** Commit.
```bash
git add backend/src/shared/utils/max.ts backend/src/shared/utils/__tests__/max.test.ts
git commit -m "feat(auth): validateMaxInitData for Max Mini App"
```

### Task 2.2: AuthService.authenticateWithMax + `/api/auth/max`

**Files:**
- Modify: `backend/src/domain/services/AuthService.ts`, `backend/src/presentation/controllers/AuthController.ts`, `backend/src/presentation/routes/auth.routes.ts`, `backend/src/application/dto/auth.dto.ts`, `backend/src/config/container.ts` (inject Max tokens).
- Test: extend `__tests__/AuthService.test.ts`.

**Step 1 (test):** Failing test: `authenticateWithMax(initData, startParam)` validates against Max user/admin tokens, calls `findOrCreateByIdentity({platform:'max',...})`, returns a token with `platform:'max'`.
**Step 2:** `npm test -- AuthService` → FAIL.
**Step 3:** Implement `authenticateWithMax` (mirror `authenticateWithTelegram`; tries `maxUserBotToken` then `maxAdminBotToken`). Constructor gains `maxAdminBotToken?`, `maxUserBotToken?`. Add controller `authenticateMax` and route `POST /api/auth/max`. Add zod DTO. Wire tokens in `container.ts` from env.
**Step 4:** `npm test -- AuthService` → PASS; `npm run type-check` → passes.
**Step 5:** Commit.
```bash
git add backend/src/domain/services/AuthService.ts backend/src/presentation/controllers/AuthController.ts backend/src/presentation/routes/auth.routes.ts backend/src/application/dto/auth.dto.ts backend/src/config/container.ts backend/src/domain/services/__tests__/AuthService.test.ts
git commit -m "feat(auth): POST /api/auth/max for Max Mini App login"
```

---

## Phase 3 — Messaging abstraction + Telegram adapter (no behavior change)

### Task 3.1: Define platform messaging contracts

**Files:**
- Create: `backend/src/infrastructure/messaging/types.ts` (`Platform` re-export, `PlatformBots` interface, shared payload types: `BroadcastPayload`, `BookingNotice`, `VotingWinnerNotice`, etc. — lift the shapes currently inlined in `botManager.ts`).
- Test: none (types only).

**Step 1:** Extract the payload interfaces from `botManager.ts` into `types.ts`. Define:
```ts
export interface PlatformBots {
  readonly platform: Platform;
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  // user-facing
  notifyNewUserToAdmins?(u: NewUserNotice): Promise<void>;
  sendBookingReceived(platformId: string, b: BookingNotice): Promise<void>;
  sendBookingConfirmation(platformId: string, b: BookingNotice): Promise<void>;
  sendReviewRequest(platformId: string, r: ReviewNotice): Promise<void>;
  sendVotingFollowUp(ids: string[], day: number): Promise<{sent:number;failed:number}>;
  sendVotingWinner(platformId: string, song: SongNotice, sessionId: string): Promise<void>;
  // admin-facing
  notifyNewBooking(b: NewBookingNotice): Promise<void>;
  notifyNewUser(u: NewUserNotice): Promise<void>;
  broadcast(ids: string[], payload: BroadcastPayload): Promise<{sent:number;failed:number}>;
  sendCsvToAdmin(platformId: string, csv: Buffer, filename: string): Promise<void>;
}
```
**Step 2:** `npm run type-check` → passes.
**Step 3:** Commit.
```bash
git add backend/src/infrastructure/messaging/types.ts
git commit -m "feat(messaging): platform-agnostic bot contracts"
```

### Task 3.2: Wrap Telegram bots as `TelegramBots: PlatformBots`

**Files:**
- Create: `backend/src/infrastructure/messaging/telegram/TelegramBots.ts`
- Modify: `backend/src/infrastructure/telegram/UserBot.ts`, `AdminBot.ts` (rename internal `telegramId` params to `platformId` where they are just the chat id string; no logic change).
- Test: `backend/src/infrastructure/messaging/telegram/__tests__/TelegramBots.test.ts`

**Step 1 (test):** Failing test: a `TelegramBots` instance (UserBot/AdminBot mocked) exposes `platform==='telegram'` and forwards `sendBookingReceived` to `userBot.sendBookingReceived`.
**Step 2:** `npm test -- TelegramBots` → FAIL.
**Step 3:** Implement the adapter delegating to existing `UserBot`/`AdminBot`. Keep the existing classes; the adapter just satisfies `PlatformBots`.
**Step 4:** `npm test -- TelegramBots` → PASS.
**Step 5:** Commit.
```bash
git add backend/src/infrastructure/messaging/telegram/ backend/src/infrastructure/telegram/
git commit -m "feat(messaging): TelegramBots adapter implementing PlatformBots"
```

### Task 3.3: Refactor `BotManager` to a platform registry

**Files:**
- Modify: `backend/src/infrastructure/telegram/botManager.ts` (or move to `src/infrastructure/messaging/botManager.ts` and re-export from old path to avoid touching `app.ts` imports yet).
- Test: `backend/src/infrastructure/messaging/__tests__/botManager.routing.test.ts`

**Step 1 (test):** Failing test: register two fake `PlatformBots` (telegram, max). `botManager.sendBookingReceived({platform:'max', platformId:'1'}, ...)` calls only the Max adapter. Same for telegram.
**Step 2:** `npm test -- botManager.routing` → FAIL.
**Step 3:** Implement: `BotManager` holds `Map<Platform, PlatformBots>`. `initialize()` constructs `TelegramBots` if Telegram tokens present (unchanged), and `MaxBots` if Max tokens present (Phase 4 supplies `MaxBots`; for now register only telegram + accept injected adapters in tests). Notification methods take the target's `platform` and dispatch. Broadcast/follow-up/winner split recipients by platform and fan out. Keep `getBotManager`/`setBotManager`.
**Step 4:** `npm test` (full) → PASS; `npm run type-check` → passes.
**Step 5:** Commit.
```bash
git add -A backend/src/infrastructure
git commit -m "refactor(messaging): BotManager routes notifications by platform"
```

---

## Phase 4 — Max bot adapters + long polling

### Task 4.1: Max API client wrapper + error mapping

**Files:**
- Create: `backend/src/infrastructure/messaging/max/maxClient.ts` (thin wrapper over `@maxhub/max-bot-api` `Bot` + `bot.api`), `backend/src/infrastructure/messaging/max/maxErrors.ts`.
- Test: `backend/src/infrastructure/messaging/max/__tests__/maxErrors.test.ts`

**Step 1 (test):** Failing test for `maxErrors.ts`: maps a "user blocked bot"/forbidden response to a typed `MaxSendError` with `isUserUnreachable===true`; rate-limit response → `shouldRetry===true`.
**Step 2:** `npm test -- maxErrors` → FAIL.
**Step 3:** Implement error mapping (mirror what `botManager.ts` does for Telegram failures; use the lib's `MaxError`). Implement `maxClient` exposing `sendMessage` (`bot.api.sendMessageToUser`), `sendMessageWithKeyboard` (via `Keyboard.inlineKeyboard` in `extra.attachments`), `uploadAndSendMedia` (`bot.api.uploadImage/uploadVideo/uploadFile` then attach), `answerCallback` (`bot.api.answerOnCallback`), `setMyCommands`, `getMe` (`bot.api.getMyInfo`), plus `start()`/`stop()` wrapping `bot.start()/bot.stop()`. No webhook methods (polling).
**Step 4:** `npm test -- maxErrors` → PASS.
**Step 5:** Commit.
```bash
git add backend/src/infrastructure/messaging/max/maxClient.ts backend/src/infrastructure/messaging/max/maxErrors.ts backend/src/infrastructure/messaging/max/__tests__/maxErrors.test.ts
git commit -m "feat(max): API client wrapper and error mapping"
```

### Task 4.2: MaxUserBot (handlers mirroring Telegram UserBot)

**Files:**
- Create: `backend/src/infrastructure/messaging/max/MaxUserBot.ts`
- Test: `backend/src/infrastructure/messaging/max/__tests__/MaxUserBot.test.ts`

**Step 1 (test):** Failing tests with a mocked `maxClient` + injected services for: `bot_started` with no payload → sends onboarding (who-are-you keyboard); with `vote_<id>` → sends mini-app open button to the voting URL; with a referral code → calls `referralService.handleLinkClick` with `Max:<userId>`. Onboarding callback persists via `onboardingRepository.findOrCreateByIdentity({platform:'max'})` and triggers `botManager.notifyNewUser`.
**Step 2:** `npm test -- MaxUserBot` → FAIL.
**Step 3:** Implement `MaxUserBot` mirroring `UserBot.ts` logic (same Russian copy, same Redis keys but namespaced `max:onb_pending:` / `max:pending_vote:`, same welcome video send via Max media upload). Reuse the same service objects. Implement the `PlatformBots` user-facing methods (`sendBookingReceived`, `sendBookingConfirmation`, `sendReviewRequest`, `sendVotingFollowUp`, `sendVotingWinner`).
**Step 4:** `npm test -- MaxUserBot` → PASS.
**Step 5:** Commit.
```bash
git add backend/src/infrastructure/messaging/max/MaxUserBot.ts backend/src/infrastructure/messaging/max/__tests__/MaxUserBot.test.ts
git commit -m "feat(max): MaxUserBot mirroring Telegram user flows"
```

### Task 4.3: MaxAdminBot (stats, broadcast, booking confirm/cancel)

**Files:**
- Create: `backend/src/infrastructure/messaging/max/MaxAdminBot.ts`
- Test: `backend/src/infrastructure/messaging/max/__tests__/MaxAdminBot.test.ts`

**Step 1 (test):** Failing tests: `/stats` replies with booking stats; booking-confirm callback (`booking_confirm:<id>`) triggers the confirm callback; broadcast flow assembles a `BroadcastPayload`; admin allow-list loaded from `users` where `role='admin' AND platform='max'`.
**Step 2:** `npm test -- MaxAdminBot` → FAIL.
**Step 3:** Implement mirroring `AdminBot.ts` (commands, broadcast wizard with buttons/media, booking notifications with confirm/cancel inline buttons, admin allow-list refresh, CSV send, admin-panel link). Implement `PlatformBots` admin-facing methods.
**Step 4:** `npm test -- MaxAdminBot` → PASS.
**Step 5:** Commit.
```bash
git add backend/src/infrastructure/messaging/max/MaxAdminBot.ts backend/src/infrastructure/messaging/max/__tests__/MaxAdminBot.test.ts
git commit -m "feat(max): MaxAdminBot mirroring Telegram admin flows"
```

### Task 4.4: MaxBots adapter + polling lifecycle

**Files:**
- Create: `backend/src/infrastructure/messaging/max/MaxBots.ts` (implements `PlatformBots`, owns user+admin `MaxUserBot`/`MaxAdminBot`).
- Modify: `backend/src/infrastructure/messaging/botManager.ts` (construct + register `MaxBots` when Max tokens present), `backend/src/config/container.ts` (read Max tokens/usernames). `app.ts` needs no new route — `BotManager.initialize()`/`stop()` already run on boot/shutdown.
- Test: `backend/src/infrastructure/messaging/max/__tests__/MaxBots.test.ts`

**Step 1 (test):** Failing tests: `MaxBots.platform==='max'`; `start()` calls `userBot.start()` + `adminBot.start()` and `setMyCommands`; `stop()` calls both `bot.stop()`; user-facing/admin-facing `PlatformBots` methods delegate to the right bot.
**Step 2:** `npm test -- MaxBots` → FAIL.
**Step 3:** Implement `MaxBots`: owns the two Max bots, `start()` registers commands then `bot.start({ allowedUpdates })` for each (non-blocking — `start()` loops internally; call without awaiting completion, like Telegram polling), `stop()` stops both. Register Max in `BotManager.initialize()` guarded by env presence (mirror the Telegram graceful-skip). Ensure `BotManager.stop()` stops Max bots too.
**Step 4:** `npm test -- MaxBots` → PASS; full `npm test` → PASS; `npm run type-check` → PASS.
**Step 5:** Commit.
```bash
git add -A backend/src
git commit -m "feat(max): MaxBots adapter with long-polling lifecycle"
```

---

## Phase 5 — Notification routing call sites

### Task 5.1: Route every notification by the target user's platform

**Files:** call sites found by `grep -rn "getBotManager\|botManager\." backend/src/presentation backend/src/domain` — `BookingController`, `AdminBookingController`, `AdminVoteController`, `VoteService`, `AuthService`.

**Step 1 (test):** For one representative site (e.g. `BookingController` new-booking), add/extend a test asserting the booking's user platform is passed through so admins on that platform get notified.
**Step 2:** `npm test` → FAIL for the new assertion.
**Step 3:** Update each call site to pass `{platform, platformId}` (load from the user/booking). `processScheduledVotingFollowUps` and `notifyVotingWinner`: group recipients by platform (the `VotingFollowUp` recipients JSON now carries platform — update `VoteService`/`OnboardingRepository` producers accordingly).
**Step 4:** `npm test` → PASS; `npm run type-check` → PASS.
**Step 5:** Commit.
```bash
git add -A backend/src
git commit -m "feat(messaging): route all notifications by user platform"
```

---

## Phase 6 — Deep links / QR per platform

### Task 6.1: Parameterize deep-link/QR builders

**Files:**
- Modify: `backend/src/infrastructure/utils/qrcode.ts`
- Test: `backend/src/infrastructure/utils/__tests__/qrcode.test.ts`

**Step 1 (test):** Failing tests: `buildDeepLink('telegram', bot, 'vote_x')` → `https://t.me/...`; `buildDeepLink('max', bot, 'vote_x')` → `https://max.ru/<bot>?start=vote_x` (and startapp variant). `generateVotingSessionQR(sessionId, {telegram, max})` returns a QR/deeplink per platform.
**Step 2:** `npm test -- qrcode` → FAIL.
**Step 3:** Implement platform param; add `normalizeMaxBotUsername`. Keep Telegram output identical to today.
**Step 4:** `npm test -- qrcode` → PASS.
**Step 5:** Update `AdminVoteController` to generate per-platform QR (telegram + max) and send each to admins via the routed bot. Re-run `npm test`.
**Step 6:** Commit.
```bash
git add backend/src/infrastructure/utils/qrcode.ts backend/src/infrastructure/utils/__tests__/qrcode.test.ts backend/src/presentation/controllers/AdminVoteController.ts
git commit -m "feat(max): per-platform deep links and voting QR"
```

---

## Phase 7 — Avatars

### Task 7.1: Platform-aware avatar endpoint

**Files:**
- Modify: `backend/src/presentation/controllers/AuthController.ts` (`getAvatar`), `AuthService.authenticateWithMax` (persist `photoUrl`).

**Step 1 (test):** Failing test: a Max user with stored `photoUrl` → `GET /api/auth/me/avatar` redirects/proxies to that URL; Telegram user path unchanged.
**Step 2:** `npm test` → FAIL.
**Step 3:** Implement: on Max auth, save `photoUrl` from initData. `getAvatar` branches on `req.user.platform`: telegram = existing proxy; max = proxy/redirect the stored `photoUrl` (404 if none).
**Step 4:** `npm test` → PASS.
**Step 5:** Commit.
```bash
git add backend/src/presentation/controllers/AuthController.ts backend/src/domain/services/AuthService.ts
git commit -m "feat(max): platform-aware avatar resolution"
```

---

## Phase 8 — Frontend platform adapter

### Task 8.1: Platform detection + facade

**Files:**
- Create: `frontend/src/platform/platform.ts` (`getPlatform(): 'telegram'|'max'|'web'`, unified `webApp` facade).
- Modify: keep `frontend/src/telegram/telegramWebApp.ts` as the Telegram backend of the facade; add `frontend/src/platform/maxWebApp.ts` wrapping `window.WebApp`.
- Test: `frontend/src/platform/__tests__/platform.test.ts` (jsdom; mock `window.Telegram`/`window.WebApp`).

**Step 1 (test):** Failing tests: detection picks `max` when `window.WebApp` present and `telegram` when `window.Telegram.WebApp` present; `getInitData()`/`getStartParam()`/`getUser()` delegate correctly.
**Step 2:** Run frontend tests (`cd frontend && npm test -- platform`) → FAIL. (If the frontend has no test runner, add one or write a node-based unit test; confirm `frontend/package.json` scripts first.)
**Step 3:** Implement the facade. Telegram methods reuse existing functions. Max methods: `initData` from `window.WebApp.initData`, `start_param` from `initDataUnsafe.start_param`, `openLink`/`openMaxLink`, `BackButton`, haptics → no-op if absent.
**Step 4:** Tests → PASS.
**Step 5:** Commit.
```bash
git add frontend/src/platform/ frontend/src/telegram/
git commit -m "feat(frontend): platform facade for Telegram and Max"
```

### Task 8.2: Load Max SDK + platform-aware init/auth

**Files:**
- Modify: `frontend/index.html` (add `<script src="https://st.max.ru/js/max-web-app.js">` alongside Telegram's), `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/admin/context/AdminAuthContext.tsx`.

**Step 1:** In `main.tsx`/`App.tsx`, replace `isInsideTelegram()`/`initTelegramWebApp()` with platform-facade equivalents that also init Max.
**Step 2:** Auth effect: call `/api/auth/telegram` or `/api/auth/max` based on `getPlatform()`, sending the facade `getInitData()`/`getStartParam()`. Same for admin context.
**Step 3:** Build the frontend: `cd frontend && npm run build` → succeeds. If a dev preview is feasible with a mocked `window.WebApp`, verify the Max branch picks `/api/auth/max` (see Verification phase).
**Step 4:** Commit.
```bash
git add frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/admin/context/AdminAuthContext.tsx
git commit -m "feat(frontend): init Max SDK and auth via platform-aware endpoint"
```

---

## Phase 9 — Config, docs, infra notes

### Task 9.1: Env templates + container wiring

**Files:** `.env.example`, `backend/.env.example`, `backend/src/config/container.ts` (confirm all Max env read here).

**Step 1:** Add documented vars: `MAX_USER_BOT_TOKEN`, `MAX_ADMIN_BOT_TOKEN`, `MAX_USER_BOT_USERNAME=id744719465529_bot`, `MAX_ADMIN_BOT_USERNAME=id744719465529_1_bot`. (No webhook secret / public URL — polling.) Note tokens are server-only and must be rotated (they were shared in chat).
**Step 2:** Commit.
```bash
git add .env.example backend/.env.example backend/src/config/container.ts
git commit -m "docs(config): document Max env vars"
```

### Task 9.2: Frame-embedding / CSP note (only if Max embeds via iframe)

**Files:** `frontend/nginx/nginx.conf` (+ `infra/host-nginx/vgulcover.ru.conf.example`) and any `helmet` CSP in `backend/src/app.ts`.

**Step 1:** Determine (during in-Max testing) whether the mini app loads in an iframe. If it does and `X-Frame-Options: SAMEORIGIN` blocks it, switch to `Content-Security-Policy: frame-ancestors https://*.max.ru` and remove the conflicting `X-Frame-Options` for the app routes.
**Step 2:** If no change is needed (Max uses a native webview), document that and skip. Commit only if changed.

---

## Phase 10 — Verification

### Task 10.1: Full backend gate
**Step 1:** `cd backend && npm run lint && npm run type-check && npm test && npm run build:dev` → all pass.
**Step 2:** `cd frontend && npm run build` → passes.

### Task 10.2: Polling + auth smoke (local)
**Step 1:** Start backend with Max test env (real or stub token). Confirm `BotManager.initialize()` starts the Max polling loop without throwing and `bot.stop()` runs cleanly on shutdown (check logs). Unit-level: a simulated `message_created`/`bot_started` ctx routed through the handlers triggers the expected service calls.
**Step 2:** POST a token-signed Max initData to `/api/auth/max` → returns a JWT with `platform:'max'`; a `users` row exists with `platform='max'`.

### Task 10.3: In-Max manual verification (requires verified org device)
- Open the mini app inside Max → auth succeeds, voting/booking screens work.
- `/start` the user bot → onboarding; deep link `https://max.ru/id744719465529_bot?start=vote_<id>` → opens voting.
- Admin bot `/stats`, broadcast, booking confirm/cancel.
- **State explicitly** which of these could and could not be verified (per @superpowers:verification-before-completion — no success claims without evidence).

### Task 10.4: Finish the branch
Use @superpowers:finishing-a-development-branch to decide merge/PR.

---

## Open items to confirm during implementation (from design doc)
1. Exact Max initData HMAC algorithm — Task 2.1 (security-critical).
2. Max mini-app `startapp` deep-link format and `open_app` button/app registration.
3. iframe embedding / CSP — Task 9.2.
4. ~~webhook surface~~ — resolved: lib is polling-only, using `bot.start()`.
5. Max media two-step `/uploads` and `web_app`-equivalent (`open_app`) buttons.
