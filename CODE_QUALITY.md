# Принципы качества кода

## Основные принципы

### 1. DRY (Don't Repeat Yourself)
- **Никакого дублирования кода** - общая логика выносится в функции/сервисы/утилиты
- Если код повторяется 2+ раза → вынести в отдельную функцию
- Использовать общие middleware, валидаторы, утилиты

### 2. SOLID принципы

**Single Responsibility Principle (SRP)**
- Каждый класс/модуль/функция делает ОДНУ вещь
- Примеры:
  - `BookingService` - только логика бронирования
  - `VoteService` - только логика голосования
  - `ReferralService` - только логика рефералов
  - НЕ смешивать в одном модуле

**Open-Closed Principle**
- Код открыт для расширения, закрыт для модификации
- Использовать интерфейсы, абстракции
- Добавление новой фичи не должно ломать существующий код

**Liskov Substitution Principle**
- Подтипы должны заменять базовые типы без изменения логики

**Interface Segregation Principle**
- Интерфейсы должны быть специфичными, не "толстыми"
- Разделять большие интерфейсы на маленькие

**Dependency Inversion Principle**
- Зависимости через интерфейсы, не конкретные реализации
- Dependency Injection для тестируемости

### 3. KISS (Keep It Simple, Stupid)
- Простое решение лучше сложного
- Не переусложнять без необходимости
- Избегать premature optimization

### 4. Clean Code принципы

**Именование:**
- Понятные имена переменных, функций, классов
- `getUserById` вместо `getUser`
- `isBookingAvailable` вместо `check`
- Избегать сокращений: `usr` → `user`, `bkng` → `booking`

**Функции:**
- Маленькие функции (до 20-30 строк)
- Одна функция = одна задача
- Максимум 3-4 параметра, если больше - использовать объект

**Комментарии:**
- Код должен быть самодокументирующимся
- Комментарии только для "почему", не "что"
- JSDoc для публичных API

**Обработка ошибок:**
- Всегда обрабатывать ошибки явно
- Использовать типизированные ошибки (классы)
- Логировать с контекстом
- Не глотать ошибки молча

---

## Структура проекта (Clean Architecture)

```
backend/src/
├── domain/              # Бизнес-логика (чистая, без зависимостей)
│   ├── entities/       # Сущности (User, Booking, Song)
│   ├── services/       # Бизнес-логика
│   └── interfaces/     # Интерфейсы для репозиториев
│
├── infrastructure/      # Внешние зависимости
│   ├── database/       # Prisma, миграции
│   ├── cache/          # Redis
│   ├── storage/        # Файловое хранилище
│   └── external/       # Telegram Bot API, внешние сервисы
│
├── application/         # Слой приложения
│   ├── use-cases/      # Use cases (сценарии использования)
│   ├── dto/            # Data Transfer Objects
│   └── mappers/        # Преобразование данных
│
├── presentation/        # Слой представления
│   ├── controllers/    # HTTP контроллеры
│   ├── routes/         # Маршруты
│   ├── middleware/     # Middleware (auth, validation, error)
│   ├── socket/         # WebSocket handlers
│   └── validators/     # Валидация входных данных
│
└── shared/              # Общие утилиты
    ├── utils/          # Утилиты
    ├── errors/         # Классы ошибок
    ├── constants/      # Константы
    └── types/          # Общие типы
```

---

## Паттерны проектирования

### 1. Repository Pattern
- Абстракция доступа к данным
- Легко тестировать (mock репозитории)
- Легко менять БД

```typescript
interface IBookingRepository {
  create(data: CreateBookingDto): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  findByDate(date: Date): Promise<Booking[]>;
}

class PrismaBookingRepository implements IBookingRepository {
  // Реализация через Prisma
}
```

### 2. Service Layer Pattern
- Бизнес-логика в сервисах
- Контроллеры только маршрутизация и валидация

```typescript
class BookingService {
  constructor(
    private bookingRepo: IBookingRepository,
    private userRepo: IUserRepository,
    private notificationService: INotificationService
  ) {}

  async createBooking(data: CreateBookingDto): Promise<Booking> {
    // Вся бизнес-логика здесь
  }
}
```

### 3. Dependency Injection
- Зависимости через конструктор
- Легко тестировать (mock зависимости)

### 4. Factory Pattern
- Для создания сложных объектов
- Например: создание реферальных ссылок

### 5. Strategy Pattern
- Для разных алгоритмов (например, разные способы экспорта CSV)

---

## Валидация данных

### 1. Входные данные
- Всегда валидировать на уровне middleware
- Использовать библиотеку (zod, class-validator)
- Типизированные DTO

