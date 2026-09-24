import type { SectionSchema } from '../schema';

/**
 * Copy for the 3-step booking flow (/booking → /booking/form → /booking/success).
 *
 * PURE DATA + TYPES ONLY — the admin bundle imports this file, so it must never pull in
 * CSS, assets or React. Verbatim Figma copy where Figma has any; everything Figma left
 * undesigned (validation messages, request errors, a11y labels) is authored here so the
 * admin can edit it instead of the strings living inside components.
 */

export interface BookingFieldCopy {
  label: string;
  placeholder: string;
}

export interface BookingFormatFieldCopy extends BookingFieldCopy {
  /** First <option> of «Формат события» — the "nothing chosen yet" row. */
  emptyOption: string;
}

export interface BookingErrorCopy {
  /** A required field was left empty. */
  required: string;
  fullName: string;
  phone: string;
  email: string;
  /** Announced above the submit button when the form is submitted with errors. */
  summary: string;
  /** 409 DATE_UNAVAILABLE — the date got taken while the visitor was typing. */
  dateUnavailable: string;
  /** 429 — the anti-spam bucket is empty. */
  rateLimited: string;
  /** Network / timeout / 5xx on submit. */
  network: string;
  /** Anything else the server refuses the form with. */
  generic: string;
  /** GET /api/bookings/available-dates failed. */
  availability: string;
}

export interface BookingContent {
  dateTitle: string;
  timeTitle: string;
  /** «HH:mm». The visitor's preferred start time; availability itself is per date. */
  timeSlots: string[];
  continueLabel: string;
  formTitle: string;
  submitLabel: string;
  successTitle: string;
  /** «{manager}» and «{role}» come from Contacts. */
  successText: string;
  backHomeLabel: string;

  /* ── Step 1: calendar ── */
  /** Sub-title under «Выберите дату и время». Empty string hides it. */
  dateHint: string;
  prevMonthLabel: string;
  nextMonthLabel: string;
  /** Screen-reader text while a month's availability is loading. */
  loadingLabel: string;
  retryLabel: string;
  /** Legend for days the band is already booked / the admin blocked. */
  unavailableLabel: string;
  todayLabel: string;

  /* ── Step 2: form ── */
  /** Chip above the fields, e.g. «18 декабря 2025, 18:00». */
  summaryLabel: string;
  changeDateLabel: string;
  /** Shown when /booking/form is opened with no chosen date (direct link, expired tab). */
  formEmptyMessage: string;
  fields: {
    fullName: BookingFieldCopy;
    phone: BookingFieldCopy;
    email: BookingFieldCopy;
    city: BookingFieldCopy;
    format: BookingFormatFieldCopy;
    comment: BookingFieldCopy;
  };
  /** Marks a field as mandatory; also read out as «обязательное поле». */
  requiredMark: string;
  /** Inserted where Legal → «Текст согласия» contains {privacy}. */
  consentPrivacyLabel: string;
  errors: BookingErrorCopy;
  /** Link offered next to the 409 message. */
  pickAnotherDateLabel: string;

  /* ── Step 3: success ── */
  successDateLabel: string;
  successTimeLabel: string;
  /** Shown when /booking/success is opened without a submitted request. */
  successEmptyMessage: string;
}

