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
 * @param month Optional month in format 'YYYY-MM', defaults to current month
 * @returns Array of available date numbers (1-31)
 */
export async function getAvailableDates(month?: string): Promise<number[]> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock: all dates except 12th are available
    const allDates = Array.from({ length: 31 }, (_, i) => i + 1);
    return allDates.filter(day => day !== 12);
  }

  try {
    const params = month ? `?month=${month}` : '';
    const response = await apiGet<{ availableDates: number[] }>(`/api/bookings/available-dates${params}`);
    return response.availableDates;
  } catch (error) {
    console.warn('Failed to fetch available dates from API, falling back to mock data', error);
    // Fallback: all dates except 12th
    const allDates = Array.from({ length: 31 }, (_, i) => i + 1);
    return allDates.filter(day => day !== 12);
  }
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
