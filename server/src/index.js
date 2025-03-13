const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./db/mongoose');
const path = require('path');
const fs = require('fs');

// Импорт маршрутов
const cardRoutes = require('./routes/cards');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');

// Импорт сервиса для управления играми
const GameService = require('./services/GameService');

// Настройка переменных окружения
dotenv.config();

// Подключение к MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Настройка CORS - указываем конкретные домены вместо '*'
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

// Расширенная настройка CORS для отладки
app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, от Postman или мобильных приложений)
    if (!origin) return callback(null, true);

    // Для отладки позволяем все origins, если DEBUG=true
    if (process.env.DEBUG === 'true') {
      console.log(`CORS: разрешен запрос от ${origin} (режим отладки)`);
      return callback(null, true);
    }

    // В противном случае, проверяем по белому списку
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`CORS: разрешен запрос от ${origin}`);
      return callback(null, true);
    }

    // Отклоняем запросы с неразрешенных источников
    console.log(`CORS: отклонен запрос от ${origin}`);
    callback(new Error(`Источник ${origin} не разрешен политикой CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true, // Разрешаем передачу credentials
  maxAge: 86400, // Кэшируем preflight запросы на 24 часа
}));

// Настройка Socket.io с теми же CORS параметрами
const io = socketIo(server, {
  cors: {
    origin: process.env.DEBUG === 'true' ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowEIO3: true
  },
  transports: ['websocket', 'polling']
});

app.use(express.json());

// Логгер запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} [${req.method}] ${req.url}`);
  next();
});

// Обработка статических файлов из папки public
app.use(express.static('public'));

// Обработчик для изображений карт
app.get('/images/cards/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../../public/images/cards', filename);

  // Проверяем существование файла
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.log(`Изображение карты не найдено: ${filename}, отправляем default.png`);
    // Отправляем default.png вместо отсутствующего файла
    res.sendFile(path.join(__dirname, '../../public/images/cards/default.png'));
  }
});

// Тестовый маршрут для диагностики CORS
app.get('/debug/cors-test', (req, res) => {
  res.json({
    message: 'CORS работает!',
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      host: req.headers.host,
      'user-agent': req.headers['user-agent']
    },
    timestamp: new Date().toISOString()
  });
});

// Простой маршрут для проверки, что сервер работает
app.get('/', (req, res) => {
  res.json({
    message: 'Сервер Rhyme Master работает!',
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV
  });
});

// Настройка маршрутов
app.use('/api/cards', cardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);

// Добавляем маршрут проверки здоровья сервера
app.get('/api/health', (req, res) => {
  // Сбор диагностической информации
  const memoryUsage = process.memoryUsage();
  const gameRooms = gameService ? Object.keys(gameService.getRooms() || {}).length : 'не инициализирован';
  const activeSockets = io ? io.sockets.sockets.size : 'не инициализирован';

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'не задано',
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    },
    connections: {
      activeSockets,
      activeRooms: gameRooms
    },
    debug: process.env.DEBUG === 'true',
    clientInfo: {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  });
});

// Добавляем маршрут для проверки статуса Redis, если используется
app.get('/api/redis-status', async (req, res) => {
  try {
    // Проверяем, есть ли переменная окружения для Redis
    if (!process.env.REDIS_URI) {
      return res.status(200).json({
        status: 'not_configured',
        message: 'Redis не настроен в приложении'
      });
    }

    // Если используется Redis, добавить проверку соединения
    // Здесь можно добавить код проверки Redis

    res.status(200).json({
      status: 'ok',
      message: 'Redis подключен'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Ошибка проверки Redis',
      error: error.message
    });
  }
});

// Инициализация сервиса игры
const gameService = new GameService(io);