export const bookingDefaults: BookingContent = {
  dateTitle: 'Выберите дату и время',
  timeTitle: 'Выберите время',
  timeSlots: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
  continueLabel: 'Продолжить',
  formTitle: 'Заполните анкету',
  submitLabel: 'Отправить заявку',
  successTitle: 'Заявка принята!',
  successText: 'С вами в ближайшее время свяжется {role} {manager} для уточнения всех деталей и бронирования даты.',
  backHomeLabel: 'Вернуться на главную',

  dateHint: 'Занятые даты выбрать нельзя. Если нужна именно такая — напишите нам, обсудим.',
  prevMonthLabel: 'Предыдущий месяц',
  nextMonthLabel: 'Следующий месяц',
  loadingLabel: 'Загружаем свободные даты',
  retryLabel: 'Повторить',
  unavailableLabel: 'Дата занята',
  todayLabel: 'Сегодня',

  summaryLabel: 'Вы выбрали',
  changeDateLabel: 'Изменить',
  formEmptyMessage: 'Сначала выберите дату выступления.',
  fields: {
    // Figma: «Ваше ФИО» / «Иван Иванов» / «Номер телефона» / «+7 (999) 000-00-00» /
    // «Email» / «example@mail.ru» / «Город проведения мероприятия» / «Москва» /
    // «Формат события» / «Комментарий» / «Расскажите о вашем мероприятии...» — verbatim.
    fullName: { label: 'Ваше ФИО', placeholder: 'Иван Иванов' },
    phone: { label: 'Номер телефона', placeholder: '+7 (999) 000-00-00' },
    email: { label: 'Email', placeholder: 'example@mail.ru' },
    city: { label: 'Город проведения мероприятия', placeholder: 'Москва' },
    format: { label: 'Формат события', placeholder: '', emptyOption: 'Выберите формат' },
    comment: { label: 'Комментарий', placeholder: 'Расскажите о вашем мероприятии...' },
  },
  requiredMark: '*',
  consentPrivacyLabel: 'политике конфиденциальности',
  errors: {
    required: 'Заполните это поле',
    fullName: 'Укажите имя и фамилию',
    phone: 'Введите номер в формате +7 (999) 000-00-00',
    email: 'Проверьте адрес — похоже, в нём опечатка',
    summary: 'Проверьте выделенные поля',
    dateUnavailable: 'Эту дату только что заняли. Выберите, пожалуйста, другую.',
    rateLimited: 'Слишком много заявок с вашего устройства. Попробуйте через несколько минут или позвоните нам.',
    network: 'Не получилось отправить заявку — проверьте соединение и попробуйте ещё раз. Данные сохранены.',
    generic: 'Не получилось отправить заявку. Попробуйте ещё раз или свяжитесь с нами напрямую.',
    availability: 'Не удалось загрузить свободные даты.',
  },
  pickAnotherDateLabel: 'Выбрать другую дату',

  successDateLabel: 'Дата',
  successTimeLabel: 'Время',
  successEmptyMessage: 'Заявка не найдена — возможно, вы открыли эту страницу напрямую.',
};

