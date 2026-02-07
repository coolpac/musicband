import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import { SectionLoader } from '../components/SectionLoader';
import {
  getAdminReviewsCached,
  getMockReviewsPayload,
  deleteAdminReview,
  type AdminReview,
} from '../../services/adminReviewsService';
import { getCached, CACHE_KEYS } from '../../services/adminDataCache';
import { IconTrash } from '../assets/icons';
import '../../styles/admin.css';
import './ReviewsManagementScreen.css';

function displayName(review: AdminReview): string {
  const u = review.user;
  if (!u) return '—';
  const parts = [u.firstName, u.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return u.username ? `@${u.username}` : '—';
}

const limit = 20;

export default function ReviewsManagementScreen() {
  const cachedPage1 = getCached<{ reviews: AdminReview[]; total: number }>(CACHE_KEYS.ADMIN_REVIEWS(1, limit));
  const [reviews, setReviews] = useState<AdminReview[]>(cachedPage1?.reviews ?? []);
  const [total, setTotal] = useState(cachedPage1?.total ?? 0);
  const [loading, setLoading] = useState(!cachedPage1);
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadReviews = async () => {
    const cached = getCached<{ reviews: AdminReview[]; total: number }>(CACHE_KEYS.ADMIN_REVIEWS(page, limit));
    if (!cached) setLoading(true);
    try {
      const res = await getAdminReviewsCached({ page, limit });
      const list = res.reviews ?? [];
      const fallback = getMockReviewsPayload({ page, limit });
      setReviews(list.length > 0 ? list : fallback.reviews);
      setTotal(list.length > 0 ? res.total : fallback.total);
    } catch {
      const fallback = getMockReviewsPayload({ page, limit });
      setReviews(fallback.reviews);
      setTotal(fallback.total);
      toast.error('Не удалось загрузить отзывы. Показаны демо-данные.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [page]);

  useEffect(() => {
    const c = getCached<{ reviews: AdminReview[]; total: number }>(CACHE_KEYS.ADMIN_REVIEWS(page, limit));
    if (c) {
      setReviews(c.reviews);
      setTotal(c.total);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [page]);

  const handleDelete = async (review: AdminReview) => {
    if (!window.confirm(`Удалить отзыв от ${displayName(review)}?`)) return;
    setDeletingId(review.id);
    try {
      await deleteAdminReview(review.id);
      toast.success('Отзыв удалён');
      await loadReviews();
    } catch {
      toast.error('Не удалось удалить отзыв');
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="admin-screen reviews-screen">
      <AdminHeader />
      <div className="admin-content">
        <h1 className="admin-title">Отзывы</h1>
        <p className="reviews-screen__desc">
          Отзывы пользователей. Можно удалить спам или неподходящий контент.
        </p>

        {loading ? (
          <div className="reviews-section-loading">
            <SectionLoader label="Загрузка отзывов…" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="reviews-empty">Нет отзывов</div>
        ) : (
          <>
            <ul className="reviews-list" role="list">
              {reviews.map((review) => (
                <li key={review.id} className="reviews-card">
                  <div className="reviews-card__header">
                    <div className="reviews-card__meta">
                      <span className="reviews-card__author">{displayName(review)}</span>
                      <span className="reviews-card__date">
                        {new Date(review.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div className="reviews-card__rating" aria-label={`Оценка: ${review.rating} из 5`}>
                      {'★'.repeat(review.rating)}
                      <span className="reviews-card__rating-out-of">/ 5</span>
                    </div>
                  </div>
                  {review.text && (
                    <p className="reviews-card__text">{review.text}</p>
                  )}
                  <div className="reviews-card__actions">
                    <button
                      type="button"
                      className="reviews-delete-btn"
                      onClick={() => handleDelete(review)}
                      disabled={deletingId === review.id}
                      title="Удалить отзыв"
                      aria-label="Удалить отзыв"
                    >
                      {deletingId === review.id ? '…' : <IconTrash size={18} />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="reviews-pagination">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Назад
                </button>
                <span className="reviews-pagination__info">
                  {page} из {totalPages} ({total} всего)
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Вперёд
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
