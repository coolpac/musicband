import type { SectionSchema } from '../schema';

export interface PartnersContent {
  heading: string;
}

/** «Наши партнёры» — verbatim from Figma (345:1421), «ё» included. */
export const partnersDefaults: PartnersContent = { heading: 'Наши партнёры' };

export const partnersSchema: SectionSchema = {
  id: 'partners',
  title: 'Партнёры',
  description: 'Плитки берутся из раздела «Партнёры». Пока партнёров нет — секция не выводится.',
  fields: [{ kind: 'text', key: 'heading', label: 'Заголовок', maxLength: 60 }],
};
