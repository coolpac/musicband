import { motion } from 'framer-motion';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { hapticImpact, hapticNotification, hapticSelection } from '../telegram/telegramWebApp';
import { getBookingFormFromCloud, setBookingFormToCloud, clearBookingFormFromCloud, type BookingFormStorage } from '../telegram/cloudStorage';
import '../styles/date.css';
import '../styles/request.css';
import { getAvailableDates } from '../services/bookingService';
import { getFormatsForBooking } from '../services/formatService';
import type { Format } from '../types/format';
import NetworkError from '../components/NetworkError';
import navBg from '../assets/figma/downloaded/nav-bg.webp';
import navTitle from '../assets/figma/downloaded/nav-title.svg';
import selectChevron from '../assets/figma/downloaded/select-chevron.svg';
import monthPrev from '../assets/figma/downloaded/month-prev.svg';
import monthNext from '../assets/figma/downloaded/month-next.svg';
import requestLogo from '../assets/figma/downloaded/request-logo.svg';
import requestAnna from '../assets/figma/downloaded/request-anna.webp';

const months = [
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

const contactOptions = ['Организатор', 'Агентство', 'Физлицо'];
const sourceOptions = [
  'Социальные сети',
  'Таргет',
  'Личная рекомендация',
  'Мероприятие',
  'Телевидение',
  'Поиск',
];

type RequestSelectSize = 'format' | 'contact' | 'source';

type RequestSelectProps = {
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  options: string[];
  placeholder: string;
  size: RequestSelectSize;
  value: string;
};

function RequestSelect({
  className,
  isOpen,
  onToggle,
  onSelect,
  options,
  placeholder,
  size,
  value,
}: RequestSelectProps) {
  const menuHeight = size === 'format' ? 235 : size === 'contact' ? 175 : 265;
  const wrapperClassName = [
    'request-select-wrapper',
    `request-select-wrapper--${size}`,
    isOpen ? 'is-open' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const currentLabel = value || placeholder;

  return (
    <div
      className={wrapperClassName}
      style={{ '--menu-height': `${menuHeight}px` } as React.CSSProperties}
    >
      <button
        className="request-select"
        type="button"
        aria-expanded={isOpen}
        onClick={() => { hapticImpact('light'); onToggle(); }}
      >
        <span className={`request-select__value${value ? ' is-selected' : ''}`}>
          {currentLabel}
        </span>
        <img alt="" src={selectChevron} />
      </button>
      {isOpen && (
        <div className={`request-select-menu request-select-menu--${size}`}>
          <button
            className="request-select-menu__header"
            type="button"
            onClick={() => { hapticImpact('light'); onToggle(); }}
          >
            <span className={`request-select__value${value ? ' is-selected' : ''}`}>
              {currentLabel}
            </span>
            <img alt="" src={selectChevron} />
          </button>
          <div className="request-select-menu__list">
            {options.map((option) => (
              <button
                className={`request-select-menu__item${option === value ? ' is-active' : ''}`}
                key={option}
                type="button"
                onClick={() => { hapticSelection(); onSelect(option); }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function NavigationScreen() {
  return (
    <main className="request-screen request-screen--nav">
      <div className="request-nav-body">
        <img alt="" className="request-nav-bg" src={navBg} />
        <img alt="Меню" className="request-nav-title" src={navTitle} />
        <div className="request-nav-links">
          <button type="button">Главная</button>
          <button type="button">Форматы</button>
          <button type="button">Лайф</button>
          <button type="button">Партнеры</button>
          <button type="button">Наши соц. сети</button>
        </div>
      </div>
    </main>
  );
}

export type BookingDraft = {
  formatId: string;
  bookingDate: string;
};

type RequestCalendarScreenProps = {
  onContinue?: (draft: BookingDraft) => void;
};

export function RequestCalendarScreen({ onContinue }: RequestCalendarScreenProps) {
  const [formats, setFormats] = useState<Format[]>([]);
  const [formatsLoading, setFormatsLoading] = useState(true);
  const [formatsError, setFormatsError] = useState<Error | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(1);
  const [availableDates, setAvailableDates] = useState<number[]>([]);
  const [datesError, setDatesError] = useState<Error | null>(null);

  useEffect(() => {
    // Сбрасываем скролл при входе в календарь (в SPA сохраняется позиция лендинга)
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, []);

  const loadFormats = useCallback(async () => {
    setFormatsError(null);
    setFormatsLoading(true);
    try {
      const list = await getFormatsForBooking();
      setFormats(list);
      if (list.length > 0) {
        setSelectedFormatId((prev) => prev || list[0].id);
      }
    } catch (e) {
      setFormatsError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setFormatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFormats();
  }, [loadFormats]);

  const selectedFormat = useMemo(
    () => formats.find((f) => f.id === selectedFormatId),
    [formats, selectedFormatId]
  );
  const formatOptions = useMemo(() => formats.map((f) => f.name), [formats]);
  const formatDisplayValue = selectedFormat?.name ?? '';

  const handleFormatSelect = (option: string) => {
    const format = formats.find((f) => f.name === option);
    if (format) setSelectedFormatId(format.id);
    setFormatOpen(false);
  };

  const daysInMonth = useMemo(
    () => new Date(year, monthIndex + 1, 0).getDate(),
    [monthIndex, year],
  );

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, index) => index + 1),
    [daysInMonth],
  );

  const loadAvailableDates = useCallback(async () => {
    setDatesError(null);
    try {
      const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const dates = await getAvailableDates(monthStr);
      setAvailableDates(dates);
    } catch (e) {
      setDatesError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [monthIndex, year]);

  useEffect(() => {
    loadAvailableDates();
  }, [loadAvailableDates]);

  const disabledDays = useMemo(() => {
    if (availableDates.length === 0) {
      // While loading, disable all dates except a default set
      return new Set<number>();
    }
    // Calculate disabled days from available dates
    const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const disabled = allDays.filter(day => !availableDates.includes(day));
    return new Set<number>(disabled);
  }, [availableDates, daysInMonth]);

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  useEffect(() => {
    if (availableDates.length === 0) return;
    if (availableDates.includes(selectedDay)) return;
    const nextAvailable = Math.min(...availableDates);
    setSelectedDay(nextAvailable);
  }, [availableDates, selectedDay]);

  const handlePrevMonth = () => {
    setMonthIndex((prev) => {
      if (prev === 0) {
        setYear((current) => current - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setMonthIndex((prev) => {
      if (prev === 11) {
        setYear((current) => current + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleContinue = () => {
    if (!onContinue || !selectedFormatId) return;
    hapticImpact('medium');
    const bookingDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    onContinue({ formatId: selectedFormatId, bookingDate });
  };

  const canContinue = Boolean(selectedFormatId && selectedDay);

  if (formatsError) {
    return (
      <main className="request-screen request-screen--calendar">
        <div className="request-body request-body--gradient request-body--calendar">
          <img alt="Лого" className="request-logo" src={requestLogo} />
          <NetworkError
            message="Не удалось загрузить форматы и календарь."
            onRetry={loadFormats}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="request-screen request-screen--calendar">
      <div className="request-body request-body--gradient request-body--calendar">
        <img alt="Лого" className="request-logo" src={requestLogo} />
        {datesError ? (
          <NetworkError
            message="Не удалось загрузить доступные даты."
            onRetry={loadAvailableDates}
          />
        ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="request-calendar-block"
        >
          <div className="request-calendar-head">
            <button
              className="request-icon-button request-icon-button--prev"
              type="button"
              onClick={() => { hapticImpact('light'); handlePrevMonth(); }}
            >
              <img alt="" src={monthPrev} />
            </button>
            <span className="request-calendar-title">{months[monthIndex]}</span>
            <button
              className="request-icon-button request-icon-button--next"
              type="button"
              onClick={() => { hapticImpact('light'); handleNextMonth(); }}
            >
              <img alt="" src={monthNext} />
            </button>
          </div>
          <div className="request-calendar-grid">
            {days.map((day, index) => (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 + index * 0.01 }}
                className={`request-day${day === selectedDay ? ' is-selected' : ''}${
                  disabledDays.has(day) ? ' is-muted' : ''
                }`}
                key={day}
                type="button"
                onClick={() => {
                  if (!disabledDays.has(day)) {
                    hapticSelection();
                    setSelectedDay(day);
                  }
                }}
              >
                {day}
              </motion.button>
            ))}
          </div>
        </motion.div>
        )}
        <RequestSelect
          className="request-select--calendar"
          isOpen={formatOpen}
          onToggle={() => setFormatOpen((prev) => !prev)}
          onSelect={handleFormatSelect}
          options={formatOptions}
          placeholder={
            formatsLoading
              ? 'Загрузка...'
              : formats.length === 0
                ? 'Нет доступных форматов'
                : 'Выберите формат'
          }
          size="format"
          value={formatDisplayValue}
        />
        {!formatsLoading && formats.length === 0 && (
          <p className="request-form-hint" style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted, #666)' }}>
            Добавьте форматы в админке и включите их для бронирования.
          </p>
        )}
        <button
          className="request-primary request-primary--calendar"
          type="button"
          onClick={handleContinue}
          disabled={!canContinue || formatsLoading}
        >
          Продолжить
        </button>
      </div>
    </main>
  );
}

type RequestFormScreenProps = {
  bookingDraft: BookingDraft | null;
  initialFullName?: string;
  onSubmit?: () => void;
  onSubmitError?: (message: string) => void;
};

export function RequestFormScreen({ bookingDraft, initialFullName = '', onSubmit, onSubmitError }: RequestFormScreenProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [contactType, setContactType] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState('');
  const [openSelect, setOpenSelect] = useState<'contact' | 'source' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formLoadedFromCloud, setFormLoadedFromCloud] = useState(false);

  useEffect(() => {
    if (!bookingDraft || formLoadedFromCloud) return;
    let cancelled = false;
    getBookingFormFromCloud().then((data) => {
      if (cancelled) return;
      setFormLoadedFromCloud(true);
      if (data?.fullName !== undefined) setFullName(data.fullName);
      if (data?.contactType !== undefined) setContactType(data.contactType);
      if (data?.phoneNumber !== undefined) setPhoneNumber(data.phoneNumber);
      if (data?.city !== undefined) setCity(data.city);
      if (data?.source !== undefined) setSource(data.source);
    });
    return () => { cancelled = true; };
  }, [bookingDraft, formLoadedFromCloud]);

  useEffect(() => {
    if (!bookingDraft) return;
    const payload: BookingFormStorage = { fullName, contactType, phoneNumber, city, source };
    const t = window.setTimeout(() => {
      setBookingFormToCloud(payload);
    }, 500);
    return () => window.clearTimeout(t);
  }, [bookingDraft, fullName, contactType, phoneNumber, city, source]);

  const toggleSelect = (target: 'contact' | 'source') => {
    setOpenSelect((prev) => (prev === target ? null : target));
  };

  const handleSubmit = async () => {
    if (!bookingDraft) {
      hapticNotification('error');
      onSubmitError?.('Не выбраны дата и формат. Вернитесь на предыдущий шаг.');
      return;
    }
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      hapticNotification('error');
      onSubmitError?.('Введите ФИО');
      return;
    }
    if (trimmedName.length < 2) {
      hapticNotification('error');
      onSubmitError?.('ФИО должно быть не короче 2 символов');
      return;
    }
    const trimmedPhone = phoneNumber.trim();
    if (!trimmedPhone) {
      hapticNotification('error');
      onSubmitError?.('Введите номер телефона');
      return;
    }
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      hapticNotification('error');
      onSubmitError?.('Введите корректный российский номер: минимум 10 цифр');
      return;
    }
    if (digitsOnly.length > 11) {
      hapticNotification('error');
      onSubmitError?.('Слишком длинный номер. Формат: 9XXXXXXXXX или 79XXXXXXXXX');
      return;
    }
    if (digitsOnly.length === 10 && digitsOnly[0] !== '9') {
      hapticNotification('error');
      onSubmitError?.('Мобильный номер должен начинаться с 9 (например 9XX XXX XX XX)');
      return;
    }
    if (digitsOnly.length === 11 && digitsOnly[0] !== '7' && digitsOnly[0] !== '8') {
      hapticNotification('error');
      onSubmitError?.('Номер с кодом страны должен начинаться с 7 или 8 (например 79XXXXXXXXX)');
      return;
    }
    const normalizedPhone =
      digitsOnly.length === 10
        ? `+7${digitsOnly}`
        : `+7${digitsOnly[0] === '7' || digitsOnly[0] === '8' ? digitsOnly.slice(1) : digitsOnly}`;
    hapticImpact('medium');
    setIsSubmitting(true);
    try {
      const { createBooking } = await import('../services/bookingService');
      await createBooking({
        formatId: bookingDraft.formatId,
        bookingDate: bookingDraft.bookingDate,
        fullName: trimmedName,
        contactType: contactType || undefined,
        contactValue: normalizedPhone,
        city: city.trim() || undefined,
        source: source || undefined,
      });
      onSubmit?.();
    } catch (e) {
      console.error('Booking submit failed', e);
      hapticNotification('error');
      onSubmitError?.(
        e instanceof Error ? e.message : 'Не удалось отправить заявку. Попробуйте позже.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="request-screen request-screen--form">
      <div className="request-body request-body--pattern request-body--form">
        <img alt="Лого" className="request-logo" src={requestLogo} />
        <div className="request-body__scroll">
        <div className="request-form-card">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="request-form-title request-form-appear"
          >
            Форма для заявки
          </motion.h1>
          <div className="request-fields">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="request-field request-form-appear"
            >
              <label htmlFor="request-full-name">ФИО</label>
              <input
                className="request-input"
                id="request-full-name"
                name="fullName"
                placeholder="Введите ваше ФИО"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="request-field request-form-appear"
            >
              <label>Тип контакта</label>
              <RequestSelect
                isOpen={openSelect === 'contact'}
                onToggle={() => toggleSelect('contact')}
                onSelect={(option) => {
                  setContactType(option);
                  setOpenSelect(null);
                }}
                options={contactOptions}
                placeholder="Выберите тип"
                size="contact"
                value={contactType}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="request-field request-form-appear"
            >
              <label htmlFor="request-phone">Номер телефона</label>
              <input
                className="request-input"
                id="request-phone"
                name="phone"
                placeholder="Введите ваш номер"
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="request-field request-form-appear"
            >
              <label htmlFor="request-city">Город проведения мероприятия</label>
              <input
                className="request-input"
                id="request-city"
                name="city"
                placeholder="Введите название города"
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="request-field request-form-appear"
            >
              <label>Откуда узнали?</label>
              <RequestSelect
                isOpen={openSelect === 'source'}
                onToggle={() => toggleSelect('source')}
                onSelect={(option) => {
                  setSource(option);
                  setOpenSelect(null);
                }}
                options={sourceOptions}
                placeholder="Выберите вариант"
                size="source"
                value={source}
              />
            </motion.div>
          </div>
        </div>
        <button
          className="request-primary request-primary--floating request-form-appear request-form-appear--button"
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Отправка...' : 'Отправить'}
        </button>
        </div>
      </div>
    </main>
  );
}

type RequestSuccessScreenProps = {
  onBackHome?: () => void;
};

export function RequestSuccessScreen({ onBackHome }: RequestSuccessScreenProps) {
  return (
    <main className="request-screen request-screen--success">
      <div className="request-body request-body--pattern request-success-body">
        <img alt="ВГУП" className="request-logo" src={requestLogo} />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', damping: 12 }}
          className="request-success-photo request-success-in"
        >
          <img alt="Анна" src={requestAnna} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="request-success-card request-success-in"
        >
          <h2>Заявка принята!</h2>
          <p>С вами свяжется руководитель</p>
          <p>группы Анна Кобякова</p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="request-primary request-success-button request-success-in"
          type="button"
          onClick={() => { hapticImpact('light'); onBackHome?.(); }}
        >
          Вернуться на главную
        </motion.button>
      </div>
    </main>
  );
}
