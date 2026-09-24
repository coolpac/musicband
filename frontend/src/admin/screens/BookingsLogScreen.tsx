import { Fragment, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import { ApiError, formatApiErrorMessage } from '../../services/apiClient';
import {
  getAdminBookingsCached,
  updateAdminBookingStatus,
  updateAdminBookingIncome,
  completeAdminBooking,
  deleteAdminBooking,
  normalizeBookingOrigin,
  BOOKING_ORIGIN_LABELS,
  type AdminBooking,
  type BookingOrigin,
} from '../../services/adminBookingService';
import { getCached, CACHE_KEYS } from '../../services/adminDataCache';
import { IconCheck, IconX, IconTrash } from '../assets/icons';
import { openTelegramLink, hapticImpact } from '../../telegram/telegramWebApp';
import '../../styles/admin.css';
import './BookingsLogScreen.css';

/** Колонок в таблице — нужно для colSpan строки с подробностями. */
const TABLE_COLUMN_COUNT = 13;

interface BookingRow {
  id: string;
  fullName: string;
  contactType: string | null;
  contactValue: string;
  bookingDate: string;
  /** 'HH:mm' — заполняется только заявками с сайта. */
  bookingTime: string | null;
  formatName?: string;
  city?: string | null;
  source?: string | null;
  status: AdminBooking['status'];
  createdAt: string;
  /** Username из Telegram (при заявке через Mini App) */
  telegramUsername?: string | null;
  income?: number | null;
  email: string | null;
  comment: string | null;
  origin: BookingOrigin;
}

function coerceIncome(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function mapApiBooking(b: AdminBooking): BookingRow {
  const bookingDate = typeof b.bookingDate === 'string' ? b.bookingDate.split('T')[0] : b.bookingDate;
  return {
    id: b.id,
    fullName: b.fullName,
    contactType: b.contactType ?? null,
    contactValue: b.contactValue,
    bookingDate,
    bookingTime: typeof b.bookingTime === 'string' && b.bookingTime ? b.bookingTime : null,
    formatName: b.format?.name ?? undefined,
    city: b.city ?? null,
    source: b.source ?? null,
    status: b.status,
    createdAt: b.createdAt,
    telegramUsername: b.user?.username ?? null,
    income: coerceIncome(b.income),
    email: typeof b.email === 'string' && b.email ? b.email : null,
    comment: typeof b.comment === 'string' && b.comment.trim() ? b.comment.trim() : null,
    origin: normalizeBookingOrigin(b.origin),
  };
}

export type BookingsLogStatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';
export type BookingsLogOriginFilter = 'all' | BookingOrigin;

type BookingsLogScreenProps = {
  onGoToCalendar?: () => void;
  /** При переходе с дашборда по карточке — сразу показать этот фильтр */
  initialStatusFilter?: BookingsLogStatusFilter | null;
  /** Вызвать после применения initialStatusFilter, чтобы не сбрасывать фильтр при следующем открытии лога */
  onConsumeInitialFilter?: () => void;
  /** Стартовый фильтр по источнику: во вкладке «Сайт» лог открывается сразу на заявках с сайта. */
  initialOriginFilter?: BookingsLogOriginFilter;
};

function sortedRows(res: { bookings?: AdminBooking[] }): BookingRow[] {
  return (res.bookings ?? [])
    .map(mapApiBooking)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function BookingsLogScreen({
  onGoToCalendar,
  initialStatusFilter = null,
  onConsumeInitialFilter,
  initialOriginFilter = 'all',
}: BookingsLogScreenProps) {
  const cached = getCached<{ bookings: AdminBooking[]; total: number }>(CACHE_KEYS.ADMIN_BOOKINGS_LIST);
  const [list, setList] = useState<BookingRow[]>(cached ? sortedRows(cached) : []);
  const [loading, setLoading] = useState(!cached);
  const [statusFilter, setStatusFilter] = useState<BookingsLogStatusFilter>(initialStatusFilter ?? 'all');
  const [originFilter, setOriginFilter] = useState<BookingsLogOriginFilter>(initialOriginFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeEditValue, setIncomeEditValue] = useState('');
  const [savingIncomeId, setSavingIncomeId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialStatusFilter != null) onConsumeInitialFilter?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount to clear initial filter

  const loadList = async () => {
    if (!getCached(CACHE_KEYS.ADMIN_BOOKINGS_LIST)) setLoading(true);
    try {
      const res = await getAdminBookingsCached({ limit: 200 });
      setList(sortedRows(res));
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

  // Источник фильтруем локально: список уже загружен целиком, лишний запрос не нужен.
  const originList =
    originFilter === 'all' ? list : list.filter((b) => b.origin === originFilter);

  const filteredList =
    statusFilter === 'all'
      ? originList
      : originList.filter((b) => b.status === statusFilter);

  const counts = {
    all: originList.length,
    pending: originList.filter((b) => b.status === 'pending').length,
    confirmed: originList.filter((b) => b.status === 'confirmed').length,
    cancelled: originList.filter((b) => b.status === 'cancelled').length,
  };

  const originCounts = {
    all: list.length,
    miniapp: list.filter((b) => b.origin === 'miniapp').length,
    website: list.filter((b) => b.origin === 'website').length,
  };

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
        errorMessage = formatApiErrorMessage(error);
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

        {/* Фильтр по источнику заявки: приложение или сайт */}
        {!loading && list.length > 0 && (
          <div className="bookings-log-filters bookings-log-filters--origin" role="group" aria-label="Фильтр по источнику заявок">
            {(
              [
                { key: 'all' as const, label: 'Все источники', count: originCounts.all },
                { key: 'miniapp' as const, label: BOOKING_ORIGIN_LABELS.miniapp, count: originCounts.miniapp },
                { key: 'website' as const, label: BOOKING_ORIGIN_LABELS.website, count: originCounts.website },
              ] as const
            ).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                className={`bookings-log-filter-chip bookings-log-origin-chip ${
                  originFilter === key ? 'bookings-log-filter-chip--active bookings-log-origin-chip--active' : ''
                }`}
                onClick={() => setOriginFilter(key)}
                aria-pressed={originFilter === key}
                aria-label={`${label}: ${count} заявок`}
              >
                <span className="bookings-log-filter-chip__label">{label}</span>
                <span className="bookings-log-filter-chip__count" aria-hidden>{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Фильтр по статусу: чипы с счётчиками */}
        {!loading && list.length > 0 && (
          <div className="bookings-log-filters" role="group" aria-label="Фильтр по статусу заявок">
            {(
              [
                { key: 'all' as const, label: 'Все', count: counts.all },
                { key: 'pending' as const, label: 'В ожидании', count: counts.pending },
                { key: 'confirmed' as const, label: 'Подтверждено', count: counts.confirmed },
                { key: 'cancelled' as const, label: 'Отменено', count: counts.cancelled },
              ] as const
            ).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                className={`bookings-log-filter-chip ${statusFilter === key ? 'bookings-log-filter-chip--active' : ''} bookings-log-filter-chip--${key}`}
                onClick={() => setStatusFilter(key)}
                aria-pressed={statusFilter === key}
                aria-label={`${label}: ${count} заявок`}
              >
                <span className="bookings-log-filter-chip__label">{label}</span>
                <span className="bookings-log-filter-chip__count" aria-hidden>{count}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="admin-loading">Загрузка списка...</div>
        ) : list.length === 0 ? (
          <div className="bookings-log__empty">Нет заявок</div>
        ) : originFilter !== 'all' && originList.length === 0 ? (
          <div className="bookings-log__empty">
            Нет заявок из источника «{BOOKING_ORIGIN_LABELS[originFilter]}»
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bookings-log__empty">
            Нет заявок со статусом «
            {statusFilter === 'pending' && 'В ожидании'}
            {statusFilter === 'confirmed' && 'Подтверждено'}
            {statusFilter === 'cancelled' && 'Отменено'}
            »
          </div>
        ) : (
          <div className="bookings-log-table-wrap bookings-log-table-wrap--scroll" aria-label="Таблица заявок">
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
                  <th>Откуда</th>
                  <th>Формат</th>
                  <th>Доход</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((b) => {
                  const hasDetails = Boolean(b.bookingTime || b.email || b.comment);
                  const isExpanded = expandedId === b.id;
                  return (
                    <Fragment key={b.id}>
                    <tr>
                      <td>{b.createdAt ? new Date(b.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                      <td>
                        {b.bookingDate}
                        {b.bookingTime && (
                          <span className="bookings-log-time">{b.bookingTime}</span>
                        )}
                      </td>
                      <td>{b.fullName}</td>
                      <td>
                        {b.telegramUsername ? (
                          <button
                            type="button"
                            className="bookings-log-tg-link"
                            onClick={() => {
                              hapticImpact('light');
                              openTelegramLink(`https://t.me/${b.telegramUsername}`);
                            }}
                            aria-label={`Открыть @${b.telegramUsername} в Telegram`}
                          >
                            @{b.telegramUsername}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {b.contactValue}
                        {b.email && (
                          <a className="bookings-log-email" href={`mailto:${b.email}`}>
                            {b.email}
                          </a>
                        )}
                      </td>
                      <td>{b.contactType || '—'}</td>
                      <td>{b.city || '—'}</td>
                      <td>{b.source || '—'}</td>
                      <td>
                        <span className={`bookings-log-origin bookings-log-origin--${b.origin}`}>
                          {BOOKING_ORIGIN_LABELS[b.origin]}
                        </span>
                      </td>
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
                          {hasDetails && (
                            <button
                              type="button"
                              className={`bookings-log-action-btn bookings-log-details-btn ${
                                isExpanded ? 'bookings-log-details-btn--open' : ''
                              }`}
                              onClick={() => setExpandedId(isExpanded ? null : b.id)}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Скрыть подробности заявки' : 'Показать подробности заявки'}
                              title="Подробности: время, e-mail, комментарий"
                            >
                              <span className="bookings-log-details-chevron" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {hasDetails && isExpanded && (
                      <tr className="bookings-log-details-row">
                        <td colSpan={TABLE_COLUMN_COUNT}>
                          <dl className="bookings-log-details">
                            {b.bookingTime && (
                              <div className="bookings-log-details__item">
                                <dt>Время</dt>
                                <dd>{b.bookingTime}</dd>
                              </div>
                            )}
                            {b.email && (
                              <div className="bookings-log-details__item">
                                <dt>E-mail</dt>
                                <dd>
                                  <a className="bookings-log-email" href={`mailto:${b.email}`}>
                                    {b.email}
                                  </a>
                                </dd>
                              </div>
                            )}
                            {b.comment && (
                              <div className="bookings-log-details__item bookings-log-details__item--wide">
                                <dt>Комментарий</dt>
                                <dd>{b.comment}</dd>
                              </div>
                            )}
                          </dl>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
