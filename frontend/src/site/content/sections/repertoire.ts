import type { SectionSchema } from '../schema';

export interface RepertoireContent {
  heading: string;
  downloadLabel: string;
  /** PDF/DOC with the full list. Empty = the pill downloads a .txt generated from `tracks` in the browser. */
  fileUrl: string;
  /** «Исполнитель - Название», one per item, numbered automatically. */
  tracks: string[];
  /** Legend for «*» markers. Empty = hidden. */
  footnote: string;
}

/**
 * The full list, 1–65, from three Figma text blocks of the open state (354:2354): 354:2377 (1–30),
 * 354:2383 (31–60) and 354:2385 (61–65). The render shows only 31–60 (the other blocks sit outside
 * the frame), but the three blocks continue each other without a gap, so together they are the list.
 *
 * Node 355:2386 holds a second, DIFFERENT list (27 titles, 1–20 auto-numbered, then a typed «21.»,
 * then 22–27). It does not fit 1–30 / 31–60 / 61–65, is not rendered and has no numbering of its
 * own, so it is treated as an abandoned draft and ignored.
 *
 * The strings ship WITHOUT their numbers: the site renders an <ol>, so adding or removing a song in
 * the admin never leaves a hole in the sequence (the numbers are the position in this array).
 *
 * Spelling is the client's and kept verbatim, typos included («Stend dy me», «Michel Bublé»,
 * «weeked game», «Banny Benassi», «въюга») — the owner asked for the list letter for letter as in
 * Figma; the admin can correct any title. Lowercase titles after Cyrillic artists, hyphen/en dash
 * mixed as drawn and the trailing «*» markers (they flag names designated «иностранный агент»;
 * their legend is the editable `footnote`) are kept as well.
 */
const figmaTracks: string[] = [
  // 1–30 (354:2377)
  'Макс Корж - жить в кайф',
  'Агата Кристи - Как на войне',
  'Агутин, Пресняков - Аэропорты',
  'Антон Токарев – 7 лепесток',
  'Звери – районы-кварталы',
  'Звери – танцуй',
  'КиШ – прыгну со скалы',
  'КиШ - камнем по голове',
  'КиШ - кукла колдуна',
  'Земляне – трава у дома',
  'Юрий Шатунов - Белые розы',
  'Юрий Шатунов - Седая ночь',
  'Nautilus - Дыхание',
  'HOLIDAYBOY – океаны',
  'HOLIDAYBOY - пожары',
  'Баста – Калифорния',
  'Баста – crazy mzf love',
  'Леприконсы – хали Гали',
  'Рефлекс – нон-стоп',
  'Ленинград - экспонат',
  'Ленинград - начинаем отмечать! (Новый год)',
  'Женя Трофимов - самолёты',
  'Imagine dragons - demons',
  'Chris Isaak - weeked game',
  'Michel Bublé - feeling good',
  'Michel Bublé - Sway',
  'Bill Withers - Ain’t no sunshine',
  'Brothers Moving- Minnie the moocher',
  'Maneskin - Beggin you (2 версии)',
  'Annie Lennox - sweet dreams (2 версии)',
  // 31–60 (354:2383)
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
  // 61–65 (354:2385)
  'Ваня Дмитриенко - Щёлк',
  'Tom Jones, Mousse T. - Sexbomb',
  'Дима Билан - номер один',
  'MONATIK - то, от чего без ума*',
  'Elvis Presley - can’t help falling in love',
];

export const repertoireDefaults: RepertoireContent = {
  // Figma draws «РЕПЕРТУАР»; stored in sentence case and uppercased by CSS so the admin can type normally.
  heading: 'Репертуар',
  downloadLabel: 'скачать список',
  fileUrl: '',
  tracks: figmaTracks,
  footnote: '',
};

/** Name of the generated list file when no `fileUrl` is set. */
export const TRACK_LIST_FILENAME = 'vgul-repertuar.txt';

/**
 * Plain-text body of the generated list download: «1. Исполнитель - Название», one per line, the
 * numbers taken from the position in the array (the same numbers the page shows), then the footnote
 * (the legend for «*») when there is one. CRLF + BOM keep it readable in every Windows editor.
 * Pure on purpose: the Blob / object URL part lives in the click handler, never in render.
 */
export function formatTrackListText(tracks: readonly string[], footnote = ''): string {
  const lines = tracks.map((track, index) => `${index + 1}. ${track}`);
  const legend = footnote.trim();
  return `\uFEFF${lines.join('\r\n')}\r\n${legend ? `\r\n${legend.replace(/\r?\n/g, '\r\n')}\r\n` : ''}`;
}

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
  description:
    'Секция-аккордеон. Закрытая — красный блок с заголовком, кнопкой «скачать список» и большим логотипом (клик по логотипу раскрывает список). Открытая — тёмный нумерованный список песен.',
  fields: [
    { kind: 'text', key: 'heading', label: 'Заголовок', hint: 'На сайте выводится заглавными буквами', maxLength: 40 },
    { kind: 'text', key: 'downloadLabel', label: 'Текст кнопки скачивания', maxLength: 40 },
    {
      kind: 'url',
      key: 'fileUrl',
      label: 'Файл со списком песен',
      placeholder: '/uploads/repertoire.pdf',
      hint: 'Ссылка на PDF или документ. Пусто — кнопка скачивает автоматически собранный текстовый файл (.txt) со списком песен',
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
