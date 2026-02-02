import './AdminTerminalLoader.css';

/** Минимальное время показа лоадера (мс). Увеличьте, чтобы дольше видеть анимацию. */
export const MIN_LOADER_DISPLAY_MS = 2500;

export default function AdminTerminalLoader() {
  return (
    <div className="admin-terminal-loader" role="status" aria-live="polite" aria-label="Загрузка">
      <div className="admin-terminal-loader__noise" aria-hidden />
      <div className="admin-terminal-loader__binary" aria-hidden />
      <div className="admin-terminal-loader__window">
        <div className="admin-terminal-loader__titlebar">
          <span className="admin-terminal-loader__dots">
            <span className="admin-terminal-loader__dot" />
            <span className="admin-terminal-loader__dot" />
            <span className="admin-terminal-loader__dot" />
          </span>
          <span className="admin-terminal-loader__title">root@flexguard:~# ACCESS_ADMIN</span>
        </div>
        <div className="admin-terminal-loader__body">
          <div className="admin-terminal-loader__line admin-terminal-loader__line--1">
            <span className="admin-terminal-loader__tag">[SYS]</span>
            <span> INIT core...</span>
            <span className="admin-terminal-loader__ok"> OK</span>
          </div>
          <div className="admin-terminal-loader__line admin-terminal-loader__line--2">
            <span className="admin-terminal-loader__tag">[AUTH]</span>
            <span> VERIFY token...</span>
            <span className="admin-terminal-loader__ok"> OK</span>
          </div>
          <div className="admin-terminal-loader__line admin-terminal-loader__line--3">
            <span className="admin-terminal-loader__tag">[LOAD]</span>
            <span> FETCH modules </span>
            <span className="admin-terminal-loader__glitch" data-text="LOADING">
              LOADING
            </span>
            <span className="admin-terminal-loader__cursor" aria-hidden />
          </div>
          <div className="admin-terminal-loader__progress-wrap">
            <span className="admin-terminal-loader__progress-label">[</span>
            <div className="admin-terminal-loader__progress-bar">
              <div className="admin-terminal-loader__progress-fill" />
            </div>
            <span className="admin-terminal-loader__progress-label">]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
