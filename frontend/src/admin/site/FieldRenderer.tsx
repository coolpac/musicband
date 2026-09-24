import { useCallback, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import { uploadSiteImage } from '../../services/adminSiteService';
import type {
  Field,
  GroupField,
  ImageField,
  ListField,
  StringListField,
  TextField,
  TextareaField,
  ToggleField,
} from '../../site/content/schema';
import type { RemoteImage } from '../../site/content/types';
import { emptyItemForList, isPlainObject, isRemoteImage, listItemTitle } from './contentModel';
import type { FieldErrors } from './validation';

interface NodeProps<F extends Field = Field> {
  field: F;
  value: unknown;
  /** Путь до поля в объекте секции — ключ ошибки и часть id контрола. */
  path: string;
  errors: FieldErrors;
  showErrors: boolean;
  onChange: (next: unknown) => void;
}

/* ─────────────────────────── общие мелочи ─────────────────────────── */

function useFieldIds(path: string) {
  const uid = useId();
  const base = `${uid}${path}`;
  return { controlId: base, hintId: `${base}-hint`, errorId: `${base}-error` };
}

function describedBy(hint: string | undefined, hintId: string, error: string | null, errorId: string) {
  const ids = [hint ? hintId : null, error ? errorId : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function FieldFooter({
  hint,
  hintId,
  error,
  errorId,
  counter,
}: {
  hint?: string;
  hintId: string;
  error: string | null;
  errorId: string;
  counter?: { length: number; max: number };
}) {
  const nearLimit = counter != null && counter.length > counter.max * 0.9;
  const overLimit = counter != null && counter.length > counter.max;

  return (
    <div className="site-admin-field__footer">
      <div className="site-admin-field__messages">
        {hint && (
          <p className="site-admin-field__hint" id={hintId}>
            {hint}
          </p>
        )}
        {error && (
          <p className="site-admin-field__error" id={errorId} role="alert">
            {error}
          </p>
        )}
      </div>
      {counter && (
        <span
          className={`site-admin-field__counter ${
            overLimit
              ? 'site-admin-field__counter--over'
              : nearLimit
                ? 'site-admin-field__counter--near'
                : ''
          }`}
          aria-hidden="true"
        >
          {counter.length} / {counter.max}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────── text / url / tel / email ─────────────────────────── */

const INPUT_TYPES: Record<TextField['kind'], string> = {
  text: 'text',
  // type="url" включает браузерную валидацию, которая ломает относительные ссылки («/booking»)
  url: 'text',
  tel: 'tel',
  email: 'email',
};

function TextControl({ field, value, path, errors, showErrors, onChange }: NodeProps<TextField>) {
  const { controlId, hintId, errorId } = useFieldIds(path);
  const text = typeof value === 'string' ? value : '';
  const error = showErrors ? (errors[path] ?? null) : null;

  return (
    <div className="site-admin-field">
      <label className="admin-form-label" htmlFor={controlId}>
        {field.label}
      </label>
      <input
        id={controlId}
        type={INPUT_TYPES[field.kind]}
        inputMode={field.kind === 'tel' ? 'tel' : field.kind === 'email' ? 'email' : undefined}
        className={`admin-form-input site-admin-field__input ${error ? 'site-admin-field__input--invalid' : ''}`}
        value={text}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(field.hint, hintId, error, errorId)}
      />
      <FieldFooter
        hint={field.hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
        counter={field.maxLength != null ? { length: text.length, max: field.maxLength } : undefined}
      />
    </div>
  );
}

/* ─────────────────────────── textarea ─────────────────────────── */

function TextareaControl({ field, value, path, errors, showErrors, onChange }: NodeProps<TextareaField>) {
  const { controlId, hintId, errorId } = useFieldIds(path);
  const text = typeof value === 'string' ? value : '';
  const error = showErrors ? (errors[path] ?? null) : null;
  const ref = useRef<HTMLTextAreaElement>(null);

  const autoGrow = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight === 0, когда элемент скрыт (display:none) — высоту тогда не трогаем.
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [text, autoGrow]);

  return (
    <div className="site-admin-field">
      <label className="admin-form-label" htmlFor={controlId}>
        {field.label}
      </label>
      <textarea
        id={controlId}
        ref={ref}
        rows={field.rows ?? 3}
        className={`admin-form-input site-admin-field__textarea ${error ? 'site-admin-field__input--invalid' : ''}`}
        value={text}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onFocus={autoGrow}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(field.hint, hintId, error, errorId)}
      />
      <FieldFooter
        hint={field.hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
        counter={field.maxLength != null ? { length: text.length, max: field.maxLength } : undefined}
      />
    </div>
  );
}

/* ─────────────────────────── toggle ─────────────────────────── */

function ToggleControl({ field, value, path, onChange }: NodeProps<ToggleField>) {
  const { controlId, hintId } = useFieldIds(path);
  const checked = value === true;

  return (
    <div className="site-admin-field site-admin-field--toggle">
      <div className="admin-form-toggle-row">
        <label className="admin-form-label admin-form-toggle-label" htmlFor={controlId}>
          {field.label}
        </label>
        {/* label-обёртка: клик по самому переключателю тоже работает */}
        <label className="admin-toggle">
          <input
            id={controlId}
            type="checkbox"
            className="admin-toggle__input"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            aria-describedby={field.hint ? hintId : undefined}
          />
          <span className="admin-toggle__slider" />
        </label>
      </div>
      {field.hint && (
        <p className="site-admin-field__hint" id={hintId}>
          {field.hint}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────── image ─────────────────────────── */

function ImageControl({ field, value, path, onChange }: NodeProps<ImageField>) {
  const { hintId } = useFieldIds(path);
  const image: RemoteImage | null = isRemoteImage(value) ? value : null;
  const [uploading, setUploading] = useState(false);
  /** Инкремент перемонтирует FileUpload, чтобы сбросить его внутреннее превью. */
  const [resetToken, setResetToken] = useState(0);

  const handleUpload = async (url: string) => {
    if (!url) {
      onChange(null);
      return;
    }
    if (!url.startsWith('data:')) {
      onChange({ src: url });
      return;
    }

    // Неудачная загрузка не должна стирать уже сохранённую картинку — возвращаем прежнюю.
    const previous = image;
    setUploading(true);
    try {
      const uploaded = await uploadSiteImage(url, `${field.key}.jpg`);
      onChange(uploaded);
      toast.success('Изображение загружено');
    } catch (error) {
      console.error('Failed to upload site image:', error);
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить изображение');
      onChange(previous);
      // Превью в FileUpload осталось от неудачной попытки — убираем, чтобы не вводить в заблуждение.
      setResetToken((token) => token + 1);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="site-admin-field site-admin-field--image">
      <span className="admin-form-label">{field.label}</span>
      <FileUpload
        // Перемонтируем, чтобы внутреннее превью не «залипало» после сброса к стандартной.
        key={`${image ? image.src : 'default'}-${resetToken}`}
        currentImage={image?.src}
        onUpload={handleUpload}
        preset="poster"
        maxSize={5}
      />
      <div className="site-admin-field__image-row">
        <span className="site-admin-field__image-state">
          {uploading
            ? 'Загрузка на сервер…'
            : image
              ? `Своя картинка${image.width && image.height ? ` · ${image.width}×${image.height}` : ''}`
              : 'Используется картинка из макета'}
        </span>
        {image && !uploading && (
          <button
            type="button"
            className="admin-btn admin-btn--secondary site-admin-btn--compact site-admin-field__image-reset"
            onClick={() => onChange(null)}
          >
            Сбросить к стандартной
          </button>
        )}
      </div>
      {field.hint && (
        <p className="site-admin-field__hint" id={hintId}>
          {field.hint}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────── stringList ─────────────────────────── */

function toLines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function StringListControl({ field, value, path, errors, showErrors, onChange }: NodeProps<StringListField>) {
  const { controlId, hintId, errorId } = useFieldIds(path);
  const items = toLines(value);
  const error = showErrors ? (errors[path] ?? null) : null;
  const [text, setText] = useState(() => items.join('\n'));

  // Внешнее изменение (переключение раздела, сброс) — перезаливаем буфер.
  useEffect(() => {
    setText((current) => (sameLines(parseLines(current), items) ? current : items.join('\n')));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сравнение по содержимому, не по ссылке
  }, [items.join('\n')]);

  const handleChange = (next: string) => {
    setText(next);
    onChange(parseLines(next));
  };

  return (
    <div className="site-admin-field">
      <label className="admin-form-label" htmlFor={controlId}>
        {field.label}
      </label>
      <textarea
        id={controlId}
        className={`admin-form-input site-admin-field__textarea site-admin-field__lines ${
          error ? 'site-admin-field__input--invalid' : ''
        }`}
        rows={Math.min(Math.max(items.length + 1, 3), 14)}
        value={text}
        placeholder={field.itemPlaceholder}
        onChange={(event) => handleChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(field.hint ?? 'Каждая строка — отдельный пункт', hintId, error, errorId)}
      />
      <FieldFooter
        hint={field.hint ?? 'Каждая строка — отдельный пункт'}
        hintId={hintId}
        error={error}
        errorId={errorId}
        counter={
          field.maxItems != null ? { length: items.length, max: field.maxItems } : undefined
        }
      />
      {field.maxItems == null && (
        <span className="site-admin-field__counter site-admin-field__counter--static" aria-hidden="true">
          Строк: {items.length}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────── group ─────────────────────────── */

function GroupControl({ field, value, path, errors, showErrors, onChange }: NodeProps<GroupField>) {
  const groupValue = isPlainObject(value) ? value : {};

  return (
    <fieldset className="site-admin-group">
      <legend className="site-admin-group__legend">{field.label}</legend>
      {field.hint && <p className="site-admin-field__hint site-admin-group__hint">{field.hint}</p>}
      <div className="site-admin-group__body">
        <FieldList
          fields={field.fields}
          value={groupValue}
          path={path}
          errors={errors}
          showErrors={showErrors}
          onChange={(next) => onChange(next)}
        />
      </div>
    </fieldset>
  );
}

/* ─────────────────────────── list ─────────────────────────── */

const REMOVE_ANIMATION_MS = 180;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function ListControl({ field, value, path, errors, showErrors, onChange }: NodeProps<ListField>) {
  const items = Array.isArray(value) ? value : [];
  const listError = showErrors ? (errors[path] ?? null) : null;
  const { controlId, errorId, hintId } = useFieldIds(path);
  const [openIndex, setOpenIndex] = useState<number | null>(items.length === 1 ? 0 : null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (removeTimer.current) clearTimeout(removeTimer.current);
    },
    []
  );

  const canAdd = field.maxItems == null || items.length < field.maxItems;
  const canRemove = field.minItems == null || items.length > field.minItems;

  const commit = (next: unknown[]) => onChange(next);

  const handleAdd = () => {
    // Во время анимации удаления состояние списка ещё не зафиксировано.
    if (!canAdd || removingIndex != null) return;
    commit([...items, emptyItemForList(field.fields)]);
    setOpenIndex(items.length);
  };

  const handleRemove = (index: number) => {
    if (!canRemove || removingIndex != null) return;

    const finish = () => {
      commit(items.filter((_, i) => i !== index));
      setOpenIndex((current) => {
        if (current == null) return null;
        if (current === index) return null;
        return current > index ? current - 1 : current;
      });
      setRemovingIndex(null);
    };

    if (prefersReducedMotion()) {
      finish();
      return;
    }

    setRemovingIndex(index);
    removeTimer.current = setTimeout(finish, REMOVE_ANIMATION_MS);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length || removingIndex != null) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
    setOpenIndex((current) => {
      if (current === index) return target;
      if (current === target) return index;
      return current;
    });
  };

  return (
    <div
      className="site-admin-list"
      role="group"
      aria-labelledby={controlId}
      aria-describedby={describedBy(field.hint, hintId, listError, errorId)}
    >
      <div className="site-admin-list__head">
        <span className="admin-form-label" id={controlId}>
          {field.label}
        </span>
        <span className="site-admin-list__count">
          {items.length}
          {field.maxItems != null ? ` / ${field.maxItems}` : ''}
        </span>
      </div>
      {field.hint && (
        <p className="site-admin-field__hint" id={hintId}>
          {field.hint}
        </p>
      )}
      {listError && (
        <p className="site-admin-field__error" id={errorId} role="alert">
          {listError}
        </p>
      )}

      {items.length === 0 ? (
        <p className="site-admin-list__empty">Пока пусто — добавьте первый пункт.</p>
      ) : (
        <ul className="site-admin-list__items">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            const itemPath = `${path}.${index}`;
            const itemErrorCount = showErrors
              ? Object.keys(errors).filter((key) => key.startsWith(`${itemPath}.`)).length
              : 0;

            return (
              <li
                key={index}
                className={`site-admin-list__item ${isOpen ? 'site-admin-list__item--open' : ''} ${
                  removingIndex === index ? 'site-admin-list__item--removing' : ''
                }`}
              >
                <div className="site-admin-list__bar">
                  <button
                    type="button"
                    className="site-admin-list__toggle"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <span className="site-admin-list__chevron" aria-hidden="true" />
                    <span className="site-admin-list__title">
                      {listItemTitle(item, field.itemLabel, index, field.titleKey)}
                    </span>
                    {itemErrorCount > 0 && (
                      <span className="site-admin-list__badge" title="Есть ошибки в полях">
                        <span aria-hidden="true">{itemErrorCount}</span>
                        <span className="site-admin__sr">ошибок в полях: {itemErrorCount}</span>
                      </span>
                    )}
                  </button>
                  <div className="site-admin-list__controls">
                    <button
                      type="button"
                      className="site-admin-icon-btn"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      aria-label={`Переместить «${listItemTitle(item, field.itemLabel, index, field.titleKey)}» выше`}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path d="M7 2.5L12 8.5H2L7 2.5Z" fill="currentColor" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="site-admin-icon-btn"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === items.length - 1}
                      aria-label={`Переместить «${listItemTitle(item, field.itemLabel, index, field.titleKey)}» ниже`}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path d="M7 11.5L2 5.5H12L7 11.5Z" fill="currentColor" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="site-admin-icon-btn site-admin-icon-btn--danger"
                      onClick={() => handleRemove(index)}
                      disabled={!canRemove}
                      aria-label={`Удалить «${listItemTitle(item, field.itemLabel, index, field.titleKey)}»`}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path
                          d="M3 3l8 8M11 3l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="site-admin-list__panel" inert={!isOpen}>
                  <div className="site-admin-list__panel-inner">
                    <FieldList
                      fields={field.fields}
                      value={isPlainObject(item) ? item : {}}
                      path={itemPath}
                      errors={errors}
                      showErrors={showErrors}
                      onChange={(nextItem) => {
                        const next = [...items];
                        next[index] = nextItem;
                        commit(next);
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="admin-btn admin-btn--secondary site-admin-btn--compact site-admin-list__add"
        onClick={handleAdd}
        disabled={!canAdd}
      >
        + Добавить: {field.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

/* ─────────────────────────── диспетчер ─────────────────────────── */

function FieldNode(props: NodeProps) {
  const { field } = props;
  switch (field.kind) {
    case 'text':
    case 'url':
    case 'tel':
    case 'email':
      return <TextControl {...props} field={field} />;
    case 'textarea':
      return <TextareaControl {...props} field={field} />;
    case 'toggle':
      return <ToggleControl {...props} field={field} />;
    case 'image':
      return <ImageControl {...props} field={field} />;
    case 'stringList':
      return <StringListControl {...props} field={field} />;
    case 'group':
      return <GroupControl {...props} field={field} />;
    case 'list':
      return <ListControl {...props} field={field} />;
    default:
      return null;
  }
}

export interface FieldListProps {
  fields: Field[];
  value: Record<string, unknown>;
  /** Префикс пути: '' на верхнем уровне секции. */
  path: string;
  errors: FieldErrors;
  showErrors: boolean;
  onChange: (next: Record<string, unknown>) => void;
}

/** Рекурсивный рендер списка полей по схеме секции. */
export function FieldList({ fields, value, path, errors, showErrors, onChange }: FieldListProps) {
  return (
    <>
      {fields.map((field) => (
        <FieldNode
          key={field.key}
          field={field}
          value={value[field.key]}
          path={path ? `${path}.${field.key}` : field.key}
          errors={errors}
          showErrors={showErrors}
          onChange={(next) => onChange({ ...value, [field.key]: next })}
        />
      ))}
    </>
  );
}
