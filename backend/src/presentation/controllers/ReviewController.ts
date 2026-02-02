import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../../domain/services/ReviewService';
import { CreateReviewDto } from '../../application/dto/review.dto';
import { logger } from '../../shared/utils/logger';

export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  /**
   * GET /api/reviews
   * Получить список отзывов (публичный)
   */
  async getReviews(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviews = await this.reviewService.getReviews();
      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reviews
   * Создать отзыв
   */
  async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const data = req.body as CreateReviewDto;
      const review = await this.reviewService.createReview(req.user.userId, data);

      logger.info('Review created', {
        reviewId: review.id,
        userId: req.user.userId,
      });

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }
}
