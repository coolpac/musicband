import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import { ApiError } from '../../services/apiClient';
import {
  getAdminBookings,
  updateAdminBookingStatus,
  updateAdminBookingIncome,
  completeAdminBooking,
  deleteAdminBooking,
  type AdminBooking,
} from '../../services/adminBookingService';
import { IconCheck, IconX, IconTrash } from '../assets/icons';
import '../../styles/admin.css';
import './BookingsLogScreen.css';

interface BookingRow {
  id: string;
  fullName: string;
  contactType: string | null;
  contactValue: string;
  bookingDate: string;
  formatName?: string;
  city?: string | null;
  source?: string | null;
  status: AdminBooking['status'];
  createdAt: string;
  /** Username из Telegram (при заявке через Mini App) */
  telegramUsername?: string | null;
  income?: number | null;
}

function mapApiBooking(b: AdminBooking): BookingRow {
  const bookingDate = typeof b.bookingDate === 'string' ? b.bookingDate.split('T')[0] : b.bookingDate;
  return {
    id: b.id,
    fullName: b.fullName,
    contactType: b.contactType ?? null,
    contactValue: b.contactValue,
    bookingDate,
    formatName: b.format?.name ?? undefined,
    city: b.city ?? null,
    source: b.source ?? null,
    status: b.status,
    createdAt: b.createdAt,
    telegramUsername: b.user?.username ?? null,
    income: b.income ?? null,
  };
}

type BookingsLogScreenProps = {
  onGoToCalendar?: () => void;
};

