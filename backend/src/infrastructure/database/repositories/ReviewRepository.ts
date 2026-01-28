import { PrismaClient, Review } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IReviewRepository {
  findAll(options?: FindReviewsOptions): Promise<{ reviews: Review[]; total: number }>;
  findById(id: string): Promise<Review | null>;
  findByUserId(userId: string): Promise<Review[]>;
  create(data: CreateReviewData): Promise<Review>;
  delete(id: string): Promise<void>;
}

export interface FindReviewsOptions {
  page?: number;
  limit?: number;
  rating?: number;
  userId?: string;
}

export interface CreateReviewData {
  userId: string;
  rating: number;
  text?: string;
}

export class PrismaReviewRepository implements IReviewRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(options?: FindReviewsOptions): Promise<{ reviews: Review[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const where: {
      rating?: number;
      userId?: string;
    } = {};
    if (options?.rating) {
      where.rating = options.rating;
    }
    if (options?.userId) {
      where.userId = options.userId;
    }

    const [reviews, total] = await Promise.all([
      this.client.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.client.review.count({ where }),
    ]);

    return { reviews, total };
  }

  async findById(id: string): Promise<Review | null> {
    return this.client.review.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string): Promise<Review[]> {
    return this.client.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateReviewData): Promise<Review> {
    return this.client.review.create({
      data: {
        userId: data.userId,
        rating: data.rating,
        text: data.text,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.review.delete({
      where: { id },
    });
  }
}
