import { Prisma } from '@prisma/client';
import {
  BookingListItem,
  BookingListUser,
  BookingOrigin,
} from '../../infrastructure/database/repositories/BookingRepository';

/**
 * Строка списка `GET /api/admin/bookings`.
 *
 * Поля перечислены явно, а не через spread: список заявок — публичный контракт
 * админ-панели, и новая колонка в БД не должна утекать в ответ сама собой.
 * `user` равен null у заявок с сайта — контакт берётся из самой заявки
 * (`contactValue`, `email`), а не из Telegram-профиля.
 */
export interface AdminBookingDto {
  id: string;
  userId: string | null;
  formatId: string | null;
  bookingDate: Date;
  bookingTime: string | null;
  fullName: string;
  contactType: string | null;
  contactValue: string;
  email: string | null;
  comment: string | null;
  city: string | null;
  source: string | null;
  origin: BookingOrigin;
  income: Prisma.Decimal | null;
  status: BookingListItem['status'];
  createdAt: Date;
  updatedAt: Date;
  user: BookingListUser | null;
  format: BookingListItem['format'];
}

export function toAdminBookingDto(booking: BookingListItem): AdminBookingDto {
  return {
    id: booking.id,
    userId: booking.userId,
    formatId: booking.formatId,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    fullName: booking.fullName,
    contactType: booking.contactType,
    contactValue: booking.contactValue,
    email: booking.email,
    comment: booking.comment,
    city: booking.city,
    source: booking.source,
    origin: booking.origin === 'website' ? 'website' : 'miniapp',
    income: booking.income,
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    user: booking.user,
    format: booking.format,
  };
}