export const bookingSchema: SectionSchema = {
  id: 'booking',
  title: 'Заявка',
  description:
    'Тексты трёх шагов онлайн-заявки: выбор даты и времени, анкета и экран «Заявка принята». Свободные даты подтягиваются из календаря администратора — здесь редактируются только подписи.',
  fields: [
    { kind: 'text', key: 'dateTitle', label: 'Заголовок шага 1', hint: 'Над календарём', maxLength: 80 },
    {
      kind: 'textarea',
      key: 'dateHint',
      label: 'Подсказка под заголовком шага 1',
      hint: 'Оставьте пустым, чтобы скрыть строку',
      rows: 2,
      maxLength: 240,
    },
    { kind: 'text', key: 'timeTitle', label: 'Заголовок блока времени', maxLength: 80 },
    {
      kind: 'stringList',
      key: 'timeSlots',
      label: 'Варианты времени начала',
      hint: 'По одному в строке, в формате 18:00. Пустой список скрывает блок — тогда шаг 1 попросит только дату.',
      itemPlaceholder: '18:00',
      maxItems: 12,
    },
    { kind: 'text', key: 'continueLabel', label: 'Кнопка перехода к анкете', maxLength: 40 },
    {
      kind: 'group',
      key: 'errors',
      label: 'Сообщения об ошибках',
      fields: [
        { kind: 'text', key: 'availability', label: 'Не загрузились свободные даты', maxLength: 160 },
        { kind: 'text', key: 'required', label: 'Поле не заполнено', maxLength: 120 },
        { kind: 'text', key: 'fullName', label: 'Неверное ФИО', maxLength: 120 },
        { kind: 'text', key: 'phone', label: 'Неверный телефон', maxLength: 120 },
        { kind: 'text', key: 'email', label: 'Неверный e-mail', maxLength: 120 },
        { kind: 'text', key: 'summary', label: 'Итог по форме с ошибками', maxLength: 160 },
        { kind: 'textarea', key: 'dateUnavailable', label: 'Дату успели занять', rows: 2, maxLength: 240 },
        { kind: 'textarea', key: 'rateLimited', label: 'Слишком много заявок подряд', rows: 2, maxLength: 240 },
        { kind: 'textarea', key: 'network', label: 'Нет связи с сервером', rows: 2, maxLength: 240 },
        { kind: 'textarea', key: 'generic', label: 'Прочая ошибка отправки', rows: 2, maxLength: 240 },
      ],
    },
    { kind: 'text', key: 'retryLabel', label: 'Кнопка «Повторить»', maxLength: 40 },
    { kind: 'text', key: 'unavailableLabel', label: 'Подпись занятой даты', hint: 'Читают скринридеры', maxLength: 60 },
    { kind: 'text', key: 'todayLabel', label: 'Подпись сегодняшней даты', hint: 'Читают скринридеры', maxLength: 60 },
    { kind: 'text', key: 'prevMonthLabel', label: 'Кнопка «предыдущий месяц»', hint: 'Читают скринридеры', maxLength: 60 },
    { kind: 'text', key: 'nextMonthLabel', label: 'Кнопка «следующий месяц»', hint: 'Читают скринридеры', maxLength: 60 },
    { kind: 'text', key: 'loadingLabel', label: 'Подпись загрузки календаря', maxLength: 80 },

    { kind: 'text', key: 'formTitle', label: 'Заголовок шага 2', maxLength: 80 },
    { kind: 'text', key: 'summaryLabel', label: 'Подпись выбранной даты в анкете', maxLength: 60 },
    { kind: 'text', key: 'changeDateLabel', label: 'Ссылка «изменить дату»', maxLength: 40 },
    {
      kind: 'text',
      key: 'formEmptyMessage',
      label: 'Анкета открыта без выбранной даты',
      hint: 'Видно тем, кто пришёл на /booking/form по прямой ссылке',
      maxLength: 160,
    },
    {
      kind: 'group',
      key: 'fields',
      label: 'Поля анкеты',
      fields: [
        {
          kind: 'group',
          key: 'fullName',
          label: 'ФИО (обязательное)',
          fields: [
            { kind: 'text', key: 'label', label: 'Название поля', maxLength: 60 },
            { kind: 'text', key: 'placeholder', label: 'Подсказка внутри поля', maxLength: 60 },
          ],
        },
        {
          kind: 'group',
          key: 'phone',
          label: 'Телефон (обязательное)',
          fields: [
            { kind: 'text', key: 'label', label: 'Название поля', maxLength: 60 },
            { kind: 'text', key: 'placeholder', label: 'Подсказка внутри поля', maxLength: 60 },
          ],
        },
        {
          kind: 'group',
          key: 'email',
          label: 'E-mail',
          fields: [
            { kind: 'text', key: 'label', label: 'Название поля', maxLength: 60 },
            { kind: 'text', key: 'placeholder', label: 'Подсказка внутри поля', maxLength: 60 },
          ],
        },
        {
          kind: 'group',
          key: 'city',
          label: 'Город',
          fields: [
            { kind: 'text', key: 'label', label: 'Название поля', maxLength: 60 },
            { kind: 'text', key: 'placeholder', label: 'Подсказка внутри поля', maxLength: 60 },
          ],
        },
        {
          kind: 'group',
          key: 'format',
          label: 'Формат события',
          hint: 'Список форматов берётся из раздела «Форматы». Если форматов нет, поле не показывается.',
          fields: [
            { kind: 'text', key: 'label', label: 'Название поля', maxLength: 60 },
            { kind: 'text', key: 'emptyOption', label: 'Первый пункт списка', maxLength: 60 },
          ],
        },
        {
          kind: 'group',
          key: 'comment',
          label: 'Комментарий',
          fields: [
            { kind: 'text', key: 'label', label: 'Название поля', maxLength: 60 },
            { kind: 'text', key: 'placeholder', label: 'Подсказка внутри поля', maxLength: 120 },
          ],
        },
      ],
    },
    { kind: 'text', key: 'requiredMark', label: 'Знак обязательного поля', maxLength: 4 },
    { kind: 'text', key: 'submitLabel', label: 'Кнопка отправки анкеты', maxLength: 40 },
    {
      kind: 'text',
      key: 'consentPrivacyLabel',
      label: 'Текст ссылки в строке согласия',
      hint: 'Подставляется вместо {privacy} в «Документы → Текст согласия». Ссылка появляется, только если политика заполнена.',
      maxLength: 80,
    },
    { kind: 'text', key: 'pickAnotherDateLabel', label: 'Ссылка «выбрать другую дату»', maxLength: 40 },

    { kind: 'text', key: 'successTitle', label: 'Заголовок шага 3', maxLength: 80 },
    {
      kind: 'textarea',
      key: 'successText',
      label: 'Текст на экране «Заявка принята»',
      hint: '{manager} и {role} подставляются из раздела «Контакты»',
      rows: 3,
      maxLength: 400,
    },
    { kind: 'text', key: 'successDateLabel', label: 'Подпись даты в подтверждении', maxLength: 40 },
    { kind: 'text', key: 'successTimeLabel', label: 'Подпись времени в подтверждении', maxLength: 40 },
    {
      kind: 'text',
      key: 'successEmptyMessage',
      label: 'Подтверждение открыто без заявки',
      hint: 'Видно тем, кто пришёл на /booking/success по прямой ссылке',
      maxLength: 160,
    },
    { kind: 'text', key: 'backHomeLabel', label: 'Кнопка возврата на главную', maxLength: 60 },
  ],
};
