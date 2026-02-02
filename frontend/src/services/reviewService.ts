import { apiPost, isMockMode } from './apiClient';

export type ReviewData = {
  rating: number;
  text?: string;
};

/**
 * Submit a review
 */
export async function submitReview(data: ReviewData): Promise<void> {
  if (isMockMode()) {
    // [Mock] Submitting review
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  try {
    await apiPost<void>('/api/reviews', data);
  } catch (error) {
    console.error('Failed to submit review:', error);
    throw error;
  }
}
