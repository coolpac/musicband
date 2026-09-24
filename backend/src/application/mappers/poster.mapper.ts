import { Poster } from '@prisma/client';
import { formatDateInTimezone } from '../../shared/utils/timezone';

/**
 * Афиша в виде, пригодном для JSON: `eventDate` — календарная дата `YYYY-MM-DD`,
 * а не ISO-момент времени (колонка `@db.Date`, времени у неё нет).
 */
export interface PosterDto {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  link: string | null;
  order: number;
  eventDate: string | null;
  venue: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPosterDto(poster: Poster): PosterDto {
  return {
    id: poster.id,
    title: poster.title,
    description: poster.description,
    imageUrl: poster.imageUrl,
    link: poster.link,
    order: poster.order,
    // Prisma отдаёт @db.Date как UTC-полночь; форматируем в UTC, чтобы не сдвинуть день
    eventDate: poster.eventDate ? formatDateInTimezone(poster.eventDate, 'UTC') : null,
    venue: poster.venue,
    createdAt: poster.createdAt,
    updatedAt: poster.updatedAt,
  };
}
