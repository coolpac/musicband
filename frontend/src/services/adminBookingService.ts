/**
 * Admin API для заявок (бронирований). Заявки — данные из формы пользователя.
 * При VITE_USE_MOCK=true или ошибке API подставляются мок-данные для просмотра интерфейса.
 */

import { apiGet, apiPost, apiPut, apiDelete, isMockMode } from './apiClient';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type AdminBooking = {
  id: string;
  userId: string;
  formatId: string | null;
  bookingDate: string;
  fullName: string;
  contactType: string | null;
  contactValue: string;
  city: string | null;
  source: string | null;
  income: number | null;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  format?: { id: string; name: string } | null;
  user?: { id: string; telegramId?: number; username?: string; firstName?: string; lastName?: string } | null;
};

export type AdminBookingStats = {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  totalIncome: number;
  conversionRate: number;
};

export type AdminBlockedDate = {
  id: string;
  date: string;
  reason?: string;
};

export type CalendarDate = {
  date: string;
  bookings: AdminBooking[];
  formats: Array<{ id: string; name: string }>;
};

const BASE = '/api/admin/bookings';

/** Мок-заявки для просмотра интерфейса (как заполнили пользователи) */
const MOCK_BOOKINGS: AdminBooking[] = [
  {
    id: 'mock-1',
    userId: 'u1',
    formatId: 'f1',
    bookingDate: '2026-01-15',
    fullName: 'Иван Петров',
    contactType: 'Физлицо',
    contactValue: '+7 999 123-45-67',
    city: 'Москва',
    source: 'Личная рекомендация',
    income: 75000,
    status: 'confirmed',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-12T14:00:00Z',
    format: { id: 'f1', name: 'Дуэт' },
    user: { id: 'u1', telegramId: 111, username: 'ivan_p' },
  },
  {
    id: 'mock-2',
    userId: 'u2',
    formatId: 'f2',
    bookingDate: '2026-01-22',
    fullName: 'Мария Сидорова',
    contactType: 'Организатор',
    contactValue: '@maria_s',
    city: 'Санкт-Петербург',
    source: 'Социальные сети',
    income: null,
    status: 'pending',
    createdAt: '2026-01-18T14:30:00Z',
    updatedAt: '2026-01-18T14:30:00Z',
    format: { id: 'f2', name: 'Соло' },
    user: { id: 'u2', telegramId: 222, username: 'maria_s' },
  },
  {
    id: 'mock-3',
    userId: 'u3',
    formatId: 'f1',
    bookingDate: '2026-01-28',
    fullName: 'Алексей Козлов',
    contactType: 'Агентство',
    contactValue: 'alex@agency.ru',
    city: 'Казань',
    source: 'Таргет',
    income: 50000,
    status: 'confirmed',
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-01-21T11:00:00Z',
    format: { id: 'f1', name: 'Дуэт' },
    user: { id: 'u3', telegramId: 333, username: 'alex_agency' },
  },
  {
    id: 'mock-4',
    userId: 'u4',
    formatId: 'f1',
    bookingDate: '2026-02-14',
    fullName: 'Елена Новикова',
    contactType: 'Физлицо',
    contactValue: '+7 916 555-12-34',
    city: 'Москва',
    source: 'Поиск',
    income: null,
    status: 'pending',
    createdAt: '2026-01-25T12:00:00Z',
    updatedAt: '2026-01-25T12:00:00Z',
    format: { id: 'f1', name: 'Дуэт' },
    user: { id: 'u4', telegramId: 444, username: 'elena_n' },
  },
  {
    id: 'mock-5',
    userId: 'u5',
    formatId: 'f2',
    bookingDate: '2026-02-20',
    fullName: 'Дмитрий Волков',
    contactType: 'Организатор',
    contactValue: '@dvolk',
    city: null,
    source: 'Мероприятие',
    income: 60000,
    status: 'confirmed',
    createdAt: '2026-01-28T09:00:00Z',
    updatedAt: '2026-01-29T16:00:00Z',
    format: { id: 'f2', name: 'Соло' },
    user: { id: 'u5', telegramId: 555, username: 'dvolk' },
  },
];