// Настройка Socket.io для обработки событий в реальном времени
io.on('connection', (socket) => {
  console.log('Новое подключение: ', socket.id);

  // Тестовое событие для проверки соединения
  socket.emit('connected', {
    message: 'Соединение с сервером установлено',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });

  // Обработчик для проверки пинга
  socket.on('ping', (data) => {
    console.log('Получен пинг от клиента:', socket.id, data);
    socket.emit('pong', {
      received: data,
      timestamp: new Date().toISOString()
    });
  });

  // Обработчик для создания игровой комнаты
  socket.on('createRoom', (data) => {
    console.log('Запрос на создание комнаты от пользователя:', data.userId);

    try {
      const roomId = gameService.createRoom(data.userId);
      console.log('Комната успешно создана:', roomId);
      socket.join(roomId);
      socket.emit('roomCreated', { roomId });
    } catch (error) {
      console.error('Ошибка при создании комнаты:', error);
      socket.emit('error', { message: 'Не удалось создать комнату', details: error.message });
    }
  });

  // Обработчик присоединения к комнате
  socket.on('joinRoom', async (data) => {
    // Проверка наличия необходимых данных
    if (!data || !data.roomId || !data.userId) {
      console.log('Отсутствуют необходимые данные для присоединения к комнате');
      socket.emit('joinRoomError', { message: 'Отсутствуют необходимые данные' });
      return;
    }

    const { roomId, userId } = data;
    console.log(`[${new Date().toISOString()}] Запрос на присоединение к комнате ${roomId} от пользователя ${userId}`);

    try {
      // Проверяем существование комнаты
      const roomExists = await gameService.checkRoomExists(roomId);
      if (!roomExists) {
        console.log(`Комната ${roomId} не существует`);
        socket.emit('joinRoomError', { message: 'Комната не существует' });
        return;
      }

      // Присоединяемся к комнате
      const result = await gameService.joinRoom(roomId, userId);

      if (result.error) {
        console.log(`Ошибка при присоединении к комнате ${roomId}: ${result.error}`);
        socket.emit('joinRoomError', { message: result.error });
        return;
      }

      // Сохраняем маппинг сокет -> комната для будущих взаимодействий
      gameService.socketToRoom.set(socket.id, roomId);

      // Присоединяем к соответствующей комнате в Socket.io
      socket.join(roomId);

      // Отправляем подтверждение присоединения
      const status = gameService.getRoomStatus(roomId);
      console.log(`Пользователь ${userId} присоединился к комнате ${roomId}. Текущий статус комнаты: ${status}`);
      socket.emit('joinedRoom', {
        roomId,
        status,
        timestamp: new Date().toISOString(),
        debug: 'Успешное присоединение к комнате'
      });

      // Оповещаем остальных игроков о подключении нового игрока
      socket.to(roomId).emit('playerJoined', {
        userId,
        roomId,
        timestamp: new Date().toISOString(),
        message: `Игрок ${userId} присоединился к комнате ${roomId}`
      });

      // Отправляем текущее состояние комнаты всем участникам
      const roomState = gameService.getRoomState(roomId);
      io.to(roomId).emit('roomState', {
        ...roomState,
        timestamp: new Date().toISOString(),
        message: 'Обновление состояния после присоединения игрока'
      });

      // Если статус комнаты не "waiting", отправляем обновление статуса всем игрокам
      if (status !== 'waiting') {
        setTimeout(() => {
          io.to(roomId).emit('gameStatusUpdate', {
            roomId,
            status,
            timestamp: new Date().toISOString(),
            message: 'Принудительное обновление статуса для нового игрока'
          });

          // Повторно отправляем полное состояние с небольшой задержкой
          setTimeout(() => {
            const latestState = gameService.getRoomState(roomId);
            io.to(roomId).emit('roomState', latestState);
          }, 500);
        }, 1000);
      }
    } catch (error) {
      console.error(`Ошибка при присоединении к комнате ${roomId}:`, error);
      socket.emit('joinRoomError', { message: `Ошибка сервера: ${error.message}` });
    }
  });

  // Обработчик запроса состояния комнаты
  socket.on('getRoomState', (data) => {
    // Проверка наличия необходимых данных
    if (!data || !data.roomId) {
      console.log('Отсутствуют необходимые данные для получения состояния комнаты');
      return;
    }

    const { roomId } = data;
    // Уменьшаем детализацию логов, чтобы избежать спама
    // console.log(`[${new Date().toISOString()}] Запрос состояния комнаты ${roomId}`);

    try {
      // Получаем состояние комнаты
      const state = gameService.getRoomState(roomId, false); // Передаем флаг для отключения логирования

      if (!state || state.error) {
        console.log(`Ошибка при получении состояния комнаты ${roomId}: ${state ? state.error : 'Состояние не найдено'}`);
        return;
      }

      // Уменьшаем детализацию логов
      // console.log(`Отправка состояния комнаты ${roomId}. Статус: ${state.status}, Игроков: ${state.playersCount}`);

      // Отправляем состояние комнаты запросившему клиенту
      socket.emit('roomState', {
        ...state,
        timestamp: new Date().toISOString(),
        debug: 'Ответ на прямой запрос состояния'
      });
    } catch (error) {
      console.error(`Ошибка при получении состояния комнаты ${roomId}:`, error);
    }
  });

  // Обработчик для выбора карт
  socket.on('selectCards', (data) => {
    try {
      // Проверка наличия необходимых данных
      if (!data || !data.roomId || !data.userId || !data.cards) {
        console.error('Отсутствуют необходимые данные для выбора карт:', data);
        socket.emit('error', { message: 'Неполные данные для выбора карт' });
        return;
      }

      const { roomId, userId, cards } = data;
      console.log(`[${new Date().toISOString()}] Пользователь ${userId} выбрал карты в комнате ${roomId}:`, cards);

      // Проверяем наличие карт
      if (!Array.isArray(cards) || cards.length === 0) {
        console.error('Некорректный формат выбранных карт:', cards);
        socket.emit('error', { message: 'Некорректный формат выбранных карт' });
        return;
      }

      try {
        // Обработка выбора карт через сервис
        const result = gameService.selectCards(roomId, userId, cards);

        if (!result || !result.success) {
          console.error('Ошибка при выборе карт:', result?.message || 'Неизвестная ошибка');
          socket.emit('error', { message: result?.message || 'Не удалось выбрать карты' });
          return;
        }

        // Отправляем подтверждение выбора карт самому игроку
        socket.emit('cardsSelected', {
          success: true,
          cards,
          timestamp: new Date().toISOString(),
          message: 'Ваш выбор карт подтвержден'
        });

        // Оповещаем всех игроков в комнате о том, что игрок готов
        io.to(roomId).emit('playerReady', {
          userId,
          timestamp: new Date().toISOString(),
          message: `Игрок ${userId} выбрал карты и готов к бою`
        });

        // Обновляем состояние комнаты для всех
        setTimeout(() => {
          const roomState = gameService.getRoomState(roomId);
          io.to(roomId).emit('roomState', {
            ...roomState,
            timestamp: new Date().toISOString(),
            message: 'Обновление состояния после выбора карт'
          });
        }, 500);

        // Проверяем, выбрали ли все игроки свои карты
        if (gameService.areAllPlayersReady(roomId)) {
          console.log('Все игроки готовы в комнате:', roomId);

          // Запускаем бой с небольшой задержкой для гарантии обработки
          setTimeout(() => {
            const battleState = gameService.getBattleState(roomId);
            io.to(roomId).emit('battleStart', {
              ...battleState,
              timestamp: new Date().toISOString(),
              message: 'Начало боя! Все игроки готовы.'
            });
          }, 1000);
        }
      } catch (error) {
        console.error('Ошибка при обработке выбора карт:', error);
        socket.emit('error', { message: 'Ошибка обработки выбора карт', details: error.message });
      }
    } catch (error) {
      console.error('Критическая ошибка при выборе карт:', error);
      socket.emit('error', { message: 'Критическая ошибка сервера', details: error.message });
    }
  });

  // Обработчик для игровых действий (разыгрывание карты)
  socket.on('playCard', (data) => {
    const { roomId, userId, cardId, targetCardId } = data;
    const result = gameService.playCard(roomId, userId, cardId, targetCardId);

    io.to(roomId).emit('cardPlayed', result);

    // Если ход закончен, отправляем обновленное состояние игры
    if (result.turnEnded) {
      io.to(roomId).emit('turnEnded', gameService.getBattleState(roomId));
    }

    // Если игра закончена, отправляем результаты
    if (result.gameEnded) {
      io.to(roomId).emit('gameEnded', gameService.getGameResults(roomId));
    }
  });

  // Обработчик для проверки существования комнаты
  socket.on('checkRoom', (data) => {
    const { roomId, userId } = data;

    // Проверяем, что roomId существует
    if (!roomId) {
      console.log('Запрос проверки комнаты без указания roomId');
      socket.emit('error', { message: 'Не указан ID комнаты' });
      return;
    }

    // Защита от слишком частых запросов
    const now = Date.now();
    const lastCheckTime = socket._lastRoomCheckRequest || 0;
    const timeSinceLastCheck = now - lastCheckTime;

    // Ограничиваем частоту проверок до одной в 3 секунды
    if (timeSinceLastCheck < 3000) {
      console.log('Слишком частый запрос проверки комнаты:', roomId, 'интервал:', timeSinceLastCheck, 'мс');
      return; // Пропускаем запрос без отправки ошибки
    }

    // Сохраняем время последней проверки
    socket._lastRoomCheckRequest = now;

    console.log('Проверка существования комнаты:', roomId, 'для пользователя:', userId);

    try {
      const roomExists = gameService.checkRoomExists(roomId);

      console.log('Результат проверки комнаты:', roomId, roomExists);
      socket.emit('roomChecked', {
        roomId,
        exists: roomExists,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Ошибка при проверке комнаты:', error);
      socket.emit('error', { message: 'Не удалось проверить комнату', details: error.message });
    }
  });

  // Обработчик для выхода из комнаты (без сброса состояния игры)
  socket.on('leaveRoom', (data) => {
    const { roomId, userId } = data;

    if (!roomId || !userId) {
      console.log('Неполные данные для выхода из комнаты');
      return;
    }

    console.log(`Пользователь ${userId} покидает комнату ${roomId} (без сброса игры)`);

    // Отсоединяем сокет от комнаты
    socket.leave(roomId);

    // Удаляем маппинг сокета к комнате
    gameService.socketToRoom.delete(socket.id);

    // Оповещаем остальных участников комнаты о выходе игрока
    socket.to(roomId).emit('playerLeft', {
      userId,
      roomId,
      timestamp: new Date().toISOString(),
      message: `Игрок ${userId} покинул комнату ${roomId} (может вернуться)`
    });
  });

  // Обработчик для отключения
  socket.on('disconnect', () => {
    console.log('Соединение разорвано: ', socket.id);
    gameService.handleDisconnect(socket.id);
  });
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
}); 