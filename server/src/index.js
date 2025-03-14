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

  // Обработчик события выбора карт игроком
  socket.on('selectCards', async (data) => {
    console.log(`[SERVER] Событие selectCards от ${socket.id}: `, JSON.stringify(data));

    // Валидация данных
    if (!data) {
      console.error(`[SERVER] Ошибка в selectCards: Отсутствуют данные`);
      socket.emit('cardsSelected', { success: false, message: 'Отсутствуют данные для выбора карт' });
      return;
    }

    const { roomId, userId, cards } = data;

    // Проверяем обязательные параметры
    if (!roomId) {
      console.error(`[SERVER] Ошибка в selectCards: Отсутствует roomId`);
      socket.emit('cardsSelected', { success: false, message: 'Отсутствует ID комнаты' });
      return;
    }

    if (!userId) {
      console.error(`[SERVER] Ошибка в selectCards: Отсутствует userId`);
      socket.emit('cardsSelected', { success: false, message: 'Отсутствует ID пользователя' });
      return;
    }

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      console.error(`[SERVER] Ошибка в selectCards: Некорректный формат карт`, cards);
      socket.emit('cardsSelected', { success: false, message: 'Некорректный формат выбранных карт' });
      return;
    }

    console.log(`[SERVER] Обработка выбора карт для игрока ${userId} в комнате ${roomId}, карты: ${cards.length}`);

    try {
      // Сохраняем выбранные карты
      const result = await gameService.selectCards(roomId, userId, cards);

      console.log(`[SERVER] Результат выбора карт:`, result);

      if (result.success) {
        // Отправляем подтверждение клиенту
        socket.emit('cardsSelected', {
          success: true,
          message: 'Карты успешно выбраны',
          userId: userId,
          timestamp: new Date().toISOString(),
          isReady: true
        });

        // Проверяем текущее состояние комнаты
        const roomState = gameService.getRoomState(roomId);

        if (roomState && !roomState.error) {
          // Находим игрока в состоянии комнаты
          const player = roomState.players.find(p => p.userId === userId);

          if (player && player.isReady) {
            console.log(`[SERVER] Игрок ${userId} отмечен как готовый в состоянии комнаты`);

            // Отправляем событие готовности игрока этому клиенту
            socket.emit('playerReady', {
              userId: userId,
              roomId: roomId,
              timestamp: new Date().toISOString()
            });

            // Отправляем событие готовности игрока всем в комнате
            io.to(roomId).emit('playerReady', {
              userId: userId,
              roomId: roomId,
              timestamp: new Date().toISOString()
            });

            // Отправляем обновленное состояние комнаты всем клиентам
            io.to(roomId).emit('roomState', {
              ...roomState,
              timestamp: new Date().toISOString(),
              message: `Игрок ${userId} выбрал карты и готов к игре`
            });

            // Отправляем дополнительное событие updatePlayerStatus для надежности
            io.to(roomId).emit('updatePlayerStatus', {
              userId: userId,
              console.log('Получен запрос на выбор карт:', data);

              try {
                // Проверяем, что все необходимые данные переданы
                if(!data || !data.roomId || !data.userId || !data.cards) {
              console.error('Некорректный запрос на выбор карт:', data);
              socket.emit('error', { message: 'Некорректный запрос на выбор карт' });
              return;
            }

            // Проверяем формат выбранных карт
            if (!Array.isArray(data.cards) || data.cards.length === 0) {
              console.error('Некорректный формат выбранных карт:', data.cards);
              socket.emit('error', { message: 'Некорректный формат выбранных карт' });
              return;
            }

            console.log(`Выбор карт для игрока ${data.userId} в комнате ${data.roomId}...`);

            try {
              // Сохраняем выбранные карты в БД
              await gameService.selectCards(data.roomId, data.userId, data.cards);

              console.log(`Выбор карт успешен для игрока ${data.userId} в комнате ${data.roomId}, отправляем подтверждение`);

              // Отправляем подтверждение о выбранных картах клиенту
              socket.emit('cardsSelected', {
                success: true,
                message: 'Карты успешно выбраны',
                userId: data.userId,
                timestamp: new Date().toISOString()
              });

              // Получаем обновленное состояние комнаты
              const room = await gameService.getGame(data.roomId);

              // Проверяем, отмечен ли игрок как готовый в состоянии комнаты
              if (room && room.players) {
                const player = room.players.find(p => p.userId === data.userId);
                if (player && player.isReady) {
                  console.log(`Проверка успешна: Игрок ${data.userId} отмечен как готовый в состоянии комнаты ${data.roomId}`);

                  // Отправляем дополнительное подтверждение о готовности игрока
                  socket.emit('playerReady', {
                    userId: data.userId,
                    isReady: true,
                    timestamp: new Date().toISOString()
                  });
                  console.log(`Подтверждение cardsSelected отправлено игроку ${data.userId}`);

                  // Уведомляем всех игроков в комнате
                  io.to(data.roomId).emit('playerReady', {
                    userId: data.userId,
                    roomId: data.roomId,
                    timestamp: new Date().toISOString()
                  });
                  console.log(`Оповещение playerReady отправлено в комнату ${data.roomId}`);

                  // Явно отправляем обновление статуса игрока
                  socket.emit('updatePlayerStatus', {
                    userId: data.userId,
                    isReady: true,
                    timestamp: new Date().toISOString()
                  });

                  // Отправляем обновленное состояние комнаты всем игрокам
                  const roomState = await gameService.getRoomState(data.roomId);
                  io.to(data.roomId).emit('roomState', roomState);
                  console.log(`Обновляем состояние комнаты ${data.roomId} для всех игроков после выбора карт`);
                } else {
                  console.error(`ОШИБКА: Игрок ${data.userId} НЕ отмечен как готовый в состоянии комнаты после selectCards!`);
                  // Отправляем предупреждение клиенту
                  socket.emit('error', {
                    message: 'Сервер принял карты, но не смог отметить игрока как готового',
                    code: 'PLAYER_NOT_READY_ERROR'
                  });
                }
              }
            } catch (error) {
              console.error('Ошибка при выборе карт:', error);
              socket.emit('error', { message: `Ошибка при выборе карт: ${error.message}` });
            }
          } catch (error) {
            console.error('Ошибка обработки запроса selectCards:', error);
            socket.emit('error', { message: 'Внутренняя ошибка сервера при выборе карт' });
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