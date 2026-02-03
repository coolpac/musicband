import promoImage from '../assets/figma/promo.webp';
import imgAward2025Local from '../assets/figma/award-2025.webp';
import imgAward2024 from '../assets/figma/downloaded/award-2024.webp';
import imgLiveSound from '../assets/figma/downloaded/live-sound.webp';
import imgFlexibleTerms from '../assets/figma/downloaded/flexible-terms.webp';
import imgSecondPanelLeft from '../assets/figma/downloaded/second-panel-left.webp';
import imgSecondPanelCenter from '../assets/figma/downloaded/second-panel-center.webp';
import imgSecondPanelRight from '../assets/figma/downloaded/second-panel-right.webp';
import imgThirdPanelLeft from '../assets/figma/downloaded/third-panel-left.webp';
import imgThirdPanelCenter from '../assets/figma/downloaded/third-panel-center.webp';
import imgThirdPanelRight from '../assets/figma/downloaded/third-panel-right.webp';

const imgAward2025 = imgAward2025Local;

export type WhyMobileSlide = {
  id: string;
  image: string;
  alt: string;
  text: string;
};

export type PromoVideoItem = {
  id: string;
  src: string;
  poster: string;
  title: string;
};

export const promoVideos: PromoVideoItem[] = [
  {
    id: 'live-1',
    src: '/videos/7 лепесток с вами_optimized.mp4',
    poster: '/videos/thumbs/7 лепесток с вами_thumb.jpg',
    title: '',
  },
  {
    id: 'live-2',
    src: '/videos/Не удержались_optimized.mp4',
    poster: '/videos/thumbs/Не удержались_thumb.jpg',
    title: '',
  },
  {
    id: 'live-3',
    src: '/videos/Январская въюга_optimized.mp4',
    poster: '/videos/thumbs/Январская въюга_thumb.jpg',
    title: '',
  },
  {
    id: 'promo-main',
    src: 'https://rutube.ru/video/56fd172a86aff0d705834ea2bab83d2d',
    poster: '/videos/thumbs/ПРИЗВАНИЕ АРТИСТ 2025 (Горизонтальный)_thumb.jpg',
    title: '',
  },
];

export const whyMobileSlides: WhyMobileSlide[] = [
  {
    id: 'award-2025',
    image: imgAward2025,
    alt: 'Диплом премии «Призвание Арист»',
    text: 'призеры премии: "ПРИЗВАНИЕ АРИСТ 2025"',
  },
  {
    id: 'award-2024',
    image: imgAward2024,
    alt: 'Диплом премии «Призвание Арист»',
    text: 'призеры премии: "ПРИЗВАНИЕ АРИСТ 2024"',
  },
  {
    id: 'live-sound',
    image: imgLiveSound,
    alt: 'Выступление',
    text: 'Живой звук, профессиональный состав, опыт выступлений на топовых площадках;',
  },
  {
    id: 'flexible-terms',
    image: imgFlexibleTerms,
    alt: 'Сцена',
    text: 'Гибкие условия сотрудничества;',
  },
  {
    id: 'custom-format',
    image: imgSecondPanelLeft,
    alt: 'Сцена',
    text: 'Подстроимся под ваши задачи и формат;',
  },
  {
    id: 'unique-repertoire',
    image: imgSecondPanelCenter,
    alt: 'Музыкант',
    text: 'Репертуар песен, которого нет у других;',
  },
  {
    id: 'format-repertoire',
    image: imgSecondPanelRight,
    alt: 'Событие',
    text: 'Подбираем репертуар под формат события;',
  },
  {
    id: 'interactive',
    image: imgThirdPanelLeft,
    alt: 'Выступление',
    text: 'Работаем с интерактивом - вовлекаем гостей в шоу;',
  },
  {
    id: 'scenario',
    image: imgThirdPanelCenter,
    alt: 'Сцена',
    text: 'Создаем сценарий выступления;',
  },
  {
    id: 'uniqueness',
    image: imgThirdPanelRight,
    alt: 'Группа',
    text: 'Мы показываем уровень, индевидуальность и неповторимость',
  },
];

export const whyDesktopSlides: string[] = ['panel-2024', 'panel-flex', 'panel-interactive'];
