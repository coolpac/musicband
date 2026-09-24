import type { SectionSchema } from '../schema';

export interface RepertoireContent {
  heading: string;
  downloadLabel: string;
  /** PDF/DOC with the full list. Empty = download pill hidden. */
  fileUrl: string;
  /** «Исполнитель - Название», one per item, numbered automatically. */
  tracks: string[];
  /** Legend for «*» markers. Empty = hidden. */
  footnote: string;
}

/**
 * Figma (354:2354) shows items 31–60 only — the designer deleted the first column, so those are the
 * 30 songs that exist. They ship WITHOUT their numbers: the site renders an <ol> and generates the
 * numbering, so adding or removing a song in the admin never leaves a hole in the sequence.
 *
 * Spelling is the client's and is preserved verbatim — «Stend dy me», «Banny Benassi», «въюга»,
 * «Zdob si zdub», lowercase titles after Cyrillic artists. The trailing «*» markers are kept too
 * (they flag names designated «иностранный агент»); their legend is the editable `footnote`.
 */
const figmaTracks: string[] = [
  'The white stripes - Seven nation army',
  'Alex Clare - Caroline',
  'Alex Clare - Close to love you',
  'John Lennon - Stend dy me',
  'The Animals - the house of the rising sun',
  'Федук - хлопья летят наверх',
  'Губин - ночь',
  'Отпетые мошенники - люби меня, люби',
  'Нина Бродская - Звенит январская въюга',
  'Зацепин, Золотухин - разговор со счастьем',
  'Евгений Крылатов - 3 белых коня',
  'Васюта (Сладкий сон) - на белом покрывале января',
  'Perry Como - magic moments',
  'Меладзе* - Красиво',
  'Градусы - кто ты?',
  'MORGENSHTERN - последняя любовь*',
  'Браво - Любите, девушки',
  'Браво - Я - то, что надо',
  'Муслим Магомаев - синяя вечность (танцевальный cover)',
  'Чайф - 17 лет',
  'JONY - комета',
  'Banny Benassi - Satisfaction',
  'Звери - все что тебя касается',
  'Есенин - заметался пожар голубой',
  'Малинин - очи черные',
  'Смысловые галлюцинации - вечно молодой',
  'Дорн - ненавижу*',
  'Zdob si zdub - видели ночь',
  'Баста - Сансара',
  'Антон Беляев (LAB) - Лететь',
];

export const repertoireDefaults: RepertoireContent = {
  // Figma draws «РЕПЕРТУАР»; stored in sentence case and uppercased by CSS so the admin can type normally.
  heading: 'Репертуар',
  downloadLabel: 'скачать список',
  fileUrl: '',
  tracks: figmaTracks,
  footnote: '',
};

/**
 * Href for a document the admin points at: an absolute http(s) URL or a site-relative path
 * («/uploads/repertoire.pdf»). Any other scheme (javascript:, data:) and protocol-relative
 * «//host» are refused, so a mistyped or hostile value can never become an executable link.
 * Shared with the rider section — both render an optional download link.
 */
export function toFileHref(url: string): string {
  const value = url.trim();
  if (!value) return '';
  // A backslash is never part of a path we build, and browsers read it as a slash while parsing
  // the authority: «/\evil.com» would leave the site for https://evil.com/.
  if (value.includes('\\')) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  return value.startsWith('/') ? value : `/${value}`;
}

export const repertoireSchema: SectionSchema = {
  id: 'repertoire',
  title: 'Репертуар',
  description: 'Секция-аккордеон: закрытая — красный блок с логотипом, открытая — тёмный список песен.',
  fields: [
    { kind: 'text', key: 'heading', label: 'Заголовок', hint: 'На сайте выводится заглавными буквами', maxLength: 40 },
    { kind: 'text', key: 'downloadLabel', label: 'Текст кнопки скачивания', maxLength: 40 },
    {
      kind: 'url',
      key: 'fileUrl',
      label: 'Файл со списком песен',
      placeholder: '/uploads/repertoire.pdf',
      hint: 'Ссылка на PDF или документ. Пусто — кнопка не выводится',
      maxLength: 500,
    },
    {
      kind: 'stringList',
      key: 'tracks',
      label: 'Песни',
      itemPlaceholder: 'Исполнитель - Название',
      hint: 'Одна песня в строке, без номеров — нумерация проставляется автоматически',
      maxItems: 400,
    },
    {
      kind: 'textarea',
      key: 'footnote',
      label: 'Сноска к «*»',
      rows: 2,
      hint: 'Расшифровка звёздочки рядом с именами. Пусто — сноска не выводится',
      maxLength: 500,
    },
  ],
};
