import SiteEditorScreen from './SiteEditorScreen';
import { CONTENT_TAB_SCHEMAS } from './sectionGroups';

/** «Сайт → Контент»: тексты и картинки блоков публичного сайта. */
export default function SiteContentScreen({ active }: { active: boolean }) {
  return (
    <SiteEditorScreen
      title="Контент сайта"
      hint="Тексты и картинки блоков главной страницы и формы заявки. Пустое поле — блок или элемент не показывается на сайте."
      schemas={CONTENT_TAB_SCHEMAS}
      active={active}
    />
  );
}
