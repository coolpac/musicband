import Modal from '../components/Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Подтверждение разрушительное (уйти без сохранения, вернуть стандартный текст). */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Подтверждение в стиле админки вместо window.confirm.
 * Безопасная кнопка получает фокус при открытии.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Отмена',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={open} onClose={onCancel} title={title} size="sm">
      <p className="site-admin-confirm__text">{message}</p>
      <div className="site-admin-confirm__actions">
        <button
          type="button"
          className="admin-btn admin-btn--secondary admin-btn--full"
          onClick={onCancel}
          disabled={busy}
          autoFocus
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`admin-btn admin-btn--full ${danger ? 'admin-btn--danger' : ''}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Подождите…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
