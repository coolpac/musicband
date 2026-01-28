import { IReviewRepository, FindReviewsOptions } from '../../infrastructure/database/repositories/ReviewRepository';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { LIMITS } from '../../shared/constants';

export class ReviewService {
  constructor(
    private reviewRepository: IReviewRepository,
    private userRepository: IUserRepository
  ) {}

  async getAllReviews(options?: FindReviewsOptions) {
    return this.reviewRepository.findAll(options);
  }

  async getReviewById(id: string) {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundError('Review');
    }
    return review;
  }

  async createReview(userId: string, data: { rating: number; text?: string }) {
    // Проверяем пользователя
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Валидация рейтинга
    if (data.rating < 1 || data.rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5');
    }

    // Валидация текста
    if (data.text && data.text.length > LIMITS.MAX_REVIEW_TEXT_LENGTH) {
      throw new ValidationError(`Review text cannot exceed ${LIMITS.MAX_REVIEW_TEXT_LENGTH} characters`);
    }

    const review = await this.reviewRepository.create({
      userId,
      rating: data.rating,
      text: data.text,
    });

    logger.info('Review created', {
      reviewId: review.id,
      userId,
      rating: data.rating,
    });

    return review;
  }

  async deleteReview(id: string) {
    await this.getReviewById(id);
    await this.reviewRepository.delete(id);

    logger.info('Review deleted', { reviewId: id });
  }

  async getUserReviews(userId: string) {
    return this.reviewRepository.findByUserId(userId);
  }
}
