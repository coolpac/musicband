import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import { CalendarDayCell } from '../components/CalendarDayCell';
import { SectionLoader } from '../components/SectionLoader';
import Modal from '../components/Modal';
import { ApiError } from '../../services/apiClient';
import {
  getAdminBookingCalendarCached,
  getAdminBlockedDatesCached,
  updateAdminBookingStatus,
  updateAdminBookingIncome,
  completeAdminBooking,
  blockDate as apiBlockDate,
  unblockDate as apiUnblockDate,
  type AdminBooking,
} from '../../services/adminBookingService';
import { getCached, CACHE_KEYS } from '../../services/adminDataCache';
import '../../styles/admin.css';
import './BookingsManagementScreen.css';

// Types (UI) — поля заявки (пользователь + админ + user из TG)
interface Booking {
  id: string;
  fullName: string;
  contactType: string | null;
  contactValue: string;
  bookingDate: string;
  formatId: string | null;
  formatName?: string;
  city?: string | null;
  source?: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  income?: number | null;
  createdAt: string;
  /** Username из Telegram (при заявке через Mini App) */
  telegramUsername?: string | null;
}

interface BlockedDate {
  id: string;
  date: string;
  reason?: string;
}

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isBlocked: boolean;
  hasBooking: boolean;
  booking?: Booking;
  isPast: boolean;
}

function mapApiBooking(b: AdminBooking): Booking {
  const bookingDate = typeof b.bookingDate === 'string' ? b.bookingDate.split('T')[0] : b.bookingDate;
  return {
    id: b.id,
    fullName: b.fullName,
    contactType: b.contactType ?? null,
    contactValue: b.contactValue,
    bookingDate,
    formatId: b.formatId,
    formatName: b.format?.name ?? undefined,
    city: b.city ?? undefined,
    source: b.source ?? undefined,
    status: b.status,
    income: b.income,
    createdAt: b.createdAt,
    telegramUsername: b.user?.username ?? null,
  };
}

type BookingsManagementScreenProps = {
  onGoToLog?: () => void;
};

function initialBookingsAndBlocked(monthStr: string): { bookings: Booking[]; blockedDates: BlockedDate[]; hasCache: boolean } {
  const cachedCalendar = getCached<{ dates: { date: string; bookings: AdminBooking[] }[] }>(CACHE_KEYS.ADMIN_CALENDAR(monthStr));
  const cachedBlocked = getCached<{ id: string; date: string; reason?: string }[]>(CACHE_KEYS.ADMIN_BLOCKED_DATES(monthStr));
  const bookings = (cachedCalendar?.dates ?? []).flatMap((d) => (d.bookings ?? []).map(mapApiBooking));
  const blockedDates = (cachedBlocked ?? []).map((b) => ({ id: b.id, date: b.date, reason: b.reason }));
  return { bookings, blockedDates, hasCache: !!(cachedCalendar && cachedBlocked) };
}

