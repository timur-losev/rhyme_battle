import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import axios from 'axios';

const GameContext = createContext();

export function useGame() {
  return useContext(GameContext);
}

export function GameProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(() => {
    // Проверяем, есть ли сохраненная комната в localStorage
    const savedRoom = localStorage.getItem('currentRoom');
    return savedRoom || null;
  });
  const [gameStatus, setGameStatus] = useState(() => {
    // Проверяем, есть ли сохраненный статус в localStorage
    const savedStatus = localStorage.getItem('gameStatus');
    return savedStatus || 'idle';
  });
  const [playerReady, setPlayerReady] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [battleLog, setBattleLog] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [cardsCollection, setCardsCollection] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Новый флаг для отслеживания проверки комнаты
  const [roomChecked, setRoomChecked] = useState(false);
  // Флаг для отслеживания запроса на загрузку карт
  const [cardsRequested, setCardsRequested] = useState(false);

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Добавляем throttle для запросов состояния комнаты
  // Эта переменная будет использоваться для отслеживания времени последнего запроса
  // ВАЖНО: использую переменную во внешней области видимости, доступную всем компонентам
  const GLOBAL_THROTTLE_STATE = {
    lastRoomStateRequestTime: 0,
    pendingRequests: {},
    minInterval: 5000 // Увеличиваем минимальный интервал до 5 секунд для большей эффективности
  };

  // Переменная для хранения глобального состояния соединения
  const GLOBAL_SOCKET_STATE = {
    activeConnections: 0,
    maxConnections: 1, // Разрешаем только одно активное соединение
    lastSocketId: null
  };

  // Создаю дебаунсер для запросов состояния комнаты
  let roomStateRequestQueue = {};
  let roomStateRequestTimer = null;

  // Функция для проверки и запроса состояния комнаты с ограничением частоты
  const throttledGetRoomState = useCallback((roomId) => {
    if (!roomId || !socket || !socket.connected) {
      console.log('Невозможно запросить состояние: нет ID комнаты или соединения');
      return false;
    }

    const now = Date.now();
    const lastRequestForRoom = GLOBAL_THROTTLE_STATE.pendingRequests[roomId] || 0;
    const globalLastRequest = GLOBAL_THROTTLE_STATE.lastRoomStateRequestTime;
    const timeSinceRoomRequest = now - lastRequestForRoom;
    const timeSinceGlobalRequest = now - globalLastRequest;

    // Уменьшаем интервалы между запросами для более оперативного обновления
    if (timeSinceRoomRequest > 800 && // Уменьшаем до 800мс (было GLOBAL_THROTTLE_STATE.minInterval)
      timeSinceGlobalRequest > 500) { // Уменьшаем до 500мс для более быстрого отклика

      console.log(`Отправка запроса getRoomState для ${roomId}`);

      // Обновляем оба счетчика перед отправкой запроса
      GLOBAL_THROTTLE_STATE.lastRoomStateRequestTime = now;
      GLOBAL_THROTTLE_STATE.pendingRequests[roomId] = now;

      // Отправляем запрос
      socket.emit('getRoomState', { roomId });
      return true;
    } else {
      // Планируем повторную попытку через короткое время, если запрос был пропущен из-за троттлинга
      if (timeSinceRoomRequest > 3000) { // Если прошло больше 3 секунд с последнего успешного запроса
        console.log(`Запрос getRoomState пропущен для ${roomId} - планируем автоматическую повторную попытку`);
        setTimeout(() => {
          throttledGetRoomState(roomId);
        }, 600);
      }
      return false;
    }
  }, [socket]);

  // Функция-дебаунсер, которая будет собирать запросы и отправлять только один
  const debouncedGetRoomState = useCallback((roomId) => {
    if (!roomId) return false;

    // Добавляем запрос в очередь
    roomStateRequestQueue[roomId] = Date.now();

    // Если таймер уже установлен, не создаем новый
    if (roomStateRequestTimer) return false;

    // Устанавливаем таймер для обработки накопленных запросов
    roomStateRequestTimer = setTimeout(() => {
      // Находим самый свежий запрос в очереди
      const requests = Object.keys(roomStateRequestQueue);
      if (requests.length > 0) {
        // Если в очереди несколько запросов, логируем это
        if (requests.length > 1) {
          console.log(`Объединяем ${requests.length} запросов состояния комнаты в один`);
        }

        // Отправляем только самый свежий запрос
        const latestRoomId = requests[requests.length - 1];
        throttledGetRoomState(latestRoomId);
      }

      // Очищаем очередь и таймер
      roomStateRequestQueue = {};
      roomStateRequestTimer = null;
    }, 100); // Короткая задержка для группировки близких по времени запросов

    return true;
  }, [throttledGetRoomState]);

  // Функция для генерации тестовых карт 
  const generateTestCards = useCallback(() => {
    console.log('⚠️ ГЕНЕРАЦИЯ ТЕСТОВЫХ КАРТ ЗАПУЩЕНА ⚠️');

    // Гарантия, что карточки будут видны - добавляем ярлык "ТЕСТОВАЯ"
    const testCards = [
      {
        _id: 'test-card-1',
        name: 'ТЕСТОВАЯ - Огненный панч',
        type: 'attack',
        power: 5,
        couplet: 'Бам-бам, огонь в твоей груди, ты от рифм моих горишь внутри!',
        description: 'Базовая атака с нанесением урона',
        effects: [{ type: 'damage', value: 5, description: 'Наносит 5 урона противнику' }],
        image: '/images/cards/default.png',
        rarity: 'common'
      },
      {
        _id: 'test-card-2',
        name: 'ТЕСТОВАЯ - Слова защиты',
        type: 'defense',
        power: 4,
        couplet: 'Щит из слов, стена из рифм, твои удары превращаю в дым!',
        description: 'Базовая защита от атак противника',
        effects: [{ type: 'block', value: 4, description: 'Блокирует 4 урона' }],
        image: '/images/cards/default.png',
        rarity: 'common'
      },
      {
        _id: 'test-card-3',
        name: 'ТЕСТОВАЯ - Комбо-удар',
        type: 'combo',
        power: 7,
        couplet: 'Раз-два, три-четыре, мои рифмы бьют сильнее, чем в эфире!',
        description: 'Комбинированная атака с дополнительным эффектом',
        effects: [
          { type: 'damage', value: 3, description: 'Наносит 3 урона противнику' },
          { type: 'buff', value: 2, description: 'Усиливает следующую атаку на 2' }
        ],
        image: '/images/cards/default.png',
        rarity: 'uncommon'
      },
      {
        _id: 'test-card-4',
        name: 'ТЕСТОВАЯ - Легендарный флоу',
        type: 'special',
        power: 10,
        couplet: 'Мой флоу легендарный, как древний артефакт, твой стиль бледнеет, это факт!',
        description: 'Мощная специальная атака с несколькими эффектами',
        effects: [
          { type: 'damage', value: 6, description: 'Наносит 6 урона противнику' },
          { type: 'debuff', value: 2, description: 'Снижает силу атак противника на 2' },
          { type: 'heal', value: 2, description: 'Восстанавливает 2 здоровья' }
        ],
        image: '/images/cards/default.png',
        rarity: 'legendary'
      }
    ];

    // Добавляем еще несколько карт, чтобы их было достаточно
    for (let i = 9; i <= 15; i++) {
      testCards.push({
        _id: `test-card-${i}`,
        name: `ТЕСТОВАЯ #${i} - ${['Атака', 'Защита', 'Комбо', 'Спец'][i % 4]} ${i}`,
        type: ['attack', 'defense', 'combo', 'special'][i % 4],
        power: i % 10 || 1,
        couplet: `Тестовый куплет для карты #${i}. Очень мощная текстовка!`,
        description: `Тестовое описание карты #${i}`,
        effects: [{ type: 'damage', value: i % 10 || 1, description: `Тестовый эффект карты #${i}` }],
        image: '/images/cards/default.png',
        rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'][i % 5]
      });
    }

    // Проверяем, что все карты имеют необходимые поля
    const validCards = testCards.filter(card => {
      const isValid = card && card._id && card.name && card.type && card.couplet;
      if (!isValid) {
        console.error('Обнаружена некорректная тестовая карта:', card);
      }
      return isValid;
    });

    console.log(`✅ Успешно сгенерировано ${validCards.length} тестовых карт:`);
    validCards.forEach((card, index) => {
      console.log(`${index + 1}. ${card.name} (${card.type}, сила: ${card.power})`);
    });

    // Если карт меньше, чем ожидалось, выводим предупреждение
    if (validCards.length < testCards.length) {
      console.warn(`⚠️ Внимание: ${testCards.length - validCards.length} карт были отфильтрованы из-за некорректных данных`);
    }

    // Выводим предупреждение, если массив пустой (не должно случиться)
    if (validCards.length === 0) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА! Массив тестовых карт пуст!');
    }

    return validCards;
  }, []);

  // Функция загрузки карт
  const loadCards = useCallback(async () => {
    console.log('💥 Запрос loadCards в GameContext был вызван');

    // Сохраним данные о контексте вызова для отладки
    const callerInfo = {
      timestamp: new Date().toISOString(),
      room: currentRoom || 'нет',
      gameStatus: gameStatus || 'нет',
      cardsLoaded: cardsCollection.length > 0 ? 'да' : 'нет',
      cardsCount: cardsCollection.length,
      socketConnected: socket?.connected ? 'да' : 'нет',
      socketId: socket?.id || 'нет',
      userId: currentUser?.id || 'нет'
    };

    console.log('Контекст вызова loadCards:', callerInfo);

    // Если карты уже загружены, просто возвращаем их
    if (cardsCollection.length > 0) {
      console.log(`✅ Карты уже загружены (${cardsCollection.length} шт.), возвращаем существующие`);
      return cardsCollection;
    }

    try {
      setLoading(true);
      console.error('⚠️ ПРИНУДИТЕЛЬНАЯ ЗАГРУЗКА ТЕСТОВЫХ КАРТ!');

      // Создаем уникальный идентификатор запроса для отслеживания
      const requestId = Date.now();
      console.log(`loadCards[${requestId}]: Начинаем загрузку тестовых карт...`);

      // Небольшая искусственная задержка для симуляции загрузки
      await new Promise(resolve => setTimeout(resolve, 500));

      // Принудительно генерируем тестовые карты напрямую
      const testCards = generateTestCards();

      if (!testCards || testCards.length === 0) {
        throw new Error('Сгенерированы пустые тестовые карты!');
      }

      console.log(`loadCards[${requestId}]: Загружено ${testCards.length} тестовых карт, обновляем состояние`);

      // Устанавливаем карты в состояние
      setCardsCollection(testCards);
      console.log(`loadCards[${requestId}]: Состояние обновлено, cardsCollection теперь содержит ${testCards.length} карт`);

      // Настраиваем другие состояния
      setLoading(false);
      setCardsRequested(false);
      setError('');

      console.log(`loadCards[${requestId}]: Карты успешно загружены`);

      // Возвращаем карты для использования в цепочке вызовов
      return testCards;
    } catch (err) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА загрузки карт:', err);
      // Показываем четкое сообщение об ошибке
      setError(`Критическая ошибка загрузки карт: ${err.message}`);
      setLoading(false);

      // В случае ошибки, попробуем еще раз сгенерировать карты напрямую
      console.log('Пробуем аварийную генерацию...');

      try {
        const emergencyCards = [
          {
            _id: 'emergency-card-1',
            name: 'АВАРИЙНАЯ КАРТА - Паника!',
            type: 'attack',
            power: 1,
            couplet: 'Что-то пошло не так! Это аварийная карта!',
            description: 'Эта карта была создана из-за ошибки загрузки обычных карт',
            effects: [{ type: 'damage', value: 1, description: 'Аварийный эффект' }],
            image: '/images/cards/default.png',
            rarity: 'common'
          }
        ];

        // Устанавливаем аварийные карты
        setCardsCollection(emergencyCards);
        console.log('Установлены аварийные карты вместо основных');

        // Сбрасываем флаг через небольшую задержку
        setTimeout(() => {
          setCardsRequested(false);
        }, 1000);

        return emergencyCards;
      } catch (emergencyError) {
        // Если даже это не работает, выводим критическую ошибку
        console.error('❌❌❌ ПОЛНЫЙ СБОЙ ЗАГРУЗКИ КАРТ:', emergencyError);
        return [];
      }
    }
  }, [setLoading, setCardsCollection, setError, generateTestCards, currentUser]);

  // Переместим определение joinRoom сюда, после объявления всех необходимых функций
  const joinRoom = useCallback((roomId) => {
    if (!socket || !currentUser) {
      console.error('Невозможно присоединиться к комнате: отсутствует сокет или пользователь не авторизован');
      return;
    }

    // Дополнительная проверка и синхронизация состояния
    const roomChanged = currentRoom !== roomId;

    // Сразу обновляем локальное состояние, не дожидаясь ответа сервера
    if (roomChanged) {
      console.log('Обновляем текущую комнату перед отправкой запроса:', roomId);
      setCurrentRoom(roomId);
      // Устанавливаем временное состояние ожидания
      setGameStatus('waiting');
    }

    // Проверяем, не в этой ли комнате мы уже находимся
    if (currentRoom === roomId && !roomChanged) {
      console.log('Вы уже находитесь в комнате:', roomId);

      // Запрашиваем актуальное состояние комнаты для синхронизации
      if (socket && socket.connected) {
        console.log('Отправляем запрос на получение актуального состояния комнаты');
        debouncedGetRoomState(roomId);
      }

      // ВАЖНО: Даже если мы уже в комнате, все равно проверяем карты
      if (cardsCollection.length === 0 && !loading) {
        console.log('⚠️ Карты не загружены, загружаем даже если уже в комнате');
        loadCards();
      }

      return;
    }

    // ВАЖНО: Принудительная загрузка карт теперь вызывается с промисом, 
    // чтобы гарантировать, что карты будут загружены до игры
    console.log('🔄 Принудительная загрузка карт при присоединении к комнате');

    // Создаем промис для загрузки карт
    const loadCardsPromise = new Promise(async (resolve) => {
      try {
        // Всегда загружаем карты заново при присоединении к комнате для надежности
        console.log('Загружаем карты перед присоединением к комнате...');
        const cards = await loadCards();
        console.log(`Загружено ${cards?.length || 0} карт перед присоединением к комнате`);
        resolve(true);
      } catch (err) {
        console.error('Ошибка загрузки карт:', err);
        // Все равно продолжаем подключение к комнате
        resolve(false);
      }
    });

    // Ждем загрузки карт, а затем отправляем запрос на присоединение
    loadCardsPromise.then(() => {
      console.log('Отправка запроса на присоединение к комнате:', roomId, 'для пользователя:', currentUser.id);

      // Устанавливаем явный путь в истории браузера, чтобы URL соответствовал комнате
      if (roomChanged && navigate) {
        navigate(`/game/${roomId}`);
      }

      // Эмитим событие присоединения к комнате
      socket.emit('joinRoom', { roomId, userId: currentUser.id });

      // Инициируем только один запрос состояния комнаты с задержкой
      setTimeout(() => {
        if (socket && socket.connected) {
          console.log('Запрос состояния комнаты после присоединения с оптимальной задержкой');
          debouncedGetRoomState(roomId);
        }
      }, 1000); // Оптимальная задержка в 1 секунду
    });
  }, [socket, currentUser, currentRoom, cardsCollection.length, loading, navigate, debouncedGetRoomState, loadCards, setCurrentRoom, setGameStatus]);

  // Настройка слушателей сокета
  useEffect(() => {
    if (!socket) return;

    // Проверяем, были ли уже инициализированы слушатели
    if (socket._listenersInitialized) {
      console.log('Слушатели уже настроены, пропускаем повторную настройку');
      return;
    }

    // Предотвращаем множественные установки слушателей
    // Сначала удаляем все существующие обработчики
    socket.off('connected');
    socket.off('error');
    socket.off('pong');
    socket.off('roomCreated');
    socket.off('leftRoom');
    socket.off('joinedRoom');
    socket.off('roomState');
    socket.off('joinRoomError');
    socket.off('playerJoined');
    socket.off('cardsSelected');
    socket.off('playerReady');
    socket.off('battleStart');
    socket.off('cardPlayed');
    socket.off('turnEnded');
    socket.off('specialEvent');
    socket.off('gameEnded');
    socket.off('playerDisconnected');
    socket.off('roomChecked');
    socket.off('gameStatusUpdate');

    console.log('🔄 Настройка слушателей Socket.io');

    // Тестовое событие от сервера
    socket.on('connected', (data) => {
      console.log('Получено приветствие от сервера:', data);
    });

    // Обработчик ошибок от сервера
    socket.on('error', (data) => {
      console.error('Получена ошибка от сервера:', data);
      if (data && data.message) {
        setError(data.message);
        // Показываем уведомление пользователю
        alert(`Ошибка сервера: ${data.message}`);
      }
    });

    // Ответ на пинг
    socket.on('pong', (data) => {
      console.log('Получен pong от сервера:', data);
      const latency = new Date() - new Date(data.received.timestamp);
      console.log(`Задержка: ${latency}ms`);
    });

    // Создание комнаты
    socket.on('roomCreated', (data) => {
      console.log('Комната создана:', data);
      setCurrentRoom(data.roomId);
      setGameStatus('waiting');
      navigate(`/game/${data.roomId}`);
    });

    // Выход из комнаты (новый обработчик)
    socket.on('leftRoom', (data) => {
      console.log('Выход из комнаты подтвержден сервером:', data);
      // Сбрасываем состояние только когда получаем подтверждение от сервера
      resetGame();
    });

    // Присоединение к комнате
    socket.on('joinedRoom', (data) => {
      console.log('Присоединились к комнате:', data);
      setCurrentRoom(data.roomId);

      // Устанавливаем статус комнаты
      if (data.status && data.status !== gameStatus) {
        console.log('Обновляем статус игры при присоединении к комнате:', data.status);
        setGameStatus(data.status);
      }
      // Статус игры устанавливаем только если не находимся уже в режиме боя
      else if (gameStatus !== 'battle' && !data.status) {
        console.log('Установка статуса по умолчанию при присоединении к комнате');
        setGameStatus('selecting_cards');
      }

      // ПОВТОРНАЯ ПРОВЕРКА И ЗАГРУЗКА КАРТ
      console.log('joinedRoom: Проверка наличия карт:', cardsCollection.length);

      // Принудительно загружаем карты независимо от предыдущего состояния
      console.log('joinedRoom: Принудительно загружаем карты');
      loadCards().then(cards => {
        console.log(`joinedRoom: Загружено ${cards?.length || 0} карт после присоединения к комнате`);
      }).catch(err => {
        console.error('joinedRoom: Ошибка загрузки карт:', err);
      });

      // Запрашиваем состояние комнаты единожды после присоединения
      if (data.roomId) {
        console.log('Запрашиваем актуальное состояние комнаты после присоединения');
        // Запрашиваем состояние комнаты только один раз с небольшой задержкой
        setTimeout(() => {
          if (socket && socket.connected) {
            console.log('Запрос состояния комнаты после присоединения');
            debouncedGetRoomState(data.roomId);
          }
        }, 500);
      }

      // Если вторым игроком присоединились к игре в процессе боя
      if (data.battleInProgress) {
        console.log('Присоединились к комнате, где уже идет бой');
        setGameStatus('battle');
      }
    });

    // Новый обработчик для получения состояния комнаты
    socket.on('roomState', (data) => {
      // Заменяем постоянный лог на более умный вариант
      const isNewState = !gameState ||
        !gameState.players ||
        gameState.players.length !== data.players.length ||
        gameState.status !== data.status;

      // Добавляем подробную информацию для отладки
      let logMessage = isNewState ?
        'Получено существенное обновление состояния комнаты:' :
        'Получено незначительное обновление состояния комнаты:';

      console.log(logMessage, {
        roomId: data.roomId,
        status: data.status,
        playersCount: data.players?.length || 0,
        players: data.players?.map(p => ({ id: p.userId, ready: p.isReady })),
        timestamp: data.timestamp
      });

      // Проверяем наличие состояния и всех необходимых свойств
      if (!data || !data.status) {
        console.log('Получено некорректное состояние комнаты:', data);
        return;
      }

      // Проверяем соответствие состояния текущей комнате
      if (data.roomId !== currentRoom) {
        console.log(`Получено состояние для другой комнаты (${data.roomId}), но мы находимся в комнате ${currentRoom}`);
        return;
      }

      // Важно: обновляем состояние комнаты до проверки статуса, 
      // чтобы убедиться, что состояние игроков обновлено
      setGameState(data);

      // Затем, если изменился статус, обновляем и его
      if (data.status !== gameStatus) {
        console.log(`Обновляем статус игры из roomState: ${data.status} (был: ${gameStatus})`);
        setGameStatus(data.status);
      }
    });

    // Ошибка при присоединении к комнате
    socket.on('joinRoomError', (data) => {
      console.error('Ошибка при присоединении к комнате:', data);
      setError(data.message);
    });

    // Присоединение игрока к комнате
    socket.on('playerJoined', (data) => {
      console.log('Получено событие playerJoined:', data);

      // Принудительное запрашивание состояния комнаты при присоединении нового игрока
      if (currentRoom) {
        console.log('Немедленно запрашиваем обновление состояния при присоединении игрока');

        // Сначала сразу же отправляем запрос без задержки
        if (socket && socket.connected) {
          console.log('СРОЧНЫЙ запрос состояния комнаты после присоединения игрока');
          // Напрямую отправляем сокет-запрос, в обход троттлинга
          socket.emit('getRoomState', { roomId: currentRoom });

          // Обновляем таймеры троттлинга, чтобы не дублировать запросы
          GLOBAL_THROTTLE_STATE.lastRoomStateRequestTime = Date.now();
          GLOBAL_THROTTLE_STATE.pendingRequests[currentRoom] = Date.now();
        }

        // Дополнительно запрашиваем состояние с задержкой, на случай если сервер не успел обработать первое обновление
        setTimeout(() => {
          if (socket && socket.connected) {
            console.log('Повторный запрос состояния комнаты после присоединения игрока (через 800мс)');
            debouncedGetRoomState(currentRoom);
          }
        }, 800); // Уменьшаем задержку до 800мс (было 1500)
      }

      // Предварительно обновляем информацию об игроках в UI без ожидания ответа от сервера
      setGameState(prevState => {
        // Проверяем, есть ли предыдущее состояние и создаем его структуру, если нет
        if (!prevState || !prevState.players) {
          console.log('Нет предыдущего состояния, создаем новое с обоими игроками');
          return {
            players: [
              { userId: currentUser.id, isReady: false },
              { userId: data.userId, isReady: false }
            ],
            status: 'selecting_cards',
            playersCount: 2,
            timestamp: data.timestamp
          };
        }

        // Проверяем, есть ли уже этот игрок в списке
        const playerExists = prevState.players.some(player => player.userId === data.userId);
        if (playerExists) {
          console.log('Игрок уже добавлен в состояние');
          // Даже если игрок существует, обновляем playersCount для уверенности
          return {
            ...prevState,
            playersCount: prevState.players.length,
            timestamp: data.timestamp
          };
        }

        // Если игрок еще не добавлен, добавляем его
        console.log('Добавляем нового игрока в состояние');
        const updatedPlayers = [...prevState.players, { userId: data.userId, isReady: false }];
        return {
          ...prevState,
          players: updatedPlayers,
          playersCount: updatedPlayers.length,
          timestamp: data.timestamp
        };
      });

      // Загружаем карты для нового игрока, если они еще не загружены
      if (cardsCollection.length === 0 && !loading && !cardsRequested) {
        console.log('Загружаем карты при присоединении игрока');
        setCardsRequested(true);
        loadCards();
      }
    });

    // Выбор карт подтвержден
    socket.on('cardsSelected', (data) => {
      console.log('Получено подтверждение выбора карт от сервера:', data);

      if (!data || !data.success) {
        console.error('Ошибка в ответе сервера на выбор карт:', data);
        setError(data?.message || 'Сервер не подтвердил выбор карт');
        return;
      }

      // Отображаем логи выбранных карт
      if (data.cards && Array.isArray(data.cards)) {
        console.log(`Выбрано ${data.cards.length} карт:`, data.cards);
      }

      // Обновляем статус готовности игрока
      setPlayerReady(true);

      // Запрашиваем обновление состояния комнаты
      if (socket && socket.connected && currentRoom) {
        console.log('Запрашиваем обновление состояния комнаты после подтверждения выбора карт');
        debouncedGetRoomState(currentRoom);
      }
    });

    // Игрок готов (новое событие)
    socket.on('playerReady', (data) => {
      console.log('Игрок готов:', data);

      // Обновляем состояние игры с информацией о готовности игрока
      setGameState(prevState => {
        if (!prevState || !prevState.players) return prevState;

        const updatedPlayers = prevState.players.map(player =>
          player.userId === data.userId
            ? { ...player, isReady: true }
            : player
        );

        return {
          ...prevState,
          players: updatedPlayers
        };
      });
    });

    // Начало боя
    socket.on('battleStart', (data) => {
      setGameStatus('battle');
      setGameState(data);
    });

    // Разыгрывание карты
    socket.on('cardPlayed', (data) => {
      // Обновление состояния игры после разыгрывания карты
      if (data.success) {
        setBattleLog(prev => [...prev, data.battleLog]);

        // Обновление счета игрока
        if (gameState) {
          const updatedPlayers = [...gameState.players];
          const playerIndex = data.player.index;
          updatedPlayers[playerIndex].score = data.player.newScore;

          setGameState({
            ...gameState,
            players: updatedPlayers
          });
        }
      }
    });

    // Окончание хода
    socket.on('turnEnded', (data) => {
      setGameState(data);
    });

    // Специальное событие
    socket.on('specialEvent', (data) => {
      setCurrentEvent(data);
    });

    // Окончание игры
    socket.on('gameEnded', (data) => {
      setGameStatus('ended');
      setGameState(data);
    });

    // Отключение игрока
    socket.on('playerDisconnected', (data) => {
      setError(data.message);
      setGameStatus('ended');
    });

    // Добавим обработчик для проверки комнаты
    socket.on('roomChecked', (data) => {
      console.log('Получен результат проверки комнаты:', data);
      setRoomChecked(true); // Устанавливаем флаг, что комната была проверена

      if (data.exists) {
        // Комната существует, присоединяемся к ней только если мы не в процессе игры
        console.log('Комната существует, переподключаемся...');
        socket.emit('joinRoom', { roomId: data.roomId, userId: currentUser.id });
      } else {
        // Комната не существует или закрыта, сбрасываем состояние
        console.log('Комната не существует или закрыта, сбрасываем состояние');
        resetGame();
      }
    });

    // Новый обработчик для принудительного обновления статуса
    socket.on('gameStatusUpdate', (data) => {
      console.log('Получено принудительное обновление статуса игры:', data);

      // Проверяем, что сообщение для текущей комнаты
      if (data.roomId === currentRoom) {
        // Обновляем статус игры
        if (data.status && data.status !== 'waiting' && gameStatus === 'waiting') {
          console.log('Принудительное обновление статуса игры:', data.status);
          setGameStatus(data.status);
        }

        // Запрашиваем актуальное состояние комнаты
        socket.emit('getRoomState', { roomId: currentRoom });
      }
    });

    return () => {
      socket.off('disconnect');
      socket.off('error');
      socket.off('roomCreated');
      socket.off('joinedRoom');
      socket.off('joinRoomError');
      socket.off('playerJoined');
      socket.off('cardsSelected');
      socket.off('playerReady');
      socket.off('battleStart');
      socket.off('cardPlayed');
      socket.off('turnEnded');
      socket.off('specialEvent');
      socket.off('gameEnded');
      socket.off('playerDisconnected');
      socket.off('roomState');
      socket.off('roomChecked');
      socket.off('gameStatusUpdate'); // Отписываемся от нового события
    };

    // Устанавливаем флаг, что слушатели были инициализированы
    socket._listenersInitialized = true;
  }, [socket, navigate, currentUser?.id, currentRoom, gameStatus, joinRoom]);

  // Сохраняем currentRoom в localStorage при его изменении
  useEffect(() => {
    if (currentRoom) {
      localStorage.setItem('currentRoom', currentRoom);
    } else {
      localStorage.removeItem('currentRoom');
    }
  }, [currentRoom]);

  // Сохраняем gameStatus в localStorage при его изменении
  useEffect(() => {
    if (gameStatus) {
      localStorage.setItem('gameStatus', gameStatus);
    } else {
      localStorage.removeItem('gameStatus');
    }
  }, [gameStatus]);

  // Автоматическое переподключение к комнате при загрузке страницы
  useEffect(() => {
    if (isConnected && currentRoom && currentUser && gameStatus !== 'idle' && !roomChecked) {
      console.log('Автоматическое переподключение к комнате:', currentRoom);

      // Проверяем, активна ли еще комната на сервере, только если ещё не проверяли
      socket.emit('checkRoom', { roomId: currentRoom, userId: currentUser.id });
    }
  }, [isConnected, currentUser, socket, currentRoom, gameStatus, roomChecked]);

  // Добавляем эффект для проверки и восстановления состояния комнаты при инициализации
  useEffect(() => {
    // Проверяем localStorage на наличие сохраненной комнаты
    const savedRoom = localStorage.getItem('currentRoom');
    const savedStatus = localStorage.getItem('gameStatus');

    // Если есть сохраненная комната и сокет подключен, запрашиваем ее состояние
    if (savedRoom && socket && socket.connected && currentUser) {
      console.log('Обнаружена сохраненная комната:', savedRoom, 'статус:', savedStatus);

      // Проверяем, существует ли еще эта комната
      socket.emit('checkRoom', { roomId: savedRoom, userId: currentUser.id });

      // Устанавливаем таймаут на проверку результата
      const checkTimer = setTimeout(() => {
        // Если клиент еще не получил ответ о существовании комнаты
        if (!roomChecked) {
          console.log('Не получен ответ о проверке комнаты, пробуем переподключиться');
          joinRoom(savedRoom);
        }
      }, 3000); // Даем 3 секунды на получение ответа

      return () => clearTimeout(checkTimer);
    }
  }, [socket, socket?.connected, currentUser, roomChecked, joinRoom]);

  // Проверка и загрузка карт при монтировании компонента - НОВОЕ
  useEffect(() => {
    // Немедленная загрузка карт при инициализации компонента
    if (cardsCollection.length === 0 && !loading && !cardsRequested) {
      console.log('⚠️ АВТОМАТИЧЕСКАЯ ЗАГРУЗКА КАРТ ПРИ МОНТИРОВАНИИ GameContext ⚠️');
      setCardsRequested(true);
      loadCards().then(cards => {
        console.log(`Загружено ${cards?.length || 0} карт при монтировании`);
      });
    }
  }, []);

  // Создание комнаты
  const createRoom = () => {
    if (!socket || !currentUser) {
      console.error('Невозможно создать комнату: отсутствует сокет или пользователь не авторизован');
      return;
    }

    console.log('Отправка запроса на создание комнаты для пользователя:', currentUser.id);
    socket.emit('createRoom', { userId: currentUser.id });
  };

  // Резервный метод создания комнаты через HTTP
  const createRoomHttp = async () => {
    if (!currentUser) {
      console.error('Невозможно создать комнату: пользователь не авторизован');
      return;
    }

    try {
      console.log('Запрос на создание комнаты через HTTP API для пользователя:', currentUser.id);
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5101'}/api/games/create-test`,
        { userId: currentUser.id }
      );

      console.log('Ответ от сервера:', response.data);

      if (response.data.roomId) {
        setCurrentRoom(response.data.roomId);
        setGameStatus('waiting');
        alert(`Комната создана: ${response.data.roomId}. Нажмите OK для перехода.`);
        navigate(`/game/${response.data.roomId}`);
      }
    } catch (err) {
      console.error('Ошибка при создании комнаты через HTTP:', err);
      setError(`Ошибка создания комнаты: ${err.message}`);
    }
  };

  // Выбор карт для боя
  const selectCardsForBattle = (cardIds) => {
    console.log('GameContext: Вызов selectCardsForBattle, выбранные карты:', cardIds);

    // Проверяем на форматирование и создаем копию, чтобы избежать мутаций
    const safeCardIds = Array.isArray(cardIds) ? [...cardIds] : [];

    if (!socket) {
      console.error('GameContext: Невозможно выбрать карты - socket не инициализирован');
      setError('Отсутствует соединение с сервером. Обновите страницу');

      // Пробуем переподключиться автоматически
      reconnectSocket();
      return false;
    }

    if (!currentUser) {
      console.error('GameContext: Невозможно выбрать карты - пользователь не авторизован');
      setError('Необходимо авторизоваться');
      return false;
    }

    if (!currentRoom) {
      console.error('GameContext: Невозможно выбрать карты - не выбрана комната');
      setError('Не выбрана игровая комната');
      return false;
    }

    // Проверяем корректность ID карт
    if (safeCardIds.length === 0) {
      console.error('GameContext: Невозможно выбрать карты - некорректные данные карт:', cardIds);
      setError('Выберите карты для игры');
      return false;
    }

    console.log(`GameContext: Отправка выбранных карт (${safeCardIds.length}) на сервер. Комната: ${currentRoom}, Пользователь: ${currentUser.id}`);

    // Сохраняем карты в локальном состоянии
    setSelectedCards(safeCardIds);

    // Проверяем соединение с сервером с повторными попытками
    const socketStatus = diagnoseSockets();

    if (!socketStatus.connected) {
      console.error('GameContext: Соединение с сервером потеряно, пробуем восстановить...');

      // Пробуем переподключиться перед отправкой
      try {
        socket.connect();

        // Даем время на переподключение
        setTimeout(() => {
          if (socket.connected) {
            console.log('GameContext: Соединение восстановлено, пробуем отправить карты снова...');
            // Рекурсивно вызываем функцию заново после переподключения
            selectCardsForBattle(safeCardIds);
          } else {
            setError('Не удалось восстановить соединение с сервером. Обновите страницу и попробуйте снова');
          }
        }, 1000);
      } catch (err) {
        console.error('GameContext: Не удалось восстановить соединение:', err);
        setError('Соединение с сервером потеряно. Обновите страницу и попробуйте снова');
        return false;
      }

      return false;
    }

    // Снимаем предыдущие ошибки
    setError('');

    try {
      // Отправляем событие на сервер с проверкой доставки
      const eventData = {
        roomId: currentRoom,
        userId: currentUser.id,
        cards: safeCardIds,
        timestamp: new Date().toISOString()
      };

      console.log('GameContext: Отправка данных карт:', JSON.stringify(eventData));

      // Устанавливаем флаг для отслеживания ответа
      let responseReceived = false;

      // Функция для однократной обработки ответа
      const handleResponse = (response) => {
        if (responseReceived) return; // Избегаем повторной обработки
        responseReceived = true;

        console.log('GameContext: Получен ответ о выборе карт:', response);
        clearTimeout(timeoutId);
      };

      // Устанавливаем временный обработчик для отслеживания ответа
      const onCardsSelectedHandler = (data) => handleResponse(data);
      socket.once('cardsSelected', onCardsSelectedHandler);

      // Устанавливаем временный обработчик ошибок
      const onErrorHandler = (data) => {
        console.error('GameContext: Получена ошибка при выборе карт:', data);
        handleResponse({ success: false, error: data?.message || 'Неизвестная ошибка' });
      };
      socket.once('error', onErrorHandler);

      // Устанавливаем таймер для проверки ответа
      const timeoutId = setTimeout(() => {
        if (!responseReceived) {
          console.error('GameContext: Таймаут ожидания ответа от сервера');
          socket.off('cardsSelected', onCardsSelectedHandler);
          socket.off('error', onErrorHandler);
          setError('Сервер не отвечает. Проверьте соединение и попробуйте снова');
        }
      }, 5000);

      // Отправляем данные
      socket.emit('selectCards', eventData);
      console.log('GameContext: Событие selectCards успешно отправлено');

      // Запрашиваем обновление состояния комнаты через задержку
      setTimeout(() => {
        if (socket && socket.connected) {
          console.log('GameContext: Запрос обновления состояния комнаты после выбора карт');
          debouncedGetRoomState(currentRoom);
        }
      }, 1000);

      return true;
    } catch (err) {
      console.error('GameContext: Ошибка при отправке выбранных карт:', err);
      setError(`Ошибка отправки карт: ${err.message}`);
      return false;
    }
  };

  // Разыгрывание карты
  const playCard = (cardId, targetCardId = null) => {
    if (!socket || !currentUser || !currentRoom || gameStatus !== 'battle') return;

    socket.emit('playCard', {
      roomId: currentRoom,
      userId: currentUser.id,
      cardId,
      targetCardId
    });
  };

  // Сброс состояния игры
  const resetGame = () => {
    setCurrentRoom(null);
    setGameStatus('idle');
    setPlayerReady(false);
    setGameState(null);
    setSelectedCards([]);
    setBattleLog([]);
    setCurrentEvent(null);
    setRoomChecked(false); // Сбрасываем флаг проверки комнаты

    // Очищаем localStorage
    localStorage.removeItem('currentRoom');
    localStorage.removeItem('gameStatus');
  };

  // Диагностика состояния сокета - улучшенная версия
  const diagnoseSockets = () => {
    if (!socket) {
      console.log('Сокет не инициализирован');
      return { connected: false, disconnected: true, error: 'Сокет не инициализирован' };
    }

    // Проверяем текущее соединение сокета
    const isSocketConnected = socket.connected;

    // Если сокет не подключен, пробуем восстановить соединение
    if (!isSocketConnected) {
      console.log('Сокет не подключен, пробуем переподключиться...');
      try {
        socket.connect();
      } catch (e) {
        console.error('Ошибка при попытке переподключения:', e);
      }
    }

    const status = {
      id: socket.id,
      connected: socket.connected || isConnected, // Используем оба источника
      disconnected: socket.disconnected && !isConnected,
      timestamp: new Date().toISOString(),
      reconnectAttempt: !isSocketConnected
    };

    // Отправляем пинг для проверки соединения
    const lastPingTime = socket._lastPingTime || 0;
    const now = Date.now();
    const timeSinceLastPing = now - lastPingTime;

    try {
      if (status.connected && timeSinceLastPing > 3000) { // Уменьшаем интервал до 3 секунд для более частой проверки
        socket.emit('ping', { timestamp: new Date().toISOString() });
        console.log('Отправлен пинг на сервер, прошло с последнего:', timeSinceLastPing, 'мс');
        socket._lastPingTime = now; // Сохраняем время последнего пинга
      }
    } catch (err) {
      console.error('Ошибка при отправке пинга:', err);
      status.pingError = err.message;
      status.connected = false; // Если не можем отправить пинг, считаем соединение потерянным
    }

    console.log('Диагностика сокета:', status);
    return status;
  };

  // Попытка ручного переподключения
  const reconnectSocket = () => {
    if (socket) {
      console.log('Отключение текущего сокета перед переподключением');
      socket.disconnect();
    }

    console.log('Установка socket в null для нового подключения');
    setSocket(null);
    setError('');

    // useEffect с зависимостью от socket создаст новое подключение
    return true;
  };

  // Инициализация сокета при монтировании компонента
  useEffect(() => {
    if (currentUser && !socket) {
      console.log('Инициализация сокета для пользователя:', currentUser.id);

      // Проверяем, сколько активных соединений уже существует
      if (GLOBAL_SOCKET_STATE.activeConnections >= GLOBAL_SOCKET_STATE.maxConnections) {
        console.warn('Превышено максимальное количество соединений!');
        console.warn('Существующий сокет:', GLOBAL_SOCKET_STATE.lastSocketId);
        return; // Прерываем создание нового соединения
      }

      try {
        // Создаем новый сокет с базовыми параметрами - так же, как в работающей тестовой странице
        console.log('Создание сокета с URL:', 'http://localhost:5101');

        const newSocket = io('http://localhost:5101', {
          transports: ['websocket', 'polling'],
          reconnection: true,
          autoConnect: false // Важно: отключаем автоподключение
        });

        // Регистрируем соединение
        GLOBAL_SOCKET_STATE.activeConnections++;

        // Явно маркируем сокет, что он новый и требует настройки слушателей
        newSocket._listenersInitialized = false;

        console.log('Socket.io создан, подключаем...');

        // Устанавливаем обработчики до подключения
        newSocket.on('connect', () => {
          console.log('Socket.io ПОДКЛЮЧЕН! SocketID:', newSocket.id);
          // Сохраняем ID сокета
          GLOBAL_SOCKET_STATE.lastSocketId = newSocket.id;
          setIsConnected(true);
        });

        newSocket.on('connect_error', (err) => {
          console.error('Ошибка подключения Socket.io:', err.message, err);
          setError(`Ошибка подключения к серверу: ${err.message}`);
        });

        newSocket.io.on('error', (err) => {
          console.error('Общая ошибка Socket.io:', err);
        });

        // Добавляем обработчик дисконнекта здесь тоже
        newSocket.on('disconnect', (reason) => {
          console.log('Соединение с сервером разорвано. Причина:', reason);
          // Уменьшаем счетчик активных соединений
          GLOBAL_SOCKET_STATE.activeConnections = Math.max(0, GLOBAL_SOCKET_STATE.activeConnections - 1);
          setIsConnected(false);
        });

        // Устанавливаем socket в state до подключения
        setSocket(newSocket);

        // Добавляем небольшую задержку перед подключением для надежности
        setTimeout(() => {
          console.log('Вызываем connect() после задержки...');
          // Явное подключение с небольшой задержкой
          newSocket.connect();
          console.log('Socket.io метод connect() вызван');
        }, 300);

        return () => {
          console.log('Отключение сокета');
          // Отключаем сокет и уменьшаем счетчик активных соединений
          newSocket.disconnect();
          GLOBAL_SOCKET_STATE.activeConnections = Math.max(0, GLOBAL_SOCKET_STATE.activeConnections - 1);
        };
      } catch (err) {
        console.error('Критическая ошибка при создании Socket.io:', err);
        setError('Не удалось инициализировать соединение с сервером');
      }
    }
  }, [currentUser, socket]);

  // Активная проверка состояния подключения
  useEffect(() => {
    if (socket) {
      // Проверяем состояние сокета реже - раз в 5 секунд вместо 2
      const connectionInterval = setInterval(() => {
        // Обновляем состояние только если оно изменилось
        if (socket.connected !== isConnected) {
          console.log('Изменение состояния подключения:', socket.id, socket.connected);
          setIsConnected(socket.connected);
        }
      }, 5000);

      return () => {
        clearInterval(connectionInterval);
      };
    }
  }, [socket, isConnected]);

  // Регулярное обновление состояния комнаты
  useEffect(() => {
    let intervalId = null;

    // Начинаем периодическое обновление только если мы в комнате и в режиме ожидания или выбора карт
    if (currentRoom && socket && socket.connected &&
      (gameStatus === 'waiting' || gameStatus === 'selecting_cards' || gameStatus === 'cards_selection')) {

      console.log('Запускаем интервал автоматического обновления состояния комнаты');

      // Сразу запрашиваем актуальное состояние
      debouncedGetRoomState(currentRoom);

      // Устанавливаем интервал проверки
      intervalId = setInterval(() => {
        if (socket && socket.connected) {
          console.log('Автоматическое обновление состояния комнаты по интервалу');
          debouncedGetRoomState(currentRoom);
        }
      }, 3000); // Проверяем каждые 3 секунды
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentRoom, socket, gameStatus, debouncedGetRoomState]);

  // Эффект для загрузки карт при изменении статуса игры
  useEffect(() => {
    // Загружаем карты при переходе в фазу выбора карт
    if ((gameStatus === 'selecting_cards' || gameStatus === 'cards_selection') && currentRoom && currentUser) {
      console.log(`Проверка загрузки карт при изменении статуса на ${gameStatus}`);

      // Проверяем, загружены ли карты
      if (cardsCollection.length === 0 && !loading) {
        console.log('Статус изменен на выбор карт, но карты не загружены - загружаем их...');
        loadCards().then(cards => {
          console.log(`Загружено ${cards?.length || 0} карт при изменении статуса игры`);
        }).catch(err => {
          console.error('Ошибка загрузки карт при изменении статуса:', err);
        });
      } else if (cardsCollection.length > 0) {
        console.log(`Карты уже загружены (${cardsCollection.length} шт.) при изменении статуса`);
      } else if (loading) {
        console.log('Загрузка карт уже выполняется при изменении статуса');
      }
    }
  }, [gameStatus, currentRoom, currentUser, cardsCollection.length, loading, loadCards]);

  // Предоставляем значение контекста
  const value = {
    isConnected: isConnected,
    currentRoom,
    gameStatus,
    playerReady,
    gameState,
    selectedCards,
    battleLog,
    currentEvent,
    cardsCollection,
    loading,
    error,
    setError,
    createRoom,
    createRoomHttp,
    joinRoom,
    selectCardsForBattle,
    playCard,
    resetGame,
    loadCards,
    diagnoseSockets,
    reconnectSocket,
    socket,
    setGameStatus,
    throttledGetRoomState: debouncedGetRoomState,
    // Отладочная функция
    debugCardInfo: () => {
      console.log('===== ОТЛАДКА СОДЕРЖИМОГО КАРТ =====');
      console.log(`Всего карт в коллекции: ${cardsCollection.length}`);

      if (cardsCollection.length > 0) {
        console.log('Пример структуры карты:');
        console.log(JSON.stringify(cardsCollection[0], null, 2));

        // Проверка наличия ключевых полей в картах
        const counts = {
          total: cardsCollection.length,
          withId: 0,
          withName: 0,
          withType: 0,
          withImage: 0,
          withCouplet: 0,
          withPower: 0
        };

        cardsCollection.forEach(card => {
          if (card._id) counts.withId++;
          if (card.name) counts.withName++;
          if (card.type) counts.withType++;
          if (card.image) counts.withImage++;
          if (card.couplet) counts.withCouplet++;
          if (card.power !== undefined) counts.withPower++;
        });

        console.log('Статистика полей:');
        console.table(counts);

        // Группировка по типам
        const typeGroups = {};
        cardsCollection.forEach(card => {
          if (!typeGroups[card.type]) typeGroups[card.type] = 0;
          typeGroups[card.type]++;
        });

        console.log('Группировка по типам:');
        console.table(typeGroups);
      } else {
        console.log('Карты не загружены или коллекция пуста');
      }

      console.log('===== КОНЕЦ ОТЛАДКИ СОДЕРЖИМОГО КАРТ =====');
      return cardsCollection;
    }
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
} 