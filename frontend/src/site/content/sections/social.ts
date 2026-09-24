import type { SectionSchema } from '../schema';

export type SocialNetwork = 'vk' | 'telegram' | 'youtube' | 'instagram' | 'rutube' | 'dzen' | 'tiktok';

export interface SocialLink {
  network: SocialNetwork;
  url: string;
}

export interface SocialContent {
  heading: string;
  text: string;
  /** Links with an empty url are not rendered. */
  links: SocialLink[];
}

/** Every network the site can render a button for. Order = the order of the hint in the admin. */
export const SOCIAL_NETWORKS: readonly SocialNetwork[] = ['vk', 'telegram', 'youtube', 'instagram', 'rutube', 'dzen', 'tiktok'];

/** Guards a hand-typed value from the admin before it is used as a lookup key. */
export function isSocialNetwork(value: string): value is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(value);
}

/**
 * Href for a third-party profile or partner site. «vk.com/vgul» becomes «https://vk.com/vgul»,
 * so an admin does not have to remember the scheme; anything carrying another scheme
 * (javascript:, data:) is refused rather than silently rendered as a link.
 * Shared with the partners section — both link out to sites we do not control.
 */
export function toExternalHref(url: string): string {
  const value = url.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  // Leading slashes AND backslashes go: browsers read «\» as «/» while parsing the authority,
  // so «\\vk.com» must not turn into «https://\\vk.com».
  return `https://${value.replace(/^[/\\]+/, '')}`;
}

export const socialDefaults: SocialContent = {
  heading: 'Мы в социальных сетях',
  // Verbatim from Figma (345:1437).
  text: 'Подпишитесь на нас и следите за новыми шоу, репетициями и закулисными моментами.',
  // Figma draws four buttons with no links behind them: nothing is shipped until the real
  // profiles are known — a button that leads nowhere is worse than no button.
  links: [],
};

export const socialSchema: SectionSchema = {
  id: 'social',
  title: 'Соцсети',
  description: 'Кнопка появляется только у тех сетей, где заполнена ссылка. Нет ни одной ссылки — секция не выводится.',
  fields: [
    { kind: 'text', key: 'heading', label: 'Заголовок', maxLength: 60 },
    { kind: 'textarea', key: 'text', label: 'Подпись', rows: 2, maxLength: 300 },
    {
      kind: 'list',
      key: 'links',
      label: 'Ссылки',
      itemLabel: 'Соцсеть',
      titleKey: 'network',
      maxItems: SOCIAL_NETWORKS.length,
      fields: [
        {
          kind: 'text',
          key: 'network',
          label: 'Сеть',
          placeholder: 'vk',
          hint: `Одно из значений: ${SOCIAL_NETWORKS.join(', ')}`,
          maxLength: 16,
        },
        {
          kind: 'url',
          key: 'url',
          label: 'Ссылка на профиль',
          placeholder: 'https://vk.com/vgul',
          hint: 'Пусто — кнопка не выводится',
          maxLength: 300,
        },
      ],
    },
  ],
};