const MOCK_STATS: AdminBookingStats = {
  total: 28,
  confirmed: 15,
  pending: 12,
  cancelled: 1,
  totalIncome: 425000,
  conversionRate: 53.57,
};

const MOCK_BLOCKED_DATES: AdminBlockedDate[] = [
  { id: 'b1', date: '2026-01-10', reason: 'Личные дела' },
  { id: 'b2', date: '2026-02-10', reason: 'Выходной' },
];

function buildMockCalendar(month: string): { dates: CalendarDate[] } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const dates: CalendarDate[] = [];
  const formats = [{ id: 'f1', name: 'Дуэт' }, { id: 'f2', name: 'Соло' }];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayBookings = MOCK_BOOKINGS.filter((b) => b.bookingDate === dateStr);
    dates.push({ date: dateStr, bookings: dayBookings, formats });
  }
  return { dates };
}

export async function getAdminBookings(params?: {
  date?: string;
  status?: BookingStatus;
  page?: number;
  limit?: number;
}): Promise<{ bookings: AdminBooking[]; total: number }> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 200));
    return { bookings: MOCK_BOOKINGS, total: MOCK_BOOKINGS.length };
  }
  try {
    const search = new URLSearchParams();
    if (params?.date) search.set('date', params.date);
    if (params?.status) search.set('status', params.status);
    if (params?.page != null) search.set('page', String(params.page));
    if (params?.limit != null) search.set('limit', String(params.limit));
    const q = search.toString();
    return await apiGet<{ bookings: AdminBooking[]; total: number }>(q ? `${BASE}?${q}` : BASE);
  } catch {
    return { bookings: MOCK_BOOKINGS, total: MOCK_BOOKINGS.length };
  }
}

export async function getAdminBookingStats(): Promise<AdminBookingStats> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 150));
    return MOCK_STATS;
  }
  try {
    return await apiGet<AdminBookingStats>(`${BASE}/stats`);
  } catch {
    return MOCK_STATS;
  }
}

export async function getAdminBookingCalendar(month?: string): Promise<{ dates: CalendarDate[] }> {
  const monthStr = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 200));
    return buildMockCalendar(monthStr);
  }
  try {
    const url = month ? `${BASE}/calendar?month=${encodeURIComponent(month)}` : `${BASE}/calendar`;
    return await apiGet<{ dates: CalendarDate[] }>(url);
  } catch {
    return buildMockCalendar(monthStr);
  }
}

export async function getAdminBlockedDates(month?: string): Promise<AdminBlockedDate[]> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 100));
    if (month) {
      const prefix = month + '-';
      return MOCK_BLOCKED_DATES.filter((b) => b.date.startsWith(prefix));
    }
    return MOCK_BLOCKED_DATES;
  }
  try {
    const url = month ? `${BASE}/blocked-dates?month=${encodeURIComponent(month)}` : `${BASE}/blocked-dates`;
    return await apiGet<AdminBlockedDate[]>(url);
  } catch {
    if (month) {
      const prefix = month + '-';
      return MOCK_BLOCKED_DATES.filter((b) => b.date.startsWith(prefix));
    }
    return MOCK_BLOCKED_DATES;
  }
}

export async function updateAdminBookingStatus(
  id: string,
  status: 'confirmed' | 'cancelled'
): Promise<{ booking: AdminBooking }> {
  const res = await apiPut<{ booking: AdminBooking }>(`${BASE}/${id}/status`, { status });
  return res;
}

export async function updateAdminBookingIncome(
  id: string,
  income: number
): Promise<{ booking: AdminBooking }> {
  return apiPut<{ booking: AdminBooking }>(`${BASE}/${id}/income`, { income });
}

export async function blockDate(date: string, reason?: string): Promise<{ blockedDate: AdminBlockedDate }> {
  return apiPost<{ blockedDate: AdminBlockedDate }>(`${BASE}/block-date`, { date, reason });
}

export async function unblockDate(id: string): Promise<void> {
  await apiDelete<void>(`${BASE}/block-date/${id}`);
}

/** Удалить заявку (например, спам). Необратимо. */
export async function deleteAdminBooking(id: string): Promise<void> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 150));
    return;
  }
  await apiDelete<void>(`${BASE}/${id}`);
}
