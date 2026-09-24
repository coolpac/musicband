import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { SectionSchema } from '../../site/content/schema';
import type { SectionId } from '../../site/content/types';
import { defaultContent } from '../../site/content/registry';
import { mergeContent } from '../../site/content/resolve';
import { ApiError, formatApiErrorMessage } from '../../services/apiClient';
import { getAdminSiteContent, saveSiteSection } from '../../services/adminSiteService';
import { cloneJson } from './contentModel';
import { validateSectionValue, type FieldErrors } from './validation';
import { useAdminMode } from './AdminModeContext';

type SectionValue = Record<string, unknown>;

export type DraftsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SectionDraftsApi {
  status: DraftsStatus;
  loadError: string | null;
  updatedAt: string | null;
  drafts: Record<string, SectionValue>;
  dirty: Record<string, boolean>;
  anyDirty: boolean;
  savingSection: string | null;
  justSavedSection: string | null;
  showErrors: Record<string, boolean>;
  errorsFor: (section: string) => FieldErrors;
  setSectionValue: (section: string, next: SectionValue) => void;
  saveSection: (section: string) => Promise<boolean>;
  resetSection: (section: string) => void;
  restoreDefaults: (section: string) => Promise<boolean>;
  reload: () => void;
}

/** Дефолты секции по её id (registry типизирован по ключам SiteContent). */
function defaultSection(section: string): unknown {
  return (defaultContent as unknown as Record<string, unknown>)[section];
}

function defaultsFor(section: string): SectionValue {
  return cloneJson((defaultSection(section) ?? {}) as SectionValue);
}

function mergedFor(section: string, saved: unknown): SectionValue {
  const base = defaultSection(section) ?? {};
  return cloneJson(mergeContent(base, saved)) as SectionValue;
}

/**
 * Черновики редактируемых секций: загрузка, «грязное» состояние, сохранение,
 * сброс и защита от ухода с несохранёнными правками.
 *
 * `schemas` должен быть стабильной ссылкой (константа модуля), `active` — экран
 * сейчас показан: до первой активации не делается ни одного запроса.
 */
export function useSectionDrafts(schemas: SectionSchema[], active: boolean): SectionDraftsApi {
  const [status, setStatus] = useState<DraftsStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SectionValue>>({});
  const [baselines, setBaselines] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [justSavedSection, setJustSavedSection] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState<Record<string, boolean>>({});
  const [activated, setActivated] = useState(active);
  const [reloadToken, setReloadToken] = useState(0);

  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  useEffect(() => {
    if (active) setActivated(true);
  }, [active]);

  // Загрузка — только после первого показа экрана (в режиме «Приложение» запросов нет).
  useEffect(() => {
    if (!activated) return;
    let cancelled = false;

    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    setLoadError(null);

    getAdminSiteContent(reloadToken > 0)
      .then((payload) => {
        if (cancelled) return;
        const nextDrafts: Record<string, SectionValue> = {};
        const nextBaselines: Record<string, string> = {};
        for (const schema of schemas) {
          const merged = mergedFor(schema.id, payload.content[schema.id as SectionId]);
          nextDrafts[schema.id] = merged;
          nextBaselines[schema.id] = JSON.stringify(merged);
        }
        setDrafts(nextDrafts);
        setBaselines(nextBaselines);
        setUpdatedAt(payload.updatedAt);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Failed to load site content:', error);
        setLoadError(
          error instanceof ApiError
            ? formatApiErrorMessage(error)
            : 'Не удалось загрузить контент сайта'
        );
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [activated, reloadToken, schemas]);

  const dirty = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const schema of schemas) {
      const draft = drafts[schema.id];
      map[schema.id] = draft != null && JSON.stringify(draft) !== baselines[schema.id];
    }
    return map;
  }, [drafts, baselines, schemas]);

  const anyDirty = useMemo(() => Object.values(dirty).some(Boolean), [dirty]);

  const errorsCache = useMemo(() => {
    const map: Record<string, FieldErrors> = {};
    for (const schema of schemas) {
      const draft = drafts[schema.id];
      map[schema.id] = draft ? validateSectionValue(schema.fields, draft) : {};
    }
    return map;
  }, [drafts, schemas]);

  const errorsFor = useCallback((section: string) => errorsCache[section] ?? {}, [errorsCache]);

  const setSectionValue = useCallback((section: string, next: SectionValue) => {
    setDrafts((prev) => ({ ...prev, [section]: next }));
  }, []);

  const flashSaved = useCallback((section: string) => {
    setJustSavedSection(section);
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => {
      if (mountedRef.current) setJustSavedSection(null);
    }, 2400);
  }, []);

  const saveSection = useCallback(
    async (section: string): Promise<boolean> => {
      const schema = schemas.find((item) => item.id === section);
      const draft = drafts[section];
      if (!schema || !draft) return false;

      const errors = validateSectionValue(schema.fields, draft);
      if (Object.keys(errors).length > 0) {
        setShowErrors((prev) => ({ ...prev, [section]: true }));
        toast.error('Проверьте подсвеченные поля');
        return false;
      }

      setSavingSection(section);
      try {
        const result = await saveSiteSection(section as SectionId, draft);
        if (!mountedRef.current) return true;
        setBaselines((prev) => ({ ...prev, [section]: JSON.stringify(draft) }));
        setShowErrors((prev) => ({ ...prev, [section]: false }));
        if (result.updatedAt) setUpdatedAt(result.updatedAt);
        flashSaved(section);
        toast.success(`Раздел «${schema.title}» сохранён`);
        return true;
      } catch (error) {
        console.error('Failed to save site section:', error);
        toast.error(
          error instanceof ApiError
            ? `Не удалось сохранить: ${formatApiErrorMessage(error)}`
            : 'Не удалось сохранить раздел'
        );
        return false;
      } finally {
        if (mountedRef.current) setSavingSection(null);
      }
    },
    [drafts, flashSaved, schemas]
  );

  const resetSection = useCallback(
    (section: string) => {
      const baseline = baselines[section];
      if (!baseline) return;
      setDrafts((prev) => ({ ...prev, [section]: JSON.parse(baseline) as SectionValue }));
      setShowErrors((prev) => ({ ...prev, [section]: false }));
    },
    [baselines]
  );

  const restoreDefaults = useCallback(
    async (section: string): Promise<boolean> => {
      const schema = schemas.find((item) => item.id === section);
      if (!schema) return false;

      setSavingSection(section);
      try {
        // Пустой объект = «ничего не переопределяем», сайт возьмёт текст из макета.
        const result = await saveSiteSection(section as SectionId, {});
        if (!mountedRef.current) return true;
        const fresh = defaultsFor(section);
        setDrafts((prev) => ({ ...prev, [section]: fresh }));
        setBaselines((prev) => ({ ...prev, [section]: JSON.stringify(fresh) }));
        setShowErrors((prev) => ({ ...prev, [section]: false }));
        if (result.updatedAt) setUpdatedAt(result.updatedAt);
        flashSaved(section);
        toast.success(`Раздел «${schema.title}»: вернули стандартный текст`);
        return true;
      } catch (error) {
        console.error('Failed to restore site section defaults:', error);
        toast.error(
          error instanceof ApiError
            ? `Не удалось вернуть стандартный текст: ${formatApiErrorMessage(error)}`
            : 'Не удалось вернуть стандартный текст'
        );
        return false;
      } finally {
        if (mountedRef.current) setSavingSection(null);
      }
    },
    [flashSaved, schemas]
  );

  const discardAll = useCallback(() => {
    setDrafts((prev) => {
      const next: Record<string, SectionValue> = { ...prev };
      for (const [section, baseline] of Object.entries(baselines)) {
        next[section] = JSON.parse(baseline) as SectionValue;
      }
      return next;
    });
    setShowErrors({});
  }, [baselines]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  // Пока экран активен — оболочка админки спрашивает подтверждение перед уходом.
  const modeContext = useAdminMode();
  const dirtyRef = useRef(false);
  const discardRef = useRef(discardAll);

  useEffect(() => {
    dirtyRef.current = anyDirty;
  }, [anyDirty]);

  useEffect(() => {
    discardRef.current = discardAll;
  }, [discardAll]);

  useEffect(() => {
    if (!active || !modeContext) return;
    return modeContext.registerUnsavedGuard({
      hasUnsavedChanges: () => dirtyRef.current,
      discardChanges: () => discardRef.current(),
    });
  }, [active, modeContext]);

  return {
    status,
    loadError,
    updatedAt,
    drafts,
    dirty,
    anyDirty,
    savingSection,
    justSavedSection,
    showErrors,
    errorsFor,
    setSectionValue,
    saveSection,
    resetSection,
    restoreDefaults,
    reload,
  };
}
