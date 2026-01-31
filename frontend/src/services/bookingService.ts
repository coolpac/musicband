import { apiGet, apiPost, isMockMode } from './apiClient';

export type BookingData = {
  formatId: string;
  bookingDate: string;
  fullName: string;
  contactType?: string;
  contactValue: string;
  city?: string;
  source?: string;
};

/**
 * Get available dates for a given month
 * @param month Month in format 'YYYY-MM'
 * @returns Array of available day-of-month numbers (1-31)
 */
export async function getAvailableDates(month?: string): Promise<number[]> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const allDates = Array.from({ length: 31 }, (_, i) => i + 1);
    return allDates.filter((day) => day !== 12);
  }

  const params = month ? `?month=${encodeURIComponent(month)}` : '';
  const data = await apiGet<{ dates: string[]; blockedDates: string[] }>(
    `/api/bookings/available-dates${params}`
  );
  // Backend returns dates as 'YYYY-MM-DD'; extract day of month for calendar
  return (data.dates ?? []).map((d) => parseInt(d.split('-')[2], 10));
}

/**
 * Create a new booking
 */
export async function createBooking(data: BookingData): Promise<void> {
  if (isMockMode()) {
    console.log('[Mock] Creating booking:', data);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  try {
    await apiPost<void>('/api/bookings', data);
  } catch (error) {
    console.error('Failed to create booking:', error);
    throw error;
  }
}
