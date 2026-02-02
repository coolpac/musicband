/**
 * CloudStorage Telegram Mini Apps — черновик заявки и полей формы.
 * Документация: https://core.telegram.org/bots/webapps#cloudstorage
 */

import { getTelegramWebApp } from './telegramWebApp';

const KEY_DRAFT = 'booking_draft';
const KEY_FORM = 'booking_form';

export type BookingDraftStorage = {
  formatId: string;
  bookingDate: string;
};

export type BookingFormStorage = {
  fullName?: string;
  contactType?: string;
  phoneNumber?: string;
  city?: string;
  source?: string;
};

function getStorage() {
  return getTelegramWebApp()?.CloudStorage ?? null;
}

function getItem(key: string): Promise<string | null> {
  const storage = getStorage();
  if (!storage) return Promise.resolve(null);
  return new Promise((resolve) => {
    storage.getItem(key, (err: string | null, value?: string) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(value ?? null);
    });
  });
}

function setItem(key: string, value: string): Promise<boolean> {
  const storage = getStorage();
  if (!storage) return Promise.resolve(false);
  return new Promise((resolve) => {
    storage.setItem(key, value, (err, success) => {
      resolve(!err && !!success);
    });
  });
}

function removeItem(key: string): Promise<boolean> {
  const storage = getStorage();
  if (!storage) return Promise.resolve(false);
  return new Promise((resolve) => {
    storage.removeItem(key, (err: string | null, success?: boolean) => {
      resolve(!err && !!success);
    });
  });
}

/** Загрузить черновик заявки (формат + дата) из облака. */
export async function getBookingDraftFromCloud(): Promise<BookingDraftStorage | null> {
  const raw = await getItem(KEY_DRAFT);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as BookingDraftStorage;
    if (data?.formatId && data?.bookingDate) return data;
  } catch {
    // ignore
  }
  return null;
}

/** Сохранить черновик заявки в облако. */
export async function setBookingDraftToCloud(draft: BookingDraftStorage): Promise<void> {
  await setItem(KEY_DRAFT, JSON.stringify(draft));
}

/** Загрузить поля формы заявки из облака (для префилла). */
export async function getBookingFormFromCloud(): Promise<BookingFormStorage | null> {
  const raw = await getItem(KEY_FORM);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as BookingFormStorage;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** Сохранить поля формы в облако (черновик полей). */
export async function setBookingFormToCloud(form: BookingFormStorage): Promise<void> {
  await setItem(KEY_FORM, JSON.stringify(form));
}

/** Удалить черновик заявки из облака. */
export async function clearBookingDraftFromCloud(): Promise<void> {
  await removeItem(KEY_DRAFT);
}

/** Удалить черновик полей формы из облака. */
export async function clearBookingFormFromCloud(): Promise<void> {
  await removeItem(KEY_FORM);
}

/** Удалить все данные черновика заявки из облака. */
export async function clearAllBookingFromCloud(): Promise<void> {
  await removeItem(KEY_DRAFT);
  await removeItem(KEY_FORM);
}
