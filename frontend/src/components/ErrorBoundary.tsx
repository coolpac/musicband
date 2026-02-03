import { Component, type ErrorInfo, type ReactNode } from 'react';
import { hapticImpact } from '../telegram/telegramWebApp';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary — ловит JavaScript-ошибки в дереве компонентов.
 * Должен быть class component (Error Boundaries не поддерживают hooks).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    hapticImpact('light');
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__glass">
            <p className="error-boundary__message">
              Что-то пошло не так. Обновите страницу.
            </p>
            <button
              type="button"
              className="error-boundary__btn"
              onClick={this.handleReload}
            >
              Обновить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
