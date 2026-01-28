# WebSocket - Real-time голосование

## Обзор

Реализован real-time механизм голосования через Socket.io с поддержкой:
- ✅ Авторизация через JWT
- ✅ Debounce обновлений (1.5 секунды)
- ✅ Восстановление состояния при переподключении
- ✅ Комнаты для группировки клиентов
- ✅ Redis Adapter для масштабирования
- ✅ Обработка ошибок и логирование

## Подключение

### Frontend (React)

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('token'), // JWT токен
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// Обработка подключения
socket.on('connect', () => {
  console.log('Connected to server');
});

// Обработка ошибок
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

## События от клиента → сервер

### `vote:join`
Присоединиться к голосованию (получить текущее состояние)

```typescript
socket.emit('vote:join', { sessionId?: string });

// Если sessionId не указан, присоединяется к активной сессии
```

### `vote:cast`
Проголосовать за песню

```typescript
socket.emit('vote:cast', { songId: string });
```

**Ошибки:**
- `UNAUTHORIZED` - пользователь не авторизован
- `NOT_FOUND` - песня или сессия не найдена
- `CONFLICT` - пользователь уже голосовал
- `VALIDATION_ERROR` - песня не активна

### `vote:leave`
Отключиться от голосования

```typescript
socket.emit('vote:leave');
```

## События от сервера → клиент

### `vote:state`
Полное состояние при подключении/переподключении

```typescript
socket.on('vote:state', (state: {
  sessionId: string | null,
  songs: Array<{
    id: string,
    title: string,
    artist: string,
    coverUrl: string | null,
    isActive: boolean
  }>,
  results: {
    songs: Array<{
      song: {
        id: string,
        title: string,
        artist: string,
        coverUrl: string | null
      },
      votes: number,
      percentage: number
    }>,
    totalVotes: number
  },
  myVote: { songId: string } | null
}));
```

### `vote:results:updated`
Обновление результатов (debounced, каждые 1.5 секунды)

```typescript
socket.on('vote:results:updated', (results: {
  sessionId: string,
  songs: Array<{
    songId: string,
    votes: number,
    percentage: number
  }>,
  totalVotes: number
}));
```

### `vote:songs:updated`
Обновление списка песен (когда админ добавил/удалил/изменил)

```typescript
socket.on('vote:songs:updated', (songs: Array<{
  id: string,
  title: string,
  artist: string,
  coverUrl: string | null,
  isActive: boolean
}>));
```

### `vote:song:toggled`
Песня включена/выключена из голосования

```typescript
socket.on('vote:song:toggled', (song: {
  id: string,
  title: string,
  artist: string,
  isActive: boolean
}));
```

### `vote:session:started`
Новая сессия голосования началась

```typescript
socket.on('vote:session:started', (session: {
  id: string,
  startedAt: Date
}));
```

### `vote:session:ended`
Голосование завершено админом

```typescript
socket.on('vote:session:ended', (data: {
  sessionId: string,
  results: Array<{
    song: { id: string },
    votes: number,
    percentage: number
  }>,
  totalVoters: number
}));
```

### `vote:cast:success`
Подтверждение успешного голоса

```typescript
socket.on('vote:cast:success', (data: { songId: string }));
```

### `vote:error`
Ошибка

```typescript
socket.on('vote:error', (error: {
  message: string,
  code?: string
}));
```

## Пример использования (React)

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

function VotingComponent() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [songs, setSongs] = useState([]);
  const [results, setResults] = useState(null);
  const [myVote, setMyVote] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:3000', {
      auth: { token },
    });

    // Присоединяемся к голосованию
    newSocket.on('connect', () => {
      newSocket.emit('vote:join');
    });

    // Получаем состояние
    newSocket.on('vote:state', (state) => {
      setSongs(state.songs);
      setResults(state.results);
      setMyVote(state.myVote?.songId || null);
    });

    // Обновления результатов
    newSocket.on('vote:results:updated', (updatedResults) => {
      setResults(updatedResults);
    });

    // Обновления списка песен
    newSocket.on('vote:songs:updated', (updatedSongs) => {
      setSongs(updatedSongs);
    });

    // Подтверждение голоса
    newSocket.on('vote:cast:success', ({ songId }) => {
      setMyVote(songId);
    });

    // Ошибки
    newSocket.on('vote:error', (error) => {
      console.error('Vote error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('vote:leave');
      newSocket.disconnect();
    };
  }, []);

  const handleVote = (songId: string) => {
    if (socket && !myVote) {
      socket.emit('vote:cast', { songId });
    }
  };

  return (
    <div>
      {songs.map((song) => (
        <button
          key={song.id}
          onClick={() => handleVote(song.id)}
          disabled={!!myVote}
        >
          {song.title} - {song.artist}
          {myVote === song.id && ' ✓'}
        </button>
      ))}
    </div>
  );
}
```

## Debounce механизм

Результаты обновляются не при каждом голосе, а с задержкой **1.5 секунды**:
- Снижает нагрузку на сервер и клиентов
- Достаточно для "real-time" ощущения
- Оптимизировано для 100-300 одновременных пользователей

## Восстановление состояния

При переподключении:
1. Клиент отправляет `vote:join`
2. Сервер отправляет `vote:state` с полным состоянием
3. Клиент восстанавливает UI

## Безопасность

- ✅ Авторизация через JWT токен
- ✅ Проверка токена при подключении
- ✅ Валидация всех входящих данных
- ✅ Защита от дублирования голосов (UNIQUE constraint)
- ✅ Rate limiting (через middleware)

## Масштабирование

- ✅ Redis Adapter для синхронизации между серверами
- ✅ Комнаты для группировки клиентов
- ✅ Pub/Sub для рассылки событий

## Мониторинг

Логируются:
- Подключения/отключения
- Голоса
- Ошибки
- Количество подключенных клиентов
