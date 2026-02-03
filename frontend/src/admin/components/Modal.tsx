import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { hapticImpact } from '../../telegram/telegramWebApp';
import '../../styles/admin.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    hapticImpact('light');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const modal = (
    <div className="admin-modal" onClick={handleBackdropClick}>
      <div className={`admin-modal__content admin-modal__content--${size}`}>
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">{title}</h2>
          <button
            className="admin-modal__close"
            onClick={handleClose}
            aria-label="Закрыть"
            type="button"
          >
            ×
          </button>
        </div>
        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
