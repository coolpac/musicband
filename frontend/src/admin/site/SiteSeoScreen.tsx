import SiteEditorScreen from './SiteEditorScreen';
import SeoPreview from './SeoPreview';
import { SEO_TAB_SCHEMAS } from './sectionGroups';

/** «Сайт → SEO»: мета-данные и аналитика, контакты, юридические документы. */
export default function SiteSeoScreen({ active }: { active: boolean }) {
  return (
    <SiteEditorScreen
      title="SEO и контакты"
      hint="То, что видят поисковики и соцсети, плюс контакты и документы, на которые ссылается сайт."
      schemas={SEO_TAB_SCHEMAS}
      active={active}
      previewFor={(schema, value) => (schema.id === 'seo' ? <SeoPreview value={value} /> : null)}
    />
  );
}