```typescript
import { z } from 'zod';

export const CreateBookingSchema = z.object({
  formatId: z.string().uuid(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fullName: z.string().min(2).max(255),
  contactValue: z.string().min(5),
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
```

### 2. Выходные данные
- Всегда типизировать ответы API
- Не возвращать лишние данные (пароли, токены)

---

## Обработка ошибок

### Типизированные ошибки

```typescript
// shared/errors/AppError.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public errors?: any[]) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}
```

### Error Handler Middleware

```typescript
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  // Неожиданные ошибки
  logger.error('Unexpected error', { error: err, stack: err.stack });
  
  return res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
};
```

---

## Логирование

### Структурированное логирование

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Использование

```typescript
logger.info('User created', { userId, email });
logger.error('Booking failed', { error, bookingId });
logger.warn('Rate limit exceeded', { ip, endpoint });
```

---

## Тестирование

### Unit тесты
- Тестировать бизнес-логику в изоляции
- Mock внешние зависимости
- Покрытие критичных функций: бронирование, голосование, рефералы

### Integration тесты
- Тестировать взаимодействие с БД
- Тестировать API endpoints
- Тестировать WebSocket события

### E2E тесты
- Полные сценарии: регистрация → бронирование → уведомление

---

## Инструменты качества

### 1. ESLint + Prettier
- Единый стиль кода
- Автоформатирование
- Обнаружение проблем

### 2. TypeScript strict mode
- Строгая типизация
- Нет `any` без необходимости
- Все типы явные

### 3. Husky + lint-staged
- Pre-commit hooks
- Проверка перед коммитом

### 4. CI/CD
- Автоматические тесты
- Линтинг
- Проверка типов

---

## Оптимизация

### 1. Database
- Индексы на часто используемых полях
- Запросы через Prisma (оптимизированы)
- Батчинг для массовых операций
- Connection pooling

### 2. Caching
- Redis для часто запрашиваемых данных
- TTL для кеша
- Инвалидация кеша при изменениях

### 3. Async operations
- Очереди для тяжелых задач (CSV экспорт)
- Background jobs
- Не блокировать основной поток

### 4. WebSocket
- Debounce обновлений
- Комнаты для группировки
- Обработка переподключений

---

## Чеклист перед коммитом

- [ ] Код следует принципам DRY (нет дублирования)
- [ ] Функции маленькие и делают одну вещь
- [ ] Имена переменных/функций понятные
- [ ] Все ошибки обработаны
- [ ] Данные валидированы
- [ ] Типы TypeScript корректны
- [ ] Логирование добавлено где нужно
- [ ] Нет "магических чисел" и строк
- [ ] Код отформатирован (Prettier)
- [ ] Линтер не выдает ошибок
- [ ] Тесты проходят (если есть)

---

## Антипаттерны (чего избегать)

❌ **God Object** - класс, который делает всё
❌ **Spaghetti Code** - запутанная логика
❌ **Magic Numbers** - числа без констант
❌ **Deep Nesting** - вложенность > 3 уровней
❌ **Long Methods** - функции > 50 строк
❌ **Copy-Paste** - дублирование кода
❌ **Silent Failures** - ошибки без логирования
❌ **Tight Coupling** - сильная связанность модулей
❌ **Premature Optimization** - оптимизация до необходимости
❌ **Over-engineering** - излишняя сложность

---

## Примеры хорошего кода

### ✅ Хорошо

```typescript
// Четкая ответственность
class BookingService {
  async createBooking(data: CreateBookingDto, userId: string): Promise<Booking> {
    await this.validateBooking(data);
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    
    const booking = await this.bookingRepository.create({
      ...data,
      userId,
    });
    
    await this.notificationService.notifyAdmin(booking);
    return booking;
  }
  
  private async validateBooking(data: CreateBookingDto): Promise<void> {
    if (await this.isDateBlocked(data.bookingDate)) {
      throw new ValidationError('Date is blocked');
    }
    // ...
  }
}
```

### ❌ Плохо

```typescript
// Все в одном месте, нет разделения ответственности
async function createBooking(req, res) {
  const data = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  
  // Валидация смешана с логикой
  if (data.date < new Date()) return res.status(400).json({ error: 'Invalid' });
  
  const booking = await prisma.booking.create({ data });
  
  // Уведомления прямо здесь
  await telegramBot.sendMessage(adminId, 'New booking');
  
  return res.json(booking);
}
```

---

## Итог

Следуя этим принципам, код будет:
- ✅ Без дублирования (DRY)
- ✅ Читаемым и понятным
- ✅ Легко тестируемым
- ✅ Масштабируемым
- ✅ Без "тупой" логики
- ✅ Оптимизированным
- ✅ Профессиональным
