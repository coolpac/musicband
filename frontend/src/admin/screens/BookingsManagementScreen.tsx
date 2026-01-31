import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import {
  getAdminBookingCalendar,
  getAdminBlockedDates,
  updateAdminBookingStatus,
  updateAdminBookingIncome,
  blockDate as apiBlockDate,
  unblockDate as apiUnblockDate,
  type AdminBooking,
} from '../../services/adminBookingService';
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

export default function BookingsManagementScreen({ onGoToLog }: BookingsManagementScreenProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [incomeEdit, setIncomeEdit] = useState('');
  const [incomeSaving, setIncomeSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [calendarRes, blockedRes] = await Promise.all([
        getAdminBookingCalendar(monthStr),
        getAdminBlockedDates(monthStr),
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
  };

  // Генерация календаря
  const generateCalendar = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Первый день месяца
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // День недели первого дня (0 = воскресенье, нужно преобразовать в понедельник = 0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Воскресенье

    const days: CalendarDay[] = [];

    // Добавляем дни предыдущего месяца
    const prevMonthLastDay = new Date(year, month, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay.getDate() - i);
      days.push(createCalendarDay(date, false));
    }

    // Добавляем дни текущего месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(createCalendarDay(date, true));
    }

    // Добавляем дни следующего месяца чтобы заполнить последнюю неделю
    const remainingDays = 42 - days.length; // 6 недель * 7 дней
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push(createCalendarDay(date, false));
    }

    return days;
  };

  const createCalendarDay = (date: Date, isCurrentMonth: boolean): CalendarDay => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const dateString = date.toISOString().split('T')[0];
    const isBlocked = blockedDates.some((b) => b.date === dateString);
    const booking = bookings.find((b) => b.bookingDate === dateString);
    const isPast = date < today;

    return {
      date,
      dateString,
      isCurrentMonth,
      isToday: date.getTime() === today.getTime(),
      isBlocked,
      hasBooking: !!booking,
      booking,
      isPast,
    };
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (day: CalendarDay) => {
    if (day.isPast) {
      toast.error('Нельзя редактировать прошедшие даты');
      return;
    }

    setSelectedDay(day);
    setBlockReason('');
    setIncomeEdit(day.booking?.income != null ? String(day.booking.income) : '');
    setShowDayModal(true);
  };

  const handleToggleBlock = async () => {
    if (!selectedDay) return;

    try {
      if (selectedDay.isBlocked) {
        const blocked = blockedDates.find((b) => b.date === selectedDay!.dateString);
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

  const calendarDays = generateCalendar();

  if (isLoading) {
    return (
      <div className="admin-screen">
        <AdminHeader />
        <div className="admin-content">
          <div className="admin-loading">Загрузка...</div>
        </div>
      </div>
    );
  }

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

        {/* Calendar */}
        <div className="modern-calendar">
          {/* Header */}
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

          {/* Week days */}
          <div className="calendar-weekdays">
            {weekDays.map((day) => (
              <div key={day} className="calendar-weekday">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="calendar-grid">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                className={`calendar-day ${!day.isCurrentMonth ? 'calendar-day--other-month' : ''} ${
                  day.isToday ? 'calendar-day--today' : ''
                } ${day.isBlocked ? 'calendar-day--blocked' : ''} ${day.hasBooking ? 'calendar-day--booked' : ''} ${
                  day.isPast ? 'calendar-day--past' : ''
                }`}
                onClick={() => handleDayClick(day)}
                disabled={day.isPast}
              >
                <span className="calendar-day__number">{day.date.getDate()}</span>
                {day.hasBooking && day.booking && (
                  <span className={`calendar-day__status calendar-day__status--${day.booking.status}`}>
                    {day.booking.status === 'confirmed' && '✓'}
                    {day.booking.status === 'pending' && '⏳'}
                    {day.booking.status === 'cancelled' && '✗'}
                  </span>
                )}
                {day.isBlocked && <span className="calendar-day__blocked-icon">🚫</span>}
              </button>
            ))}
          </div>

          {/* Legend */}
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
                {blockedDates.find((b) => b.date === selectedDay.dateString)?.reason && (
                  <div className="booking-detail-group">
                    <label>Причина:</label>
                    <span>{blockedDates.find((b) => b.date === selectedDay.dateString)?.reason}</span>
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
