import { useEffect, useMemo, useState } from 'react';
import { getAvailableDates } from '../services/bookingService';
import navBg from '../assets/figma/downloaded/nav-bg.png';
import navTitle from '../assets/figma/downloaded/nav-title.svg';
import selectChevron from '../assets/figma/downloaded/select-chevron.svg';
import monthPrev from '../assets/figma/downloaded/month-prev.svg';
import monthNext from '../assets/figma/downloaded/month-next.svg';
import requestLogo from '../assets/figma/downloaded/request-logo.svg';
import requestAnna from '../assets/figma/downloaded/request-anna.png';

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

const formatOptions = ['MAIN SHOW', 'Дуэт', 'Welcome', 'Welcome 2.0', 'Виолончель'];
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
        onClick={onToggle}
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
            onClick={onToggle}
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
                onClick={() => onSelect(option)}
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

type RequestCalendarScreenProps = {
  onContinue?: () => void;
};

export function RequestCalendarScreen({ onContinue }: RequestCalendarScreenProps) {
  const [formatOpen, setFormatOpen] = useState(false);
  const [formatValue, setFormatValue] = useState('');
  const [monthIndex, setMonthIndex] = useState(11);
  const [year, setYear] = useState(2024);
  const [selectedDay, setSelectedDay] = useState(11);
  const [availableDates, setAvailableDates] = useState<number[]>([]);

  const handleFormatSelect = (option: string) => {
    setFormatValue(option);
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

  useEffect(() => {
    const loadAvailableDates = async () => {
      try {
        const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
        const dates = await getAvailableDates(monthStr);
        setAvailableDates(dates);
      } catch (error) {
        console.error('Failed to load available dates:', error);
      }
    };

    loadAvailableDates();
  }, [monthIndex, year]);

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

  return (
    <main className="request-screen request-screen--calendar">
      <div className="request-body request-body--gradient request-body--calendar">
        <img alt="Лого" className="request-logo" src={requestLogo} />
        <div className="request-calendar-block">
          <div className="request-calendar-head">
            <button
              className="request-icon-button request-icon-button--prev"
              type="button"
              onClick={handlePrevMonth}
            >
              <img alt="" src={monthPrev} />
            </button>
            <span className="request-calendar-title">{months[monthIndex]}</span>
            <button
              className="request-icon-button request-icon-button--next"
              type="button"
              onClick={handleNextMonth}
            >
              <img alt="" src={monthNext} />
            </button>
          </div>
          <div className="request-calendar-grid">
            {days.map((day) => (
              <button
                className={`request-day${day === selectedDay ? ' is-selected' : ''}${
                  disabledDays.has(day) ? ' is-muted' : ''
                }`}
                key={day}
                type="button"
                onClick={() => {
                  if (!disabledDays.has(day)) {
                    setSelectedDay(day);
                  }
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
        <RequestSelect
          className="request-select--calendar"
          isOpen={formatOpen}
          onToggle={() => setFormatOpen((prev) => !prev)}
          onSelect={handleFormatSelect}
          options={formatOptions}
          placeholder="Выберите формат"
          size="format"
          value={formatValue}
        />
        <button
          className="request-primary request-primary--calendar"
          type="button"
          onClick={onContinue}
        >
          Продолжить
        </button>
      </div>
    </main>
  );
}

type RequestFormScreenProps = {
  onSubmit?: () => void;
};

export function RequestFormScreen({ onSubmit }: RequestFormScreenProps) {
  const [fullName, setFullName] = useState('');
  const [contactType, setContactType] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState('');
  const [openSelect, setOpenSelect] = useState<'contact' | 'source' | null>(null);

  const toggleSelect = (target: 'contact' | 'source') => {
    setOpenSelect((prev) => (prev === target ? null : target));
  };

  return (
    <main className="request-screen request-screen--form">
      <div className="request-body request-body--pattern">
        <img alt="Лого" className="request-logo" src={requestLogo} />
        <div className="request-form-card">
          <h1>Форма для заявки</h1>
          <div className="request-fields">
            <div className="request-field">
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
            </div>
            <div className="request-field">
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
            </div>
            <div className="request-field">
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
            </div>
            <div className="request-field">
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
            </div>
            <div className="request-field">
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
            </div>
          </div>
        </div>
        <button
          className="request-primary request-primary--floating"
          type="button"
          onClick={onSubmit}
        >
          Отправить
        </button>
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
        <div className="request-success-photo">
          <img alt="Анна" src={requestAnna} />
        </div>
        <div className="request-success-card">
          <h2>Заявка принята!</h2>
          <p>С вами свяжется руководитель</p>
          <p>группы Анна Кобякова</p>
        </div>
        <button className="request-primary request-success-button" type="button" onClick={onBackHome}>
          Вернуться на главную
        </button>
      </div>
    </main>
  );
}