export default function BookingsLogScreen({ onGoToCalendar }: BookingsLogScreenProps) {
  const [list, setList] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeEditValue, setIncomeEditValue] = useState('');
  const [savingIncomeId, setSavingIncomeId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await getAdminBookings({ limit: 200 });
      const rows = (res.bookings ?? [])
        .map(mapApiBooking)
        // «Лог» = показываем самые новые заявки сверху (по времени создания)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setList(rows);
    } catch (error) {
      console.error('Failed to load bookings log:', error);
      setList([]);
      toast.error('Не удалось загрузить лог заявок. Проверьте авторизацию и бэкенд.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleUpdateStatus = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    setUpdatingId(bookingId);
    try {
      await updateAdminBookingStatus(bookingId, status);
      toast.success('Статус обновлен');
      await loadList();
    } catch {
      toast.error('Не удалось обновить статус');
    } finally {
      setUpdatingId(null);
    }
  };

  const startEditIncome = (b: BookingRow) => {
    setEditingIncomeId(b.id);
    setIncomeEditValue(b.income != null ? String(b.income) : '');
  };

  const cancelEditIncome = () => {
    setEditingIncomeId(null);
    setIncomeEditValue('');
  };

  const handleSaveIncome = async (bookingId: string) => {
    const num = incomeEditValue.trim() === '' ? 0 : parseInt(incomeEditValue.replace(/\s/g, ''), 10);
    if (Number.isNaN(num) || num < 0) {
      toast.error('Введите корректную сумму (число ≥ 0)');
      return;
    }
    setSavingIncomeId(bookingId);
    try {
      await updateAdminBookingIncome(bookingId, num);
      toast.success('Доход сохранён');
      setEditingIncomeId(null);
      setIncomeEditValue('');
      await loadList();
    } catch {
      toast.error('Не удалось сохранить доход');
    } finally {
      setSavingIncomeId(null);
    }
  };

  const handleComplete = async (b: BookingRow) => {
    if (b.status !== 'confirmed') return;
    if (b.income == null) {
      toast.error('Сначала укажите доход (✎), затем нажмите «Выполнено».');
      startEditIncome(b);
      return;
    }

    if (!window.confirm('Отметить как выполнено? Будет записан доход и пользователю отправится кнопка для отзыва.')) {
      return;
    }

    setCompletingId(b.id);
    try {
      const res = await completeAdminBooking(b.id, b.income);
      if (res.reviewRequestSent === false) {
        const details = res.reviewRequestError?.message
          ? `${res.reviewRequestError.code ? `${res.reviewRequestError.code}: ` : ''}${res.reviewRequestError.message}`
          : (res.reviewRequestError?.code === 403
            ? '403: пользователь не писал UserBot или заблокировал бота'
            : '');
        toast.success(
          details
            ? `Отмечено как выполнено. Форма отзыва не отправлена (${details}).`
            : 'Отмечено как выполнено. Форма отзыва не отправлена.'
        );
      } else {
        toast.success('Отмечено как выполнено. Пользователю отправлена форма отзыва.');
      }
      await loadList();
    } catch (error) {
      console.error('Complete booking failed:', error);
      let errorMessage = 'Неизвестная ошибка';
      if (error instanceof ApiError) {
        const code =
          (error.data && typeof error.data === 'object' && 'error' in error.data && (error.data as any).error?.code)
            ? String((error.data as any).error.code)
            : undefined;
        errorMessage = `${error.message}${code ? ` (${code})` : ''}${error.statusCode ? ` [${error.statusCode}]` : ''}`;
      } else if (error instanceof Error) {
        errorMessage =
          error.name === 'AbortError'
            ? 'Таймаут запроса (сервер долго отвечает). Попробуйте ещё раз.'
            : (error.message || 'Неизвестная ошибка');
      }
      toast.error(`Не удалось отметить как выполнено: ${errorMessage}`);
    } finally {
      setCompletingId(null);
    }
  };

  const handleDelete = async (b: BookingRow) => {
    if (!window.confirm(`Удалить заявку от ${b.fullName} (${b.bookingDate})? Это действие нельзя отменить.`)) {
      return;
    }
    setDeletingId(b.id);
    try {
      await deleteAdminBooking(b.id);
      toast.success('Заявка удалена');
      await loadList();
    } catch {
      toast.error('Не удалось удалить заявку');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-screen bookings-log-screen">
      <AdminHeader />
      <div className="admin-content">
        <h1 className="admin-title">Лог заявок</h1>
        {onGoToCalendar && (
          <div className="bookings-nav-strip">
            <button type="button" className="bookings-nav-strip__btn" onClick={onGoToCalendar}>
              <span className="bookings-nav-strip__btn-icon">📅</span>
              К календарю заявок
            </button>
          </div>
        )}

        {loading ? (
          <div className="admin-loading">Загрузка списка...</div>
        ) : list.length === 0 ? (
          <div className="bookings-log__empty">Нет заявок</div>
        ) : (
          <div className="bookings-log-table-wrap">
            <table className="bookings-log-table">
              <thead>
                <tr>
                  <th>Дата заявки</th>
                  <th>Дата брони</th>
                  <th>ФИО</th>
                  <th>TG</th>
                  <th>Контакт</th>
                  <th>Тип контакта</th>
                  <th>Город</th>
                  <th>Источник</th>
                  <th>Формат</th>
                  <th>Доход</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id}>
                    <td>{b.createdAt ? new Date(b.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                    <td>{b.bookingDate}</td>
                    <td>{b.fullName}</td>
                    <td>{b.telegramUsername ? `@${b.telegramUsername}` : '—'}</td>
                    <td>{b.contactValue}</td>
                    <td>{b.contactType || '—'}</td>
                    <td>{b.city || '—'}</td>
                    <td>{b.source || '—'}</td>
                    <td>{b.formatName || '—'}</td>
                    <td className="bookings-log-table__income">
                      {editingIncomeId === b.id ? (
                        <div className="bookings-log-income-edit">
                          <input
                            type="text"
                            inputMode="numeric"
                            className="admin-form-input bookings-log-income-input"
                            value={incomeEditValue}
                            onChange={(e) => setIncomeEditValue(e.target.value.replace(/[^\d\s]/g, ''))}
                            placeholder="0"
                            aria-label="Доход, ₽"
                          />
                          <button
                            type="button"
                            className="admin-btn admin-btn--small admin-btn--secondary"
                            onClick={() => handleSaveIncome(b.id)}
                            disabled={savingIncomeId === b.id}
                          >
                            {savingIncomeId === b.id ? '…' : 'Ок'}
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--small admin-btn--secondary"
                            onClick={cancelEditIncome}
                            disabled={savingIncomeId === b.id}
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <span className="bookings-log-income-cell">
                          {b.income != null && b.income > 0 ? (
                            <>
                              {b.income.toLocaleString('ru-RU')} ₽
                              <button
                                type="button"
                                className="bookings-log-income-edit-btn"
                                onClick={() => startEditIncome(b)}
                                aria-label="Изменить доход"
                                title="Изменить доход"
                              >
                                ✎
                              </button>
                            </>
                          ) : (
                            <>
                              —
                              <button
                                type="button"
                                className="bookings-log-income-edit-btn"
                                onClick={() => startEditIncome(b)}
                                aria-label="Вписать доход"
                                title="Вписать доход"
                              >
                                ✎
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`booking-status booking-status--${b.status}`}>
                        {b.status === 'confirmed' && 'Подтверждено'}
                        {b.status === 'pending' && 'В ожидании'}
                        {b.status === 'cancelled' && 'Отменено'}
                      </span>
                    </td>
                    <td className="bookings-log-table__actions">
                      <div className="bookings-log-actions" role="group" aria-label="Действия по заявке">
                        {b.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="bookings-log-action-btn bookings-log-action-btn--success"
                              onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                              disabled={updatingId === b.id}
                              aria-label="Подтвердить заявку"
                              title="Подтвердить"
                            >
                              {updatingId === b.id ? <span className="bookings-log-action-dots">…</span> : <IconCheck size={18} />}
                            </button>
                            <button
                              type="button"
                              className="bookings-log-action-btn bookings-log-action-btn--danger"
                              onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                              disabled={updatingId === b.id}
                              aria-label="Отменить заявку"
                              title="Отменить"
                            >
                              <IconX size={18} />
                            </button>
                          </>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            type="button"
                            className="bookings-log-action-btn bookings-log-action-btn--success"
                            onClick={() => handleComplete(b)}
                            disabled={completingId === b.id || deletingId === b.id || updatingId === b.id}
                            aria-label="Выполнено: записать доход и попросить отзыв"
                            title="Выполнено (доход + отзыв)"
                          >
                            {completingId === b.id ? <span className="bookings-log-action-dots">…</span> : '✓✓'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="bookings-log-action-btn bookings-log-action-btn--ghost-danger"
                          onClick={() => handleDelete(b)}
                          disabled={deletingId === b.id || updatingId === b.id || completingId === b.id}
                          aria-label="Удалить заявку"
                          title="Удалить (спам)"
                        >
                          {deletingId === b.id ? <span className="bookings-log-action-dots">…</span> : <IconTrash size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
