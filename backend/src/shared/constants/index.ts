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
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_WIDTH: 4000,
  MAX_HEIGHT: 4000,
  OPTIMIZED_WIDTH: 1200,
  OPTIMIZED_HEIGHT: 1200,
  THUMBNAIL_WIDTH: 300,
  THUMBNAIL_HEIGHT: 300,
} as const;

// TTL для кеша (в секундах)
export const CACHE_TTL = {
  ACTIVE_SONGS: 5 * 60, // 5 минут
  VOTE_RESULTS: 2, // 2 секунды
  BLOCKED_DATES: 60 * 60, // 1 час
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