export default function BookingsManagementScreen({ onGoToLog }: BookingsManagementScreenProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthStr = useMemo(
    () => `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
    [currentDate]
  );
  const initial = useMemo(() => initialBookingsAndBlocked(monthStr), [monthStr]);
  const [bookings, setBookings] = useState<Booking[]>(initial.bookings);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>(initial.blockedDates);
  const [isLoading, setIsLoading] = useState(!initial.hasCache);
  const [completing, setCompleting] = useState(false);

  // Modal states
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [incomeEdit, setIncomeEdit] = useState('');
  const [incomeSaving, setIncomeSaving] = useState(false);

  const loadData = useCallback(async () => {
    const hasCache = !!(getCached(CACHE_KEYS.ADMIN_CALENDAR(monthStr)) && getCached(CACHE_KEYS.ADMIN_BLOCKED_DATES(monthStr)));
    if (!hasCache) setIsLoading(true);
    try {
      const [calendarRes, blockedRes] = await Promise.all([
        getAdminBookingCalendarCached(monthStr),
        getAdminBlockedDatesCached(monthStr),
      ]);

      const allBookings = (calendarRes.dates ?? []).flatMap((d) =>
        (d.bookings ?? []).map(mapApiBooking)
      );
      setBookings(allBookings);

      setBlockedDates(
        (blockedRes ?? []).map((b) => ({
          id: b.id,
          date: b.date,
          reason: b.reason,
        }))
      );
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Не удалось загрузить заявки. Проверьте авторизацию и бэкенд.');
    } finally {
      setIsLoading(false);
    }
  }, [monthStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const inited = initialBookingsAndBlocked(monthStr);
    setBookings(inited.bookings);
    setBlockedDates(inited.blockedDates);
    setIsLoading(!inited.hasCache);
  }, [monthStr]);

  const blockedDatesMap = useMemo(
    () => new Map(blockedDates.map((b) => [b.date, b] as const)),
    [blockedDates]
  );

  const bookingsMap = useMemo(
    () => new Map(bookings.map((b) => [b.bookingDate, b] as const)),
    [bookings]
  );

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createCalendarDay = (date: Date, isCurrentMonth: boolean): CalendarDay => {
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateString = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
      const booking = bookingsMap.get(dateString);
      const isBlocked = blockedDatesMap.has(dateString);
      const isPast = localDate < today;

      return {
        date: localDate,
        dateString,
        isCurrentMonth,
        isToday: localDate.getTime() === today.getTime(),
        isBlocked,
        hasBooking: !!booking,
        booking,
        isPast,
      };
    };

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: CalendarDay[] = [];

    const prevMonthLastDay = new Date(year, month, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay.getDate() - i);
      days.push(createCalendarDay(date, false));
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(createCalendarDay(date, true));
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push(createCalendarDay(date, false));
    }

    return days;
  }, [currentDate, blockedDatesMap, bookingsMap]);

  const handlePrevMonth = useCallback(() => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }, [currentDate]);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }, [currentDate]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleDayClick = useCallback((day: CalendarDay) => {
    // Прошедшие даты без заявки не редактируем (но заявку можно открыть для просмотра/дохода)
    if (day.isPast && !day.hasBooking) {
      toast.error('Нельзя редактировать прошедшие даты');
      return;
    }

    setSelectedDay(day);
    setBlockReason('');
    setIncomeEdit(day.booking?.income != null ? String(day.booking.income) : '');
    setShowDayModal(true);
  }, []);

  const handleToggleBlock = async () => {
    if (!selectedDay) return;

    try {
      if (selectedDay.isBlocked) {
        const blocked = blockedDatesMap.get(selectedDay.dateString);
        if (blocked) {
          await apiUnblockDate(blocked.id);
          toast.success('Дата разблокирована');
        }
      } else {
        await apiBlockDate(selectedDay.dateString, blockReason || undefined);
        toast.success('Дата заблокирована');
      }
      setShowDayModal(false);
      await loadData();
    } catch (error) {
      console.error('Error toggling block:', error);
      toast.error('Не удалось изменить блокировку даты');
    }
  };

  const handleUpdateStatus = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    try {
      await updateAdminBookingStatus(bookingId, status);
      toast.success('Статус обновлен');
      await loadData();
      const updated = bookings.find((b) => b.id === bookingId);
      if (selectedDay?.booking?.id === bookingId && updated) {
        setSelectedDay((prev) => prev ? { ...prev, booking: { ...prev.booking!, status } } : null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Не удалось обновить статус');
    }
  };

  const handleSaveIncome = async () => {
    if (!selectedDay?.booking) return;
    const num = incomeEdit.trim() === '' ? 0 : parseInt(incomeEdit.replace(/\s/g, ''), 10);
    if (Number.isNaN(num) || num < 0) {
      toast.error('Введите корректную сумму (число ≥ 0)');
      return;
    }
    setIncomeSaving(true);
    try {
      await updateAdminBookingIncome(selectedDay.booking.id, num);
      toast.success('Доход сохранён');
      setIncomeEdit(String(num));
      await loadData();
      setSelectedDay((prev) => prev && prev.booking ? { ...prev, booking: { ...prev.booking, income: num } } : null);
    } catch (error) {
      console.error('Error updating income:', error);
      toast.error('Не удалось сохранить доход');
    } finally {
      setIncomeSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedDay?.booking) return;
    if (selectedDay.booking.status !== 'confirmed') {
      toast.error('Сначала подтвердите заявку');
      return;
    }
    const num = incomeEdit.trim() === '' ? 0 : parseInt(incomeEdit.replace(/\s/g, ''), 10);
    if (Number.isNaN(num) || num < 0) {
      toast.error('Введите корректную сумму (число ≥ 0)');
      return;
    }

    if (!window.confirm('Отметить как выполнено? Будет записан доход и пользователю отправится кнопка для отзыва.')) {
      return;
    }

    setCompleting(true);
    try {
      const res = await completeAdminBooking(selectedDay.booking.id, num);
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
      setShowDayModal(false);
      await loadData();
    } catch (error) {
      console.error('Error completing booking:', error);
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
      setCompleting(false);
    }
  };

  const monthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const blockedDateForSelected = useMemo(
    () => (selectedDay ? blockedDatesMap.get(selectedDay.dateString) ?? null : null),
    [selectedDay, blockedDatesMap]
  );

  return (
    <div className="admin-screen bookings-screen">
      <AdminHeader />

      <div className="admin-content">
        <h1 className="admin-title">Управление бронями</h1>

        {onGoToLog && (
          <div className="bookings-nav-strip">
            <p className="bookings-nav-strip__text">Заявки и блокировки по датам — в календаре ниже.</p>
            <button type="button" className="bookings-nav-strip__btn" onClick={onGoToLog}>
              <span className="bookings-nav-strip__btn-icon">📋</span>
              К логу заявок
            </button>
          </div>
        )}

        {/* Calendar — каркас всегда, данные подгружаются без блокировки */}
        <div className="modern-calendar">
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={handlePrevMonth}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="calendar-title">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>

            <button className="calendar-nav-btn" onClick={handleNextMonth}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button className="calendar-today-btn" onClick={handleToday}>
              Сегодня
            </button>
          </div>

          <div className="calendar-weekdays">
            {weekDays.map((day) => (
              <div key={day} className="calendar-weekday">
                {day}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="calendar-section-loading">
              <SectionLoader label="Загрузка календаря…" />
            </div>
          ) : (
          <div className="calendar-grid">
            {calendarDays.map((day) => (
              <CalendarDayCell key={day.dateString} day={day} onDayClick={handleDayClick} />
            ))}
          </div>
          )}

          <div className="calendar-legend">
            <div className="legend-item">
              <span className="legend-dot legend-dot--confirmed"></span>
              <span>Подтверждено</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot legend-dot--pending"></span>
              <span>В ожидании</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot legend-dot--blocked"></span>
              <span>Заблокировано</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      <Modal
        isOpen={showDayModal}
        onClose={() => setShowDayModal(false)}
        title={selectedDay ? `${selectedDay.date.getDate()} ${monthNames[selectedDay.date.getMonth()]} ${selectedDay.date.getFullYear()}` : ''}
        size="lg"
      >
        {selectedDay && (
          <div className="day-modal">
            {/* If has booking */}
            {selectedDay.hasBooking && selectedDay.booking && (
              <div className="booking-details">
                <section className="booking-details__section">
                  <h3 className="booking-details__section-title">Данные от пользователя</h3>
                  <div className="booking-detail-group">
                    <label>ФИО</label>
                    <span>{selectedDay.booking.fullName}</span>
                  </div>
                  <div className="booking-detail-group">
                    <label>Контакт</label>
                    <span>{selectedDay.booking.contactValue}</span>
                  </div>
                  {selectedDay.booking.telegramUsername && (
                    <div className="booking-detail-group">
                      <label>Username (TG)</label>
                      <span>@{selectedDay.booking.telegramUsername}</span>
                    </div>
                  )}
                  {selectedDay.booking.contactType && (
                    <div className="booking-detail-group">
                      <label>Тип контакта</label>
                      <span>{selectedDay.booking.contactType}</span>
                    </div>
                  )}
                  <div className="booking-detail-group">
                    <label>Формат</label>
                    <span>{selectedDay.booking.formatName || 'Не указан'}</span>
                  </div>
                  {selectedDay.booking.city && (
                    <div className="booking-detail-group">
                      <label>Город</label>
                      <span>{selectedDay.booking.city}</span>
                    </div>
                  )}
                  {selectedDay.booking.source && (
                    <div className="booking-detail-group">
                      <label>Источник</label>
                      <span>{selectedDay.booking.source}</span>
                    </div>
                  )}
                  <div className="booking-detail-group">
                    <label>Дата заявки</label>
                    <span>{selectedDay.booking.createdAt ? new Date(selectedDay.booking.createdAt).toLocaleString('ru-RU') : '—'}</span>
                  </div>
                </section>

                <section className="booking-details__section">
                  <h3 className="booking-details__section-title">Админ</h3>
                  <div className="booking-detail-group booking-detail-group--income">
                    <label>Доход (вписывает админ), ₽</label>
                    <div className="booking-income-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="admin-form-input booking-income-input"
                        value={incomeEdit}
                        onChange={(e) => setIncomeEdit(e.target.value.replace(/[^\d\s]/g, ''))}
                        placeholder="0"
                        aria-label="Доход в рублях"
                      />
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary"
                        onClick={handleSaveIncome}
                        disabled={incomeSaving}
                      >
                        {incomeSaving ? 'Сохранение…' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                  <div className="booking-detail-group">
                    <label>Статус</label>
                    <span className={`booking-status booking-status--${selectedDay.booking.status}`}>
                      {selectedDay.booking.status === 'confirmed' && 'Подтверждено'}
                      {selectedDay.booking.status === 'pending' && 'В ожидании'}
                      {selectedDay.booking.status === 'cancelled' && 'Отменено'}
                    </span>
                  </div>

                  <div className="booking-actions">
                    {selectedDay.booking.status === 'pending' && (
                      <button className="admin-btn admin-btn--success" onClick={() => handleUpdateStatus(selectedDay.booking!.id, 'confirmed')}>
                        Подтвердить
                      </button>
                    )}
                    {selectedDay.booking.status === 'confirmed' && (
                      <button
                        className="admin-btn admin-btn--success"
                        onClick={handleComplete}
                        disabled={incomeSaving || completing}
                      >
                        {completing ? 'Выполнение…' : 'Выполнено'}
                      </button>
                    )}
                    {selectedDay.booking.status !== 'cancelled' && (
                      <button className="admin-btn admin-btn--danger" onClick={() => handleUpdateStatus(selectedDay.booking!.id, 'cancelled')}>
                        Отменить
                      </button>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* If blocked */}
            {selectedDay.isBlocked && !selectedDay.hasBooking && (
              <div className="blocked-info">
                <p className="blocked-message">🚫 Эта дата заблокирована для бронирований</p>
                {blockedDateForSelected?.reason && (
                  <div className="booking-detail-group">
                    <label>Причина:</label>
                    <span>{blockedDateForSelected.reason}</span>
                  </div>
                )}
              </div>
            )}

            {/* Block/Unblock controls */}
            {!selectedDay.hasBooking && (
              <div className="block-controls">
                {!selectedDay.isBlocked && (
                  <div className="admin-form-group">
                    <label className="admin-form-label">Причина блокировки (необязательно)</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Например: Личные дела"
                    />
                  </div>
                )}

                <button
                  className={`admin-btn admin-btn--full ${selectedDay.isBlocked ? 'admin-btn--secondary' : 'admin-btn--danger'}`}
                  onClick={handleToggleBlock}
                >
                  {selectedDay.isBlocked ? 'Разблокировать дату' : 'Заблокировать дату'}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
