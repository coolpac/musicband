import type { SectionSchema } from '../../site/content/schema';
import { sectionSchemas } from '../../site/content/registry';

/** Эти секции живут во вкладке «SEO», чтобы не мешаться в списке блоков страницы. */
const SEO_TAB_SECTION_IDS = ['seo', 'contacts', 'legal'] as const;

const seoIds = new Set<string>(SEO_TAB_SECTION_IDS);

/** Вкладка «Контент»: блоки страницы в порядке из registry. */
export const CONTENT_TAB_SCHEMAS: SectionSchema[] = sectionSchemas.filter(
  (schema) => !seoIds.has(schema.id)
);

/** Вкладка «SEO»: мета-данные, контакты и юридические документы. */
export const SEO_TAB_SCHEMAS: SectionSchema[] = SEO_TAB_SECTION_IDS.map((id) =>
  sectionSchemas.find((schema) => schema.id === id)
).filter((schema): schema is SectionSchema => schema != null);
