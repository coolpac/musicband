import { Format } from '../types/format';
import formatImage from '../assets/figma/format.webp';

// Моковые данные для форматов (позже будут загружаться с бэкенда)
export const mockFormats: Format[] = [
  {
    id: 'main-show',
    name: 'MAIN SHOW',
    shortDescription: 'Это мощное живое выступление созданное для ярких событий',
    description:
      'Максимум энергии, харизма и музыка, которая превращает вечер в незабываемую атмосферу и создает эмоции, от которых захватывает дух.',
    imageUrl: formatImage,
    suitableFor: [
      'Корпоративы и премиальные вечеринки',
      'Свадьбы и частные торжества',
      'Городские праздники и фестивали',
      'Презентации и VIP-мероприятия',
      'И многое другое',
    ],
    status: 'available',
    order: 1,
  },
  {
    id: 'duet',
    name: 'Дуэт',
    shortDescription: 'Тут надо придумать краткое описание формата',
    description:
      'В этом формате выступают вокалист и гитарист, который также исполняет партии бэк-вокала или соло, добавляя глубину и гармонию в звучание. Легкость, живой звук и искренность исполнения делают этот формат универсальным решением для мероприятий любого уровня.',
    imageUrl: formatImage,
    performers: [
      { name: 'Роман Олексюк', role: 'Гитарист' },
      { name: 'Александр Назаров', role: 'Вокалист' },
    ],
    status: 'available',
    order: 2,
  },
  {
    id: 'welcome',
    name: 'Welcome',
    shortDescription: 'Тут надо придумать краткое описание формата',
    description:
      'Мы создаем легкую, изысканную атмосферу с живым звучанием, вокалом и харизмой артистов, позволяя гостям наслаждаться моментом в сопровождении качественной музыки.',
    imageUrl: formatImage,
    suitableFor: [
      'Свадебные церемонии и welcome-зоны',
      'Гастроужины и частные мероприятия',
      'Презентации и деловые встречи',
    ],
    status: 'available',
    order: 3,
  },
  {
    id: 'welcome-2',
    name: 'Welcome 2.0',
    shortDescription: 'Тут надо придумать краткое описание формата',
    description: 'Пример текста для описания',
    imageUrl: formatImage,
    status: 'available',
    order: 4,
  },
  {
    id: 'cello',
    name: 'Виолончель',
    shortDescription: 'Тут надо придумать краткое описание формата',
    description: 'Пример текста для описания',
    imageUrl: formatImage,
    status: 'available',
    order: 5,
  },
  {
    id: 'coming-soon-1',
    name: 'Скоро',
    shortDescription: 'Тут надо придумать краткое описание формата',
    status: 'coming-soon',
    order: 6,
  },
  {
    id: 'coming-soon-2',
    name: 'Скоро',
    shortDescription: 'Тут надо придумать краткое описание формата',
    status: 'coming-soon',
    order: 7,
  },
  {
    id: 'coming-soon-3',
    name: 'Скоро',
    shortDescription: 'Тут надо придумать краткое описание формата',
    status: 'coming-soon',
    order: 8,
  },
];
