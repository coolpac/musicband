import { useId, useState, type ReactNode } from 'react';
import type { SectionSchema } from '../../site/content/schema';
import { FieldList } from './FieldRenderer';
import ConfirmDialog from './ConfirmDialog';
import { sectionSiteLink } from './contentModel';
import type { FieldErrors } from './validation';

interface SectionPanelProps {
  schema: SectionSchema;
  value: Record<string, unknown>;
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
  showErrors: boolean;
  errors: FieldErrors;
  onChange: (next: Record<string, unknown>) => void;
  onSave: () => void;
  onResetChanges: () => void;
  onRestoreDefaults: () => void;
  /** Доп. блок под заголовком (например, превью сниппета в поиске). */
  preview?: ReactNode;
}

/** Форма одной секции: заголовок, действия и поля, сгенерированные по схеме. */
export default function SectionPanel({
  schema,
  value,
  dirty,
  saving,
  justSaved,
  showErrors,
  errors,
  onChange,
  onSave,
  onResetChanges,
  onRestoreDefaults,
  preview,
}: SectionPanelProps) {
  const headingId = useId();
  const [confirmRestore, setConfirmRestore] = useState(false);
  const errorCount = showErrors ? Object.keys(errors).length : 0;

  return (
    <section className="site-admin-panel" aria-labelledby={headingId}>
      <header className="site-admin-panel__head">
        <div className="site-admin-panel__headings">
          <h2 className="site-admin-panel__title" id={headingId}>
            {schema.title}
          </h2>
          {schema.description && <p className="site-admin-panel__desc">{schema.description}</p>}
        </div>
        <div className="site-admin-panel__status" aria-live="polite">
          {dirty && <span className="site-admin-panel__dirty">не сохранено</span>}
          {!dirty && justSaved && <span className="site-admin-panel__saved">Сохранено</span>}
        </div>
        <a
          className="site-admin-panel__link"
          href={sectionSiteLink(schema.id)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть на сайте
          <span aria-hidden="true"> ↗</span>
        </a>
      </header>

      {preview}

      <form
        className="admin-form site-admin-panel__form"
        /* Проверяем поля сами: браузерная валидация не умеет показывать ошибку
           внутри свёрнутого элемента списка и молча блокирует отправку. */
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <FieldList
          fields={schema.fields}
          value={value}
          path=""
          errors={errors}
          showErrors={showErrors}
          onChange={onChange}
        />

        {errorCount > 0 && (
          <p className="site-admin-panel__form-error" role="alert">
            Не сохранено: ошибок в полях — {errorCount}. Исправьте подсвеченные поля.
          </p>
        )}

        {/* Второстепенные действия — обычной строкой, чтобы липкая панель осталась компактной */}
        <div className="site-admin-panel__secondary">
          <button
            type="button"
            className="admin-btn admin-btn--secondary site-admin-btn--compact"
            onClick={onResetChanges}
            disabled={saving || !dirty}
          >
            Сбросить изменения
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--secondary site-admin-btn--compact site-admin-panel__restore"
            onClick={() => setConfirmRestore(true)}
            disabled={saving}
          >
            Вернуть стандартный текст
          </button>
        </div>

        <div className="site-admin-panel__actions">
          <button type="submit" className="admin-btn site-admin-panel__save" disabled={saving || !dirty}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <span className="site-admin-panel__actions-hint">
            {dirty ? 'Есть несохранённые изменения' : 'Всё сохранено'}
          </span>
        </div>
      </form>

      <ConfirmDialog
        open={confirmRestore}
        title="Вернуть стандартный текст?"
        message={`Раздел «${schema.title}» вернётся к тексту из макета. Ваши правки в этом разделе будут удалены с сервера.`}
        confirmLabel="Вернуть стандартный"
        danger
        busy={saving}
        onCancel={() => setConfirmRestore(false)}
        onConfirm={() => {
          setConfirmRestore(false);
          onRestoreDefaults();
        }}
      />
    </section>
  );
}
