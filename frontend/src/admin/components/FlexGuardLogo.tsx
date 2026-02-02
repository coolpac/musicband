import './FlexGuardLogo.css';

type FlexGuardLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
};

export default function FlexGuardLogo({ size = 'lg', showBadge = true }: FlexGuardLogoProps) {
  return (
    <div className={`flexguard-logo flexguard-logo--${size}`} aria-hidden>
      {showBadge && (
        <div className="flexguard-logo__badge">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
            className="flexguard-logo__shield"
          >
            <defs>
              <linearGradient id="flexguard-shield-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34c759" />
                <stop offset="100%" stopColor="#248a3d" />
              </linearGradient>
              <linearGradient id="flexguard-shine" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <path
              d="M24 4L8 10v10c0 10 8 16 16 20 8-4 16-10 16-20V10L24 4z"
              fill="url(#flexguard-shield-gradient)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M24 4L8 10v10c0 10 8 16 16 20 8-4 16-10 16-20V10L24 4z"
              fill="url(#flexguard-shine)"
              fillOpacity="1"
              opacity="0.6"
            />
            <path
              d="M18 22l4 4 8-8"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      )}
      <span className="flexguard-logo__text">
        <span className="flexguard-logo__flex">Flex</span>
        <span className="flexguard-logo__guard">Guard</span>
      </span>
    </div>
  );
}
