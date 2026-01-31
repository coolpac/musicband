/**
 * Tab Bar Icons for Admin Panel
 * Based on provided screenshots
 */

export const HomeIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <path
      d="M9 22V12H15V22"
      stroke={active ? "#000" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CalendarIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <path
      d="M16 2V6"
      stroke={active ? "#000" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 2V6"
      stroke={active ? "#000" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10H21"
      stroke={active ? "#000" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ClockIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <path
      d="M12 6V12L16 14"
      stroke={active ? "#000" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LinkIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M10 13C10.4295 13.5741 10.9774 14.0492 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59696 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.47L11.75 5.18"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <path
      d="M14 11C13.5705 10.4259 13.0226 9.95083 12.3934 9.60707C11.7642 9.26331 11.0684 9.05889 10.3533 9.00768C9.63816 8.95646 8.92037 9.05965 8.24861 9.31023C7.57685 9.5608 6.96684 9.95303 6.45996 10.46L3.45996 13.46C2.54917 14.403 2.04519 15.666 2.05659 16.977C2.06798 18.288 2.59382 19.5421 3.52086 20.4691C4.44791 21.3961 5.70197 21.922 7.01295 21.9334C8.32393 21.9448 9.58694 21.4408 10.53 20.53L12.24 18.82"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EditIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <path
      d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MusicIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M9 18V5L21 3V16"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="6"
      cy="18"
      r="3"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <circle
      cx="18"
      cy="16"
      r="3"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
  </svg>
);

export const FileIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <path
      d="M14 2V8H20"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const VideoIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M23 7L16 12L23 17V7Z"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <rect
      x="1"
      y="5"
      width="15"
      height="14"
      rx="2"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
  </svg>
);

export const ImageIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <circle
      cx="8.5"
      cy="8.5"
      r="1.5"
      stroke={active ? "#000" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 15L16 10L5 21"
      stroke={active ? "#000" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ListIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M8 6H21"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 12H21"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 18H21"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 6H3.01"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 12H3.01"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 18H3.01"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const BarChartIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 20V10"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 20V4"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 20V16"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SettingsIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle
      cx="12"
      cy="12"
      r="3"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? "white" : "none"}
    />
    <path
      d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22"
      stroke={active ? "white" : "#666"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Иконки действий для таблиц (подтвердить / отменить / удалить) — компактные, currentColor */
export const IconCheck = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconX = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconTrash = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Агенты (рефералы) — люди/партнёры */
export const UsersIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
      stroke={active ? 'white' : '#666'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="7" r="4" stroke={active ? 'white' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path
      d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
      stroke={active ? 'white' : '#666'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Отзывы — звезда */
export const StarIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      stroke={active ? 'white' : '#666'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? 'white' : 'none'}
    />
  </svg>
);
