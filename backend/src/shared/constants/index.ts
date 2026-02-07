// Rate limiting (запросов в указанный период)
export const RATE_LIMIT = {
  API: 100, // запросов в минуту (public API)
  AUTH: 5, // попыток входа за 15 минут
  VOTE: 1, // голосов в минуту
  BOOKING: 10, // бронирований в час
  UPLOAD: 20, // загрузок в час
  REVIEW: 5, // отзывов в день
  REFERRAL_EVENT: 10, // событий в минуту
  ADMIN: 100, // запросов в минуту (для админов)
} as const;

// Лимиты данных
export const LIMITS = {
  MAX_ACTIVE_SONGS: 20,
  MAX_REVIEW_TEXT_LENGTH: 1000,
  MAX_REFERRAL_LINKS_PER_AGENT: 10,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
} as const;

// Размеры изображений
export const IMAGE_SIZES = {
  SONG_COVER: { width: 800, height: 800 },
  POSTER: { width: 1200, height: 600 },
} as const;

// Лимиты для обработки изображений
export const IMAGE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_WIDTH: 4000,
  MAX_HEIGHT: 4000,
  /** Responsive widths: small, medium, large */
  RESPONSIVE_WIDTHS: [480, 960, 1920] as const,
  THUMBNAIL_WIDTH: 200,
  THUMBNAIL_HEIGHT: 200,
  /** Default WebP quality for responsive variants */
  WEBP_QUALITY: 80,
  /** Default AVIF quality (30–50% smaller than WebP at same perceived quality) */
  AVIF_QUALITY: 65,
  // Legacy (for backward compat)
  OPTIMIZED_WIDTH: 960,
  OPTIMIZED_HEIGHT: 960,
} as const;

// TTL для кеша (в секундах)
export const CACHE_TTL = {
  ACTIVE_SONGS: 5 * 60, // 5 минут
  VOTE_RESULTS: 2, // 2 секунды
  BLOCKED_DATES: 60 * 60, // 1 час
  AVAILABLE_DATES: 5 * 60, // 5 минут — результат getAvailableDates
  ADMIN_CALENDAR: 2 * 60, // 2 минуты — календарь заявок для админки
  AGENT_STATS: 5 * 60, // 5 минут
} as const;

// Роли пользователей
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  AGENT: 'agent',
} as const;

// Статусы бронирования
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;

// Статусы агентов
export const AGENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

// Типы событий рефералов
export const REFERRAL_EVENT_TYPES = {
  CLICK: 'click',
  REGISTRATION: 'registration',
  BOOKING: 'booking',
  VOTE: 'vote',
} as const;

// Статусы событий рефералов
export const REFERRAL_EVENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
} as const;
