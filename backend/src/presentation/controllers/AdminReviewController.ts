import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../../domain/services/ReviewService';

export class AdminReviewController {
  constructor(private reviewService: ReviewService) {}

  /**
   * GET /api/admin/reviews
   * Получить все отзывы (с фильтрами)
   */
  async getAllReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;

      const result = await this.reviewService.getAllReviews({
        page,
        limit,
        rating,
      });

      res.json({
        success: true,
        data: {
          reviews: result.reviews,
          total: result.total,
          page,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/reviews/:id
   * Удалить отзыв
   */
  async deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await this.reviewService.deleteReview(id);

      res.json({
        success: true,
        message: 'Review deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
