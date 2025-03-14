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

  // Добавляем явную функцию для синхронизации состояния playerReady
  const syncPlayerReadyStatus = (readyState = true, source = 'unknown') => {
    console.log(`GameContext: Синхронизация статуса playerReady=${readyState}, источник: ${source}`);

    // Защита от неправильного вызова
    if (typeof readyState !== 'boolean') {
      console.error(`GameContext: Попытка установить некорректное значение для playerReady:`, readyState);
      readyState = Boolean(readyState); // Явное приведение к boolean
    }

    // Проверяем реальное изменение состояния
    if (playerReady !== readyState) {
      console.log(`GameContext: Изменение статуса playerReady: ${playerReady} -> ${readyState}`);
    } else {
      console.log(`GameContext: Статус playerReady=${readyState} уже установлен, источник: ${source}`);
    }

    // Устанавливаем состояние
    setPlayerReady(readyState);

    // Глобальный флаг для синхронизации между компонентами
    window._playerReadyState = readyState;
    window._playerReadySource = source;

    // Также сохраняем в sessionStorage для дополнительной надежности
    try {
      if (readyState) {
        sessionStorage.setItem('playerReady', 'true');
        sessionStorage.setItem('playerReadyTimestamp', new Date().toISOString());
        sessionStorage.setItem('playerReadySource', source);

        // Если есть ошибка выбора карт, отправляем событие, чтобы UI мог обновиться
        if (window._cardSelectionErrorUI) {
          console.log('GameContext: Сбрасываем ошибку выбора карт в UI через пользовательское событие');

          try {
            // Создаем и диспатчим событие для обновления UI
            const event = new CustomEvent('playerReadyStateChanged', {
              detail: { ready: true, source }
            });
            window.dispatchEvent(event);

            // Сбрасываем флаг ошибки
            window._cardSelectionErrorUI = false;
          } catch (e) {
            console.error('GameContext: Ошибка при отправке пользовательского события:', e);
          }
        }
      } else {
        sessionStorage.removeItem('playerReady');
        sessionStorage.removeItem('playerReadyTimestamp');
        sessionStorage.removeItem('playerReadySource');
      }
    } catch (e) {
      console.error('GameContext: Ошибка при сохранении в sessionStorage:', e);
    }

    return readyState; // Возвращаем установленное значение
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

    // Очищаем sessionStorage
    sessionStorage.removeItem('playerReady');
    sessionStorage.removeItem('playerReadyTimestamp');
    sessionStorage.removeItem('playerReadySource');

    console.log('GameContext: Состояние игры сброшено');
  };

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

    // Инициализация статистики загрузки, если она еще не создана
    if (!window._cardsLoadStats) {
      window._cardsLoadStats = {
        totalCalls: 0,
        successfulLoads: 0,
        failedLoads: 0,
        lastCall: null
      };
    }

    // Увеличиваем счетчик вызовов
    window._cardsLoadStats.totalCalls++;
    window._cardsLoadStats.lastCall = new Date().toISOString();

    // Идентификатор для трассировки текущего вызова
    const requestId = Math.random().toString(36).substring(2, 8);

    // Сохраним данные о контексте вызова для отладки
    const callerInfo = {
      requestId,
      timestamp: new Date().toISOString(),
      room: currentRoom || 'нет',
      gameStatus: gameStatus || 'нет',
      cardsLoaded: cardsCollection.length > 0 ? 'да' : 'нет',
      cardsCount: cardsCollection.length,
      socketConnected: socket?.connected ? 'да' : 'нет',
      socketId: socket?.id || 'нет',
      userId: currentUser?.id || 'нет',
      stackTrace: new Error().stack
    };

    console.log(`loadCards[${requestId}]: Контекст вызова:`, callerInfo);

    // Проверка, создан ли window._cardsLoadingPromise
    if (!window._cardsLoadingPromise) {
      window._cardsLoadingPromise = null;
    }

    // Проверка, создан ли window._cardsLoadingInProgress
    if (typeof window._cardsLoadingInProgress === 'undefined') {
      window._cardsLoadingInProgress = false;
    }

    // Проверяем, если загрузка уже идет
    if (window._cardsLoadingInProgress && window._cardsLoadingPromise) {
      console.log(`loadCards[${requestId}]: 🔵 Загрузка карт уже выполняется другим вызовом, ожидаем...`);
      try {
        // Возвращаем существующий промис вместо создания нового
        const result = await window._cardsLoadingPromise;

        if (result && result.length > 0) {
          console.log(`loadCards[${requestId}]: ✅ Успешно получены карты из существующего промиса: ${result.length} шт.`);
          return result;
        } else {
          console.log(`loadCards[${requestId}]: ⚠️ Существующий промис вернул пустой результат, инициируем новую загрузку`);
          // Если промис вернул пустой результат, сбрасываем флаг и продолжаем
          window._cardsLoadingInProgress = false;
        }
      } catch (err) {
        console.error(`loadCards[${requestId}]: Ошибка ожидания существующего промиса:`, err);
        // Если ожидание существующего промиса не удалось, продолжаем и создаем новый
        window._cardsLoadingInProgress = false;
      }
    }

    // Если карты уже загружены, просто возвращаем их
    if (cardsCollection.length > 0) {
      console.log(`loadCards[${requestId}]: ✅ Карты уже загружены (${cardsCollection.length} шт.), возвращаем существующие`);
      // Считаем это успешной загрузкой для статистики
      window._cardsLoadStats.successfulLoads++;
      return cardsCollection;
    }

    // Устанавливаем флаг загрузки
    window._cardsLoadingInProgress = true;
    setLoading(true);
    setCardsRequested(true);

    console.log(`loadCards[${requestId}]: ⚠️ ПРИНУДИТЕЛЬНАЯ ЗАГРУЗКА ТЕСТОВЫХ КАРТ!`);

    // Создаем новое обещание
    window._cardsLoadingPromise = new Promise(async (resolve) => {
      try {
        console.log(`loadCards[${requestId}]: Начинаем загрузку тестовых карт...`);

        // Небольшая искусственная задержка для симуляции загрузки
        await new Promise(resolve => setTimeout(resolve, 500));

        // Генерируем тестовые карты
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

        // Сбрасываем флаг загрузки
        window._cardsLoadingInProgress = false;

        // Обновляем статистику
        window._cardsLoadStats.successfulLoads++;

        // Завершаем промис
        resolve(testCards);
      } catch (innerErr) {
        console.error(`loadCards[${requestId}]: Внутренняя ошибка загрузки карт:`, innerErr);
        setLoading(false);
        setCardsRequested(false);
        window._cardsLoadingInProgress = false;

        // Обновляем статистику
        window._cardsLoadStats.failedLoads++;

        resolve([]);
      }
    });

    try {
      // Возвращаем результат ожидания промиса
      const cards = await window._cardsLoadingPromise;

      // Проверяем результат перед возвратом
      if (!cards || cards.length === 0) {
        console.warn(`loadCards[${requestId}]: Промис завершился успешно, но карты не были получены`);
      } else {
        console.log(`loadCards[${requestId}]: Успешно получены карты: ${cards.length} шт.`);
      }

      return cards;
    } catch (err) {
      console.error(`loadCards[${requestId}]: ❌ КРИТИЧЕСКАЯ ОШИБКА загрузки карт:`, err);

      // Показываем четкое сообщение об ошибке
      setError(`Критическая ошибка загрузки карт: ${err.message}`);
      setLoading(false);
      setCardsRequested(false);
      window._cardsLoadingInProgress = false;

      // Обновляем статистику
      window._cardsLoadStats.failedLoads++;

      // В случае ошибки, попробуем еще раз сгенерировать карты напрямую
      console.log(`loadCards[${requestId}]: Пробуем аварийную генерацию...`);

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
        console.log(`loadCards[${requestId}]: Установлены аварийные карты вместо основных`);

        return emergencyCards;
      } catch (emergencyError) {
        // Если даже это не работает, выводим критическую ошибку
        console.error(`loadCards[${requestId}]: ❌❌❌ ПОЛНЫЙ СБОЙ ЗАГРУЗКИ КАРТ:`, emergencyError);
        return [];
      }
    }
  }, [setLoading, setCardsCollection, setError, generateTestCards, currentUser, cardsCollection.length, currentRoom, gameStatus, socket]);

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

    // Добавляем обработчик для отладки всех входящих событий
    const debugHandler = (eventName) => (...args) => {
      console.log(`GameContext: DEBUG событие ${eventName} получено:`, args);
    };

    // Слушаем все ключевые события для отладки
    const events = ['cardsSelected', 'playerReady', 'updatePlayerStatus', 'roomState', 'gameStatusUpdate', 'battleStart'];
    events.forEach(eventName => {
      socket.on(eventName, debugHandler(eventName));
    });

    // Обработка нового события updatePlayerStatus для прямого обновления статуса игрока
    socket.on('updatePlayerStatus', (data) => {
      console.log('GameContext: Получено прямое обновление статуса игрока:', data);
      if (data.userId === currentUser?.id && data.isReady === true) {
        console.log('GameContext: Явно устанавливаем статус playerReady=true на основе updatePlayerStatus');
        syncPlayerReadyStatus(true, 'updatePlayerStatus');
      }
    });

    // Socket подключен
    socket.on('connected', (data) => {
      console.log('Соединение с сервером установлено:', data);
      setIsConnected(true);

      if (currentRoom) {
        console.log('Уже есть активная комната, отправляем запрос состояния:', currentRoom);
        // Явно запрашиваем состояние при подключении, если уже есть комната
        socket.emit('getRoomState', { roomId: currentRoom });

        // Проверяем статус playerReady из sessionStorage
        const savedPlayerReady = sessionStorage.getItem('playerReady');
        if (savedPlayerReady === 'true') {
          console.log('Восстанавливаем статус playerReady=true из sessionStorage после переподключения');
          setPlayerReady(true);
        }
      }
    });

    // Ошибка в соединении
    socket.on('connect_error', (error) => {
      console.error('Ошибка соединения с сервером:', error);
      setIsConnected(false);
      setError(`Ошибка соединения: ${error.message}`);
    });

    // Соединение разорвано
    socket.on('disconnect', (reason) => {
      console.log('Соединение с сервером разорвано:', reason);
      setIsConnected(false);
      setError(`Соединение разорвано: ${reason}`);

      // Если это не явное отключение, пробуем переподключиться
      if (reason !== 'io client disconnect') {
        console.log('Пробуем переподключиться...');
        socket.connect();
      }
    });

    // Уведомление об ошибке
    socket.on('error', (data) => {
      console.error('Получена ошибка от сервера:', data);
      setError(data.message || 'Неизвестная ошибка');
    });

    // Комната создана
    socket.on('roomCreated', (data) => {
      console.log('Комната создана:', data);

      if (data.roomId) {
        // Сохраняем ID комнаты
        setCurrentRoom(data.roomId);
        localStorage.setItem('currentRoom', data.roomId);

        // Присоединяемся к комнате
        joinRoom(data.roomId);
      }
    });

    // Успешное присоединение к комнате
    socket.on('joinedRoom', (data) => {
      console.log('Присоединились к комнате:', data);

      if (data.roomId) {
        setCurrentRoom(data.roomId);
        localStorage.setItem('currentRoom', data.roomId);
      }

      if (data.status) {
        setGameStatus(data.status);
        localStorage.setItem('gameStatus', data.status);
      }

      setError(''); // Сбрасываем ошибки
    });

    // Ошибка при присоединении к комнате
    socket.on('joinRoomError', (data) => {
      console.error('Ошибка при присоединении к комнате:', data);
      setError(data.message || 'Не удалось присоединиться к комнате');

      // Если комната не существует, сбрасываем состояние
      if (data.message.includes('не существует')) {
        resetGame();
      }
    });

    // Игрок присоединился к комнате
    socket.on('playerJoined', (data) => {
      console.log('Игрок присоединился к комнате:', data);

      // Запрашиваем обновленное состояние комнаты
      if (currentRoom) {
        socket.emit('getRoomState', { roomId: currentRoom });
      }
    });

    // Обработка cardsSelected - явно используем новую функцию синхронизации
    socket.on('cardsSelected', (data) => {
      console.log('GameContext: Получено событие cardsSelected:', data);

      // Добавляем подробное логирование
      const userId = data?.userId || 'неизвестно';
      const success = data?.success ? 'успешно' : 'ошибка';
      const currentUserId = currentUser?.id || 'не авторизован';
      console.log(`GameContext: cardsSelected для игрока ${userId} - ${success}, текущий игрок: ${currentUserId}`);

      // Синхронизируем состояние независимо от userId при успехе
      // Это позволяет обрабатывать случаи, когда сервер не присылает userId
      if (data && data.success) {
        console.log('GameContext: Устанавливаем playerReady=true на основе события cardsSelected (success=true)');
        syncPlayerReadyStatus(true, 'cardsSelected');

        // Дополнительное подтверждение для надежности
        window._cardSelectionConfirmed = true;
        window._cardSelectionTimestamp = new Date().toISOString();
      }
    });

    // Обработка playerReady - явно используем новую функцию синхронизации
    socket.on('playerReady', (data) => {
      console.log('GameContext: Получено событие playerReady:', data);

      // Расширяем логику обработки - принимаем и данные без userId для повышения надежности
      if (data) {
        // Проверяем соответствие пользователю, если userId указан
        if (!data.userId || data.userId === currentUser?.id) {
          console.log('GameContext: Устанавливаем статус playerReady=true на основе события playerReady');
          syncPlayerReadyStatus(true, 'playerReady');

          // Дополнительное подтверждение
          window._playerReadyConfirmed = true;
          window._playerReadyTimestamp = new Date().toISOString();
        } else {
          console.log(`GameContext: Событие playerReady для другого игрока (${data.userId}), игнорируем`);
        }
      }
    });

    // Обработка roomState - проверяем статус игрока
    socket.on('roomState', (data) => {
      console.log('GameContext: Получено событие roomState:', data);

      if (data && data.players && currentUser) {
        const player = data.players.find(p => p.userId === currentUser.id);
        if (player) {
          // Подробное логирование состояния игрока
          console.log(`GameContext: Состояние текущего игрока в roomState: id=${player.userId}, ready=${player.isReady}`);

          if (player.isReady) {
            console.log('GameContext: Игрок отмечен как готовый в roomState, синхронизируем состояние');
            syncPlayerReadyStatus(true, 'roomState');

            // Сбрасываем возможные флаги ошибок выбора карт (для совместимости с CardSelector)
            window._cardSelectionError = false;
          } else {
            console.log('GameContext: Игрок НЕ отмечен как готовый в roomState');
            // Не сбрасываем статус готовности, если он уже установлен в true
            // Это предотвращает рассинхронизацию при задержке обновления данных сервера
            if (!playerReady) {
              console.log('GameContext: Синхронизируем playerReady=false из roomState');
              syncPlayerReadyStatus(false, 'roomState');
            } else {
              console.log('GameContext: Сохраняем существующий playerReady=true несмотря на roomState');
            }
          }
        } else {
          console.log('GameContext: Текущий игрок не найден в данных roomState');
        }
      }

      // Обновляем состояние игры
      setGameState(data);
    });

    // Обработка gameStatusUpdate - обновляем статус игры
    socket.on('gameStatusUpdate', (data) => {
      console.log('GameContext: Получено обновление статуса игры:', data);
      if (data.roomId === currentRoom) {
        setGameStatus(data.status);
      }
    });

    // Обработка battleStart - начинаем бой
    socket.on('battleStart', (data) => {
      setGameStatus('battle');
      setGameState(data);
    });

    // Сыграна карта
    socket.on('cardPlayed', (data) => {
      console.log('Карта сыграна:', data);

      // Добавляем запись в лог боя
      if (data.battleLog) {
        setBattleLog(prev => [...prev, data.battleLog]);
      }
    });

    // Ход закончен
    socket.on('turnEnded', (data) => {
      console.log('Ход закончен:', data);

      // Обновляем состояние игры
      setGameState(data);
    });

    // Обработка specialEvent - устанавливаем специальное событие
    socket.on('specialEvent', (data) => {
      setCurrentEvent(data);
    });

    // Обработка gameEnded - завершаем игру
    socket.on('gameEnded', (data) => {
      setGameStatus('ended');
      setGameState(data);
    });

    // Обработка playerDisconnected - отключаем игрока
    socket.on('playerDisconnected', (data) => {
      setError(data.message);
      setGameStatus('ended');
    });

    // Обработка roomChecked - проверяем комнату
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

    // Функция очистки при размонтировании
    return () => {
      console.log('GameContext: Отключаем слушатели сокета при размонтировании');

      // Отключаем все слушатели
      socket.off();
    };
  }, [socket, currentUser, currentRoom, joinRoom, resetGame]);

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
      }, 3000);

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
    console.log('selectCardsForBattle вызван с картами:', cardIds);

    // Проверка соединения
    if (!socket || !socket.connected) {
      console.error('selectCardsForBattle: Нет соединения с сервером!');
      setError('Нет соединения с сервером. Пожалуйста, обновите страницу.');
      return false;
    }

    // Проверка данных
    if (!currentUser || !currentUser.id) {
      console.error('selectCardsForBattle: Пользователь не аутентифицирован');
      setError('Необходимо войти в систему для выбора карт.');
      return false;
    }

    if (!currentRoom) {
      console.error('selectCardsForBattle: Комната не выбрана');
      setError('Необходимо выбрать комнату для игры.');
      return false;
    }

    // Проверяем, что cardIds - это массив строк
    if (!Array.isArray(cardIds) || cardIds.some(id => typeof id !== 'string')) {
      console.error('selectCardsForBattle: Некорректный формат ID карт', cardIds);
      setError('Некорректный формат выбранных карт.');
      return false;
    }

    // Обновляем информацию о готовности игрока
    const updatePlayerReady = (playerId, isReady) => {
      console.log(`updatePlayerReady: Игрок ${playerId} готов=${isReady}`);
      if (currentRoom && currentRoom.players) {
        const updatedPlayers = currentRoom.players.map(player => {
          if (player.userId === playerId) {
            return { ...player, isReady };
          }
          return player;
        });

        // Обновляем состояние комнаты
        setCurrentRoom(prevRoom => {
          if (!prevRoom) return null;
          return { ...prevRoom, players: updatedPlayers };
        });

        // Проверяем, является ли текущий игрок тем, чей статус изменился
        if (playerId === currentUser.id) {
          console.log(`updatePlayerReady: Обновляем статус готовности текущего игрока ${playerId} на ${isReady}`);
          // Отправляем custom event для компонентов, которым нужно знать об изменении готовности
          const event = new CustomEvent('playerReadyStateChanged', {
            detail: { isReady, playerId, timestamp: new Date().toISOString() }
          });
          window.dispatchEvent(event);
        }
      }
    };

    try {
      console.log(`selectCardsForBattle: Отправляем выбранные карты на сервер. Комната: ${currentRoom.id}, Игрок: ${currentUser.id}`);

      // Проверяем текущее состояние готовности игрока
      const currentPlayer = currentRoom.players.find(p => p.userId === currentUser.id);
      if (currentPlayer && currentPlayer.isReady) {
        console.log('selectCardsForBattle: Игрок уже отмечен как готовый. Сбрасываем состояние перед новым выбором.');
        // Сбрасываем флаг готовности локально, чтобы отразить новую попытку выбора
        updatePlayerReady(currentUser.id, false);
      }

      // Подготавливаем данные для отправки
      const eventData = {
        roomId: currentRoom.id,
        userId: currentUser.id,
        cards: cardIds,
        timestamp: new Date().toISOString()
      };

      console.log('selectCardsForBattle: Данные для отправки:', eventData);

      // Устанавливаем флаги для отслеживания состояния
      let cardSelectionConfirmed = false;
      let playerReadyConfirmed = false;

      // Обработчик подтверждения выбора карт
      const handleCardsSelected = (data) => {
        console.log('Получено событие cardsSelected:', data);
        if (data && data.success) {
          console.log('Сервер подтвердил выбор карт!');
          cardSelectionConfirmed = true;

          // Если от сервера пришел флаг готовности, обновляем состояние
          if (data.isReady) {
            console.log('Сервер отметил игрока как готового в ответе cardsSelected');
            playerReadyConfirmed = true;
            updatePlayerReady(currentUser.id, true);
          }
        } else {
          console.error('Ошибка подтверждения выбора карт:', data?.message || 'Неизвестная ошибка');
          setError(data?.message || 'Сервер не подтвердил выбор карт. Попробуйте еще раз.');
        }
      };

      // Обработчик события готовности игрока
      const handlePlayerReady = (data) => {
        console.log('Получено событие playerReady:', data);
        if (data && data.userId === currentUser.id) {
          console.log('Сервер подтвердил готовность игрока!');
          playerReadyConfirmed = true;
          updatePlayerReady(currentUser.id, true);
        }
      };

      // Обработчик обновления состояния игрока
      const handleUpdatePlayerStatus = (data) => {
        console.log('Получено событие updatePlayerStatus:', data);
        if (data && data.userId === currentUser.id) {
          console.log(`Обновляем статус игрока: ${data.userId}, готов=${data.isReady}`);
          playerReadyConfirmed = data.isReady;
          updatePlayerReady(data.userId, data.isReady);
        }
      };

      // Устанавливаем обработчики событий
      socket.once('cardsSelected', handleCardsSelected);
      socket.once('playerReady', handlePlayerReady);
      socket.on('updatePlayerStatus', handleUpdatePlayerStatus);

      // Отправляем событие выбора карт
      socket.emit('selectCards', eventData);

      // Устанавливаем таймаут для проверки результата
      setTimeout(() => {
        // Удаляем обработчики
        socket.off('cardsSelected', handleCardsSelected);
        socket.off('playerReady', handlePlayerReady);
        socket.off('updatePlayerStatus', handleUpdatePlayerStatus);

        console.log('Проверка результата выбора карт после таймаута');
        console.log('Карты подтверждены:', cardSelectionConfirmed);
        console.log('Готовность подтверждена:', playerReadyConfirmed);

        if (!cardSelectionConfirmed) {
          console.error('Сервер не подтвердил выбор карт в течение таймаута');
          setError('Сервер не подтвердил выбор карт. Возможно, проблема с соединением.');
        }

        // Если карты подтверждены, но статус готовности не изменился
        if (cardSelectionConfirmed && !playerReadyConfirmed) {
          console.log('Карты подтверждены, но игрок не отмечен как готовый. Проверяем состояние комнаты.');

          // Запрашиваем актуальное состояние комнаты
          socket.emit('requestRoomState', { roomId: currentRoom.id });

          // Проверяем состояние через 1 секунду после запроса
          setTimeout(() => {
            const currentPlayer = currentRoom.players.find(p => p.userId === currentUser.id);
            if (currentPlayer && currentPlayer.isReady) {
              console.log('Игрок уже отмечен как готовый в текущем состоянии комнаты');
              updatePlayerReady(currentUser.id, true);
            } else {
              console.error('Игрок все еще не отмечен как готовый после запроса состояния комнаты');
              setError('Сервер получил карты, но не подтвердил выбор. Ожидание...');

              // Делаем еще одну попытку запросить состояние через 3 секунды
              setTimeout(() => {
                socket.emit('requestRoomState', { roomId: currentRoom.id });

                // И финальная проверка еще через 1 секунду
                setTimeout(() => {
                  const finalCheck = currentRoom.players.find(p => p.userId === currentUser.id);
                  if (finalCheck && finalCheck.isReady) {
                    console.log('Игрок отмечен как готовый после финальной проверки');
                    updatePlayerReady(currentUser.id, true);
                  } else {
                    console.error('Игрок все еще не отмечен как готовый после всех проверок');
                    // Устанавливаем флаг принудительно, если сервер не ответил
                    console.log('Принудительно отмечаем игрока как готового...');
                    updatePlayerReady(currentUser.id, true);
                  }
                }, 1000);
              }, 3000);
            }
          }, 1000);
        }
      }, 10000); // Увеличенный таймаут для более надежного ожидания

      return true;
    } catch (error) {
      console.error('selectCardsForBattle: Ошибка при отправке выбранных карт:', error);
      setError(`Ошибка при отправке выбранных карт: ${error.message}`);
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

  // Загружаем сохраненное значение playerReady из sessionStorage при монтировании
  useEffect(() => {
    try {
      const savedPlayerReady = sessionStorage.getItem('playerReady');
      if (savedPlayerReady === 'true') {
        const timestamp = sessionStorage.getItem('playerReadyTimestamp');
        const source = sessionStorage.getItem('playerReadySource');
        console.log(`GameContext: Загружен сохраненный статус playerReady=true из sessionStorage, timestamp=${timestamp}, source=${source}`);
        setPlayerReady(true);
      }
    } catch (e) {
      console.error('GameContext: Ошибка при чтении из sessionStorage:', e);
    }
  }, []);

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
          console.log(`Загружено ${cards?.length || 0} карт при изменении статуса`);
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

  // Функция диагностики состояния карт и загрузки
  const diagnoseCardsState = useCallback(() => {
    console.group('🔍 ДИАГНОСТИКА СОСТОЯНИЯ КАРТ');
    console.log('Текущее время:', new Date().toLocaleTimeString());

    // Информация о коллекции карт
    console.log(`Карты в коллекции: ${cardsCollection.length} шт.`);
    if (cardsCollection.length > 0) {
      // Распределение по типам
      const cardTypes = {};
      cardsCollection.forEach(card => {
        cardTypes[card.type] = (cardTypes[card.type] || 0) + 1;
      });
      console.log('Распределение по типам:', cardTypes);

      // Проверка целостности первых карт
      const sampleCards = cardsCollection.slice(0, 3);
      console.log('Образцы карт:', sampleCards);
    }

    // Состояние загрузки
    console.log('Статус загрузки:', {
      loading,
      cardsRequested,
      globalLoadingFlag: window._cardsLoadingInProgress || false,
      promiseExists: !!window._cardsLoadingPromise
    });

    // Статус пользователя и комнаты
    console.log('Контекст игры:', {
      room: currentRoom || 'нет',
      gameStatus: gameStatus || 'нет',
      socketConnected: socket?.connected ? 'да' : 'нет',
      userId: currentUser?.id || 'нет'
    });

    // Счетчики инициализации
    if (!window._cardsLoadStats) {
      window._cardsLoadStats = {
        totalCalls: 0,
        successfulLoads: 0,
        failedLoads: 0,
        lastCall: null
      };
    }
    console.log('Статистика вызовов loadCards:', window._cardsLoadStats);

    console.groupEnd();

    // Возвращаем краткую сводку
    return {
      cardsCount: cardsCollection.length,
      loading,
      loadStats: window._cardsLoadStats
    };
  }, [cardsCollection, loading, cardsRequested, currentRoom, gameStatus, socket, currentUser]);

  // Увеличиваем интервал проверки состояния комнаты
  useEffect(() => {
    if (currentRoom && socket && socket.connected) {
      console.log('GameContext: Запускаем интервал проверки состояния комнаты:', currentRoom);

      const intervalId = setInterval(() => {
        if (socket && socket.connected) {
          socket.emit('getRoomState', { roomId: currentRoom });
        }
      }, 3000); // Уменьшаем интервал до 3 секунд для более частой проверки

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [currentRoom, socket]);

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
    diagnoseCardsState,
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