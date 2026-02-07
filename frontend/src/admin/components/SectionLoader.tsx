/**
 * Локальный лоадер для секции контента (двухфазная загрузка: сначала каркас, потом данные).
 * Не блокирует весь экран — только область контента.
 */
export function SectionLoader({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="admin-section-loading" role="status" aria-live="polite">
      <span className="admin-section-loading__spinner" aria-hidden />
      <span className="admin-section-loading__text">{label}</span>
    </div>
  );
}
