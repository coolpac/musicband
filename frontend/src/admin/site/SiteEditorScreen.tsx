import { useMemo, useState, type ReactNode } from 'react';
import AdminHeader from '../components/AdminHeader';
import { SectionLoader } from '../components/SectionLoader';
import { hapticSelection } from '../../telegram/telegramWebApp';
import type { SectionSchema } from '../../site/content/schema';
import { useSectionDrafts } from './useSectionDrafts';
import SectionPanel from './SectionPanel';
import ConfirmDialog from './ConfirmDialog';
import { formatUpdatedAt } from './contentModel';
import '../../styles/admin.css';
import './siteAdmin.css';

interface SiteEditorScreenProps {
  title: string;
  hint: string;
  /** Стабильная (модульная) константа: используется как зависимость эффекта загрузки. */
  schemas: SectionSchema[];
  /** Экран сейчас показан. До первого показа не делается ни одного запроса. */
  active: boolean;
  previewFor?: (schema: SectionSchema, value: Record<string, unknown>) => ReactNode;
}

/**
 * Общий каркас редакторов контента сайта («Контент» и «SEO»):
 * список разделов + форма выбранного раздела, сгенерированная по его схеме.
 */
export default function SiteEditorScreen({
  title,
  hint,
  schemas,
  active,
  previewFor,
}: SiteEditorScreenProps) {
  const drafts = useSectionDrafts(schemas, active);
  const [selectedId, setSelectedId] = useState(schemas[0]?.id ?? '');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const selected = useMemo(
    () => schemas.find((schema) => schema.id === selectedId) ?? schemas[0],
    [schemas, selectedId]
  );

  const selectSection = (id: string) => {
    if (id === selectedId) return;
    hapticSelection();
    if (drafts.dirty[selectedId]) {
      setPendingId(id);
      return;
    }
    setSelectedId(id);
  };

  const confirmSwitch = () => {
    if (pendingId == null) return;
    drafts.resetSection(selectedId);
    setSelectedId(pendingId);
    setPendingId(null);
  };

  const updatedAtLabel = formatUpdatedAt(drafts.updatedAt);
  const draft = selected ? drafts.drafts[selected.id] : undefined;

  return (
    <div className="admin-screen">
      <AdminHeader />
      <div className="admin-content site-admin">
        <div className="site-admin__intro">
          <h1 className="admin-title site-admin__title">{title}</h1>
          <p className="admin-title-hint">{hint}</p>
          <div className="site-admin__meta">
            {updatedAtLabel && <span className="site-admin__updated">Обновлено: {updatedAtLabel}</span>}
            <button
              type="button"
              className="admin-btn admin-btn--secondary site-admin-btn--compact"
              onClick={drafts.reload}
              disabled={drafts.status === 'loading' || drafts.anyDirty}
              title={
                drafts.anyDirty
                  ? 'Сначала сохраните или сбросьте изменения'
                  : 'Перечитать контент с сервера'
              }
            >
              Обновить
            </button>
          </div>
        </div>

        {drafts.status === 'loading' || drafts.status === 'idle' ? (
          <SectionLoader label="Загрузка контента…" />
        ) : drafts.status === 'error' ? (
          <div className="site-admin__error" role="alert">
            <p className="site-admin__error-text">{drafts.loadError}</p>
            <button type="button" className="admin-btn" onClick={drafts.reload}>
              Повторить
            </button>
          </div>
        ) : !selected || !draft ? (
          <div className="site-admin__error" role="alert">
            <p className="site-admin__error-text">Нет доступных разделов для редактирования.</p>
          </div>
        ) : (
          <div className="site-admin__layout">
            <nav className="site-admin__nav" aria-label="Разделы сайта">
              <ul className="site-admin__nav-list">
                {schemas.map((schema) => {
                  const isActive = schema.id === selected.id;
                  return (
                    <li key={schema.id} className="site-admin__nav-item">
                      <button
                        type="button"
                        className={`site-admin__nav-btn ${isActive ? 'site-admin__nav-btn--active' : ''}`}
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => selectSection(schema.id)}
                      >
                        <span className="site-admin__nav-label">{schema.title}</span>
                        {drafts.dirty[schema.id] && (
                          <>
                            <span
                              className="site-admin__nav-dot"
                              aria-hidden="true"
                              title="Есть несохранённые изменения"
                            />
                            <span className="site-admin__sr">есть несохранённые изменения</span>
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="site-admin__pane">
              <SectionPanel
                key={selected.id}
                schema={selected}
                value={draft}
                dirty={Boolean(drafts.dirty[selected.id])}
                saving={drafts.savingSection === selected.id}
                justSaved={drafts.justSavedSection === selected.id}
                showErrors={Boolean(drafts.showErrors[selected.id])}
                errors={drafts.errorsFor(selected.id)}
                onChange={(next) => drafts.setSectionValue(selected.id, next)}
                onSave={() => void drafts.saveSection(selected.id)}
                onResetChanges={() => drafts.resetSection(selected.id)}
                onRestoreDefaults={() => void drafts.restoreDefaults(selected.id)}
                preview={previewFor?.(selected, draft)}
              />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingId != null}
        title="Несохранённые изменения"
        message="В этом разделе есть правки, которые ещё не сохранены. Перейти к другому разделу и потерять их?"
        confirmLabel="Перейти без сохранения"
        cancelLabel="Остаться"
        danger
        onCancel={() => setPendingId(null)}
        onConfirm={confirmSwitch}
      />
    </div>
  );
}
