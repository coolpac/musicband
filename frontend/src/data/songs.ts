import { Song } from '../types/vote';

// Моковые данные для песен (позже будут загружаться с бэкенда)
export const mockSongs: Song[] = [
  {
    id: '1',
    title: 'Никого не жалко',
    artist: 'Бумер',
    isActive: true,
    orderIndex: 1,
  },
  {
    id: '2',
    title: 'Золотые купола',
    artist: 'Братлэнд',
    isActive: true,
    orderIndex: 2,
  },
  {
    id: '3',
    title: 'Черный дельфин',
    artist: 'Гио Пика',
    isActive: true,
    orderIndex: 3,
  },
  {
    id: '4',
    title: 'Провинция моя',
    artist: 'Триагутрика',
    isActive: true,
    orderIndex: 4,
  },
  {
    id: '5',
    title: 'Новогодняя',
    artist: 'Гуф',
    isActive: true,
    orderIndex: 5,
  },
];
