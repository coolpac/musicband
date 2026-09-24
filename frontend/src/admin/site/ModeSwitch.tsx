import { useRef } from 'react';
import { hapticSelection } from '../../telegram/telegramWebApp';
import type { AdminMode } from './AdminModeContext';
import './ModeSwitch.css';

const MODES: Array<{ id: AdminMode; label: string; hint: string }> = [
  { id: 'app', label: 'Приложение', hint: 'Управление Telegram-приложением' },
  { id: 'site', label: 'Сайт', hint: 'Управление публичным сайтом' },
];

interface ModeSwitchProps {
  mode: AdminMode;
  onChange: (mode: AdminMode) => void;
}

/**
 * Сегментированный переключатель режима админки.
 * Семантика radiogroup: стрелки/Home/End переводят выбор и фокус, как в нативной группе радио.
 */
export default function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (next: AdminMode) => {
    if (next !== mode) hapticSelection();
    onChange(next);
  };

  const moveTo = (index: number) => {
    const clamped = (index + MODES.length) % MODES.length;
    const target = MODES[clamped];
    select(target.id);
    buttonsRef.current[clamped]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        moveTo(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        moveTo(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        moveTo(MODES.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="admin-modeswitch" role="radiogroup" aria-label="Режим админки">
      <span className="admin-modeswitch__thumb" data-mode={mode} aria-hidden="true" />
      {MODES.map((item, index) => {
        const isActive = item.id === mode;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            title={item.hint}
            className={`admin-modeswitch__option ${isActive ? 'admin-modeswitch__option--active' : ''}`}
            onClick={() => select(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
