import { useSyncExternalStore } from 'react';
import { trackGoal } from '../seo/analytics';

/**
 * The booking flow's tiny store.
 *
 * Three real URLs (/booking, /booking/form, /booking/success) have to survive a refresh, the
 * back button and a mis-tap on a link, so the step data lives in `sessionStorage` rather than
 * in React state. It is per-tab and dies with the tab — exactly right for a half-filled form,
 * and it never leaks a visitor's phone number into a shared device's localStorage.
 *
 * SSR safety: the server snapshot is a frozen constant, so the server and the hydrating client
 * render the same empty flow. React swaps in the restored state right after hydration.
 */

const STORAGE_KEY = 'vgul_booking_v1';
const DRAFT_PERSIST_DELAY = 400;

export interface BookingDraft {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  formatId: string;
  comment: string;
}

export interface SubmittedBooking {
  id: string;
  bookingDate: string;
  bookingTime: string | null;
  /** true only for the dev-mode mock submit — never set in a production bundle. */
  mock?: boolean;
}

export interface BookingState {
  /** «YYYY-MM-DD» */
  date: string | null;
  /** «HH:mm» */
  time: string | null;
  draft: BookingDraft;
  /**
   * When the visitor first opened the anketa, as Date.now(). It is persisted rather than kept in
   * the component because the server's spam trap rejects anything filled in under 2.5 seconds:
   * without this, refreshing the form and submitting a restored draft would look like a bot.
   */
  formStartedAt: number | null;
  submitted: SubmittedBooking | null;
}

export const EMPTY_DRAFT: BookingDraft = {
  fullName: '',
  phone: '',
  email: '',
  city: '',
  formatId: '',
  comment: '',
};

const EMPTY_STATE: BookingState = {
  date: null,
  time: null,
  draft: EMPTY_DRAFT,
  formStartedAt: null,
  submitted: null,
};

let state: BookingState = EMPTY_STATE;
let restored = false;
const listeners = new Set<() => void>();

/* ── persistence ─────────────────────────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readNullableString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Stored JSON is user-editable and may be stale: every field is re-validated, never trusted. */
function parseStored(raw: string): BookingState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const draftRaw = isRecord(parsed.draft) ? parsed.draft : {};
  const submittedRaw = isRecord(parsed.submitted) ? parsed.submitted : null;

  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date)) ? String(parsed.date) : null,
    time: /^\d{2}:\d{2}$/.test(String(parsed.time)) ? String(parsed.time) : null,
    draft: {
      fullName: readString(draftRaw.fullName),
      phone: readString(draftRaw.phone),
      email: readString(draftRaw.email),
      city: readString(draftRaw.city),
      formatId: readString(draftRaw.formatId),
      comment: readString(draftRaw.comment),
    },
    formStartedAt:
      typeof parsed.formStartedAt === 'number' && Number.isFinite(parsed.formStartedAt) && parsed.formStartedAt > 0
        ? parsed.formStartedAt
        : null,
    submitted:
      submittedRaw && typeof submittedRaw.id === 'string' && typeof submittedRaw.bookingDate === 'string'
        ? {
            id: submittedRaw.id,
            bookingDate: submittedRaw.bookingDate,
            bookingTime: readNullableString(submittedRaw.bookingTime),
            ...(submittedRaw.mock === true ? { mock: true as const } : {}),
          }
        : null,
  };
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota: the flow still works, it just stops surviving a refresh */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistSoon(): void {
  if (typeof window === 'undefined') return;
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persist();
  }, DRAFT_PERSIST_DELAY);
}

/** Write a pending debounced draft out now — before navigating away or unloading. */
export function flushBookingState(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persist();
}

/* ── store plumbing ──────────────────────────────────────────── */

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): BookingState {
  if (!restored && typeof window !== 'undefined') {
    restored = true;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      const next = raw ? parseStored(raw) : null;
      if (next) state = next;
    } catch {
      /* storage blocked — stay on the empty state */
    }
  }
  return state;
}

function getServerSnapshot(): BookingState {
  return EMPTY_STATE;
}

/** Imperative read, for effects and submit handlers that must not subscribe. */
export function readBookingState(): BookingState {
  return getSnapshot();
}

function update(patch: Partial<BookingState>, immediate: boolean): void {
  state = { ...getSnapshot(), ...patch };
  if (immediate) flushBookingState();
  else persistSoon();
  emit();
}

/* ── writes ──────────────────────────────────────────────────── */

let startedReported = false;

export function setBookingDate(date: string | null): void {
  if (getSnapshot().date === date) return;
  if (date && !startedReported) {
    startedReported = true;
    trackGoal('booking_started');
  }
  update({ date }, true);
}

export function setBookingTime(time: string | null): void {
  if (getSnapshot().time === time) return;
  update({ time }, true);
}

/** Called on every keystroke: the write is debounced, the in-memory value is not. */
export function setBookingDraft(draft: BookingDraft): void {
  update({ draft }, false);
}

/** Starts the «how long was this form open» clock, once per flow. */
export function markBookingFormOpened(): void {
  if (getSnapshot().formStartedAt !== null) return;
  update({ formStartedAt: Date.now() }, true);
}

export function setSubmittedBooking(submitted: SubmittedBooking): void {
  update({ submitted }, true);
}

/**
 * Called once the confirmation is on screen. The submitted result stays so a refresh of
 * /booking/success still shows it; everything the visitor typed is dropped.
 */
export function clearBookingInput(): void {
  const current = getSnapshot();
  if (current.date === null && current.time === null && current.draft === EMPTY_DRAFT && current.formStartedAt === null) {
    return;
  }
  // A second booking from the same tab is a new funnel: let `booking_started` fire again.
  startedReported = false;
  update({ date: null, time: null, draft: EMPTY_DRAFT, formStartedAt: null }, true);
}

/* ── hooks ───────────────────────────────────────────────────── */
/*
 * Selector hooks, not one `useBookingState()`: the form writes the draft on every keystroke and
 * a whole-state subscription would re-render the page each time. Every selector below returns a
 * primitive or a stable object reference, which is what useSyncExternalStore requires.
 */

export function useBookingDate(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().date,
    () => EMPTY_STATE.date
  );
}

export function useBookingTime(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().time,
    () => EMPTY_STATE.time
  );
}

export function useSubmittedBooking(): SubmittedBooking | null {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().submitted,
    () => EMPTY_STATE.submitted
  );
}
