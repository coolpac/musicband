# Repository Pattern - Объяснение

## Что это такое?

**Repository Pattern** - это способ организации кода, который **скрывает детали работы с базой данных** от бизнес-логики.

## Простыми словами

Представь, что у тебя есть бизнес-логика (Service), которая должна работать с данными. Вместо того, чтобы напрямую обращаться к базе данных (Prisma), мы создаем **прослойку** - Repository.

```
Бизнес-логика (Service) 
    ↓
Repository (прослойка)
    ↓
База данных (Prisma/PostgreSQL)
```

## Зачем это нужно?

### 1. **Разделение ответственности**
- Service не знает, КАК данные хранятся (PostgreSQL, MongoDB, файлы)
- Service знает только ЧТО нужно получить (например, "найди пользователя по ID")

### 2. **Легко тестировать**
Можно создать "фейковый" Repository для тестов, не подключая реальную БД:

```typescript
// В тестах
class MockUserRepository implements IUserRepository {
  async findById(id: string) {
    return { id, name: 'Test User' }; // Возвращаем тестовые данные
  }
}

// В реальном коде
class PrismaUserRepository implements IUserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } }); // Реальная БД
  }
}
```

### 3. **Легко менять БД**
Если завтра захочешь перейти с PostgreSQL на MongoDB - меняешь только Repository, Service остается без изменений!

### 4. **Нет дублирования кода**
Вся логика работы с БД в одном месте. Если нужно изменить запрос - меняешь только Repository.

## Пример из нашего проекта

### Без Repository Pattern (плохо):

```typescript
// Service напрямую обращается к Prisma
class BookingService {
  async createBooking(data) {
    // Прямой доступ к БД - плохо!
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    const booking = await prisma.booking.create({ data });
    return booking;
  }
}
```

**Проблемы:**
- Service знает про Prisma (зависимость от конкретной БД)
- Сложно тестировать (нужна реальная БД)
- Если изменится структура БД - нужно менять Service

### С Repository Pattern (хорошо):

```typescript
// 1. Интерфейс (контракт)
interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  create(data: CreateBookingData): Promise<Booking>;
}

// 2. Реализация через Prisma
class PrismaBookingRepository implements IBookingRepository {
  async findById(id: string) {
    return prisma.booking.findUnique({ where: { id } });
  }
  
  async create(data: CreateBookingData) {
    return prisma.booking.create({ data });
  }
}

// 3. Service использует интерфейс
class BookingService {
  constructor(
    private bookingRepo: IBookingRepository  // Зависимость от интерфейса!
  ) {}
  
  async createBooking(data) {
    const booking = await this.bookingRepo.create(data); // Не знает про Prisma!
    return booking;
  }
}
```

**Преимущества:**
- ✅ Service не знает про Prisma
- ✅ Легко тестировать (можно подставить Mock)
- ✅ Легко менять БД (меняешь только Repository)

## Структура в нашем проекте

```
infrastructure/database/repositories/
├── UserRepository.ts          # Работа с пользователями
├── SongRepository.ts          # Работа с песнями
├── BookingRepository.ts       # Работа с бронированиями
├── VoteRepository.ts          # Работа с голосами
└── BlockedDateRepository.ts   # Работа с заблокированными датами
```

Каждый Repository:
1. **Интерфейс** (`IUserRepository`) - что можно делать
2. **Реализация** (`PrismaUserRepository`) - как это делается через Prisma

## Пример использования

```typescript
// Создаем Repository
const userRepository = new PrismaUserRepository();

// Передаем в Service
const authService = new AuthService(userRepository, ...);

// Service использует методы Repository
const user = await userRepository.findByTelegramId(telegramId);
```

## Итог

Repository Pattern - это **прослойка между бизнес-логикой и базой данных**, которая:
- ✅ Скрывает детали работы с БД
- ✅ Упрощает тестирование
- ✅ Позволяет легко менять БД
- ✅ Убирает дублирование кода

Это стандартная практика в профессиональной разработке! 🎯
