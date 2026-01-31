import './NetworkError.css';

type NetworkErrorProps = {
  message?: string;
  onRetry?: () => void;
};

/**
 * Блок для отображения сетевой ошибки: иконка, текст, кнопка «Попробовать снова».
 */
export default function NetworkError({
  message = 'Не удалось загрузить данные. Проверьте подключение к интернету.',
  onRetry,
}: NetworkErrorProps) {
  return (
    <div className="network-error">
      <div className="network-error__glass">
        <svg
          className="network-error__icon"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 1l22 22" />
          <path d="M16.72 11.06A10.94 10.94 0 0119 12c0 .94-.16 1.84-.44 2.68" />
          <path d="M12 3a10 10 0 019.12 5.88" />
          <path d="M3 3a18 18 0 015.88 9.12" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        <p className="network-error__message">{message}</p>
        {onRetry && (
          <button type="button" className="network-error__btn" onClick={onRetry}>
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
}
