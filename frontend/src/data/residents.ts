/**
 * Резиденты — порядок: Саша, Александр, Рома, Егор, Вадим, Аня.
 * Карточка: имя + короткое описание; по клику — плашка с полным описанием (как в Саша описание.svg).
 * Для чёткости на ретине: добавьте image2x (файл в 2× разрешении, например sasha@2x.webp).
 */
export type Resident = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  image: string;
  /** Опционально: 2× версия для ретина-экранов (например /residents/sasha@2x.webp) */
  image2x?: string;
  /** Опционально: SVG «описание» (оверлей) — при клике показывается вместо HTML-плашки; прелоад при наведении */
  descriptionSvg?: string;
};

export const residents: Resident[] = [
  {
    id: 'sasha',
    name: 'Саша',
    shortDescription: 'Фронтмен, солист, автор.',
    description:
      'Фронтмен, солист, автор. Майкл Джексон до сих пор благодарит за песни. Играет в группе «Лента», пишет песни и ведёт концерты.',
    image: '/residents/sasha.webp',
    image2x: '/residents/sasha-full.webp',
    descriptionSvg: '/residents/sasha-description-overlay.svg',
  },
  {
    id: 'alexandr',
    name: 'Александр',
    shortDescription: 'Гитарист, аранжировщик.',
    description:
      'Гитарист и аранжировщик. Классика и рок в одном флаконе. Участвует в проектах «Лента» и сольных выступлениях.',
    image: '/residents/alexandr.webp',
  },
  {
    id: 'roma',
    name: 'Рома',
    shortDescription: 'Бас-гитарист, бэк-вокал.',
    description:
      'Бас-гитарист и бэк-вокал. Держит ритм и низы в группе «Лента». Любит минимализм и чёткие линии.',
    image: '/residents/roma.webp',
  },
  {
    id: 'egor',
    name: 'Егор',
    shortDescription: 'Ударные, перкуссия.',
    description:
      'Ударные и перкуссия. От джаза до рока. Участник «Ленты» и сессионный музыкант.',
    image: '/residents/egor.webp',
  },
  {
    id: 'vadim',
    name: 'Вадим',
    shortDescription: 'Клавиши, саунд-дизайн.',
    description:
      'Клавишник и саунд-дизайнер. Электроника и живой звук. Сочиняет аранжировки для «Ленты».',
    image: '/residents/vadim.webp',
  },
  {
    id: 'anya',
    name: 'Аня',
    shortDescription: 'Вокал, скрипка.',
    description:
      'Вокал и скрипка. Классическое образование и современный репертуар. Выступает с «Лентой» и сольными программами.',
    image: '/residents/anya.webp',
  },
];
