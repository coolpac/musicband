import type { SectionSchema } from '../schema';

export interface ContactsContent {
  /**
   * Phone as people read it, e.g. «+7 (922) 750-00-00». The tel: href is derived from its digits.
   * Empty string hides the phone everywhere (header, footer, JSON-LD) — the Figma value
   * «8922750ХХХХ» is a masked placeholder and must never be published.
   */
  phone: string;
  email: string;
  /** Who calls the client back — shown on the «Заявка принята» screen. */
  managerName: string;
  managerRole: string;
  /** Home city for JSON-LD address; empty = omitted. */
  city: string;
}

export const contactsDefaults: ContactsContent = {
  phone: '',
  email: '',
  managerName: 'Анна Кобякова',
  managerRole: 'руководитель группы',
  city: '',
};

/** «+7 (922) 750-00-00» -> «+79227500000». Returns '' when there are not enough digits to dial. */
export function phoneToHref(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits.length >= 11 ? `tel:+${digits}` : '';
}

export const contactsSchema: SectionSchema = {
  id: 'contacts',
  title: 'Контакты',
  description: 'Используются в шапке, подвале, на экране «Заявка принята» и в разметке для поисковиков.',
  fields: [
    { kind: 'tel', key: 'phone', label: 'Телефон', placeholder: '+7 (922) 750-00-00', hint: 'Пусто — телефон скрыт на сайте', maxLength: 30 },
    { kind: 'email', key: 'email', label: 'E-mail', placeholder: 'hello@vgulcover.ru', maxLength: 120 },
    { kind: 'text', key: 'managerName', label: 'Кто свяжется с клиентом', maxLength: 80 },
    { kind: 'text', key: 'managerRole', label: 'Должность', maxLength: 80 },
    { kind: 'text', key: 'city', label: 'Город базирования', maxLength: 80 },
  ],
};
