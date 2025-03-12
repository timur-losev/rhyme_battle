import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Инициализация сокета при монтировании компонента
  useEffect(() => {
    if (currentUser && !socket) {
      console.log('Инициализация сокета для пользователя:', currentUser.id);
      
      try {
        // Создаем новый сокет с базовыми параметрами - так же, как в работающей тестовой странице
        console.log('Создание сокета с URL:', 'http://localhost:5101');
        
        const newSocket = io('http://localhost:5101', {
          transports: ['websocket', 'polling'],
          reconnection: true,
          autoConnect: false // Важно: отключаем автоподключение
        });
        
        console.log('Socket.io создан, подключаем...');
        
        // Устанавливаем обработчики до подключения
        newSocket.on('connect', () => {
          console.log('Socket.io ПОДКЛЮЧЕН! SocketID:', newSocket.id);
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
          newSocket.disconnect();
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

  // Настройка слушателей сокета
  useEffect(() => {
    if (!socket) return;
    
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
      
      // Загружаем карты только если они еще не загружены и не запрашивались
      if (cardsCollection.length === 0 && !loading && !cardsRequested) {
        console.log('Запрос загрузки карт при присоединении к комнате');
        setCardsRequested(true); // Устанавливаем флаг, что запрос отправлен
        loadCards();
      } else {
        console.log('Карты уже загружены или загружаются, пропускаем запрос при joinedRoom');
      }
      
      // Запрашиваем состояние комнаты несколько раз с разной задержкой для надежности
      if (data.roomId) {
        console.log('Запрашиваем актуальное состояние комнаты после присоединения');
        [0, 500, 1500].forEach(delay => {
          setTimeout(() => {
            if (socket && socket.connected) {
              console.log(`Запрос состояния комнаты с задержкой ${delay}мс после присоединения`);
              socket.emit('getRoomState', { roomId: data.roomId });
            }
          }, delay);
        });
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
      
      if (isNewState) {
        console.log('Получено существенное обновление состояния комнаты:', data);
      }
      
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
      
      // Если статус изменился, сразу обновляем его
      if (data.status && data.status !== gameStatus) {
        console.log(`Обновляем статус игры из roomState: ${data.status} (был: ${gameStatus})`);
        setGameStatus(data.status);
        
        // Если это переход в режим выбора карт, и карты не загружены - загружаем
        if ((data.status === 'selecting_cards' || data.status === 'cards_selection') && 
            cardsCollection.length === 0 && !loading && !cardsRequested) {
          console.log('Принудительная загрузка карт при переходе в режим выбора карт');
          setCardsRequested(true);
          loadCards();
        }
      }
      
      // Обновляем состояние игры
      setGameState(data);
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
        console.log('Запрашиваем обновление состояния при присоединении игрока');
        
        // Используем несколько попыток запроса состояния с разными интервалами
        // для гарантированного обновления интерфейса
        [100, 500, 1500].forEach(delay => {
          setTimeout(() => {
            if (socket && socket.connected) {
              console.log(`Запрос состояния комнаты с задержкой ${delay}мс`);
              socket.emit('getRoomState', { roomId: currentRoom });
            }
          }, delay);
        });
      }
      
      // Обновляем статус игры, только если находимся в статусе ожидания
      if (gameStatus === 'waiting') {
        console.log('Обновляем статус на selecting_cards при присоединении игрока');
        setGameStatus('selecting_cards');
      }
      
      // Автоматическое обновление игроков в интерфейсе
      setGameState(prevState => {
        // Если у нас нет состояния или это не обновление существующего состояния
        if (!prevState || !prevState.players) {
          console.log('Нет предыдущего состояния, создаем новое с обоими игроками');
          return {
            players: [
              { userId: currentUser.id },
              { userId: data.userId }
            ],
            status: 'selecting_cards',
            playersCount: 2,
            timestamp: data.timestamp
          };
        }
        
        // Если второй игрок уже добавлен, не меняем состояние
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
        return {
          ...prevState,
          players: [...prevState.players, { userId: data.userId, isReady: false }],
          playersCount: prevState.players.length + 1,
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
        socket.emit('getRoomState', { roomId: currentRoom });
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
  }, [socket, navigate, currentUser?.id, currentRoom, gameStatus]);

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

  // Функция для генерации тестовых карт - ВЫНЕСЕНА ЗА ПРЕДЕЛЫ loadCards для глобального доступа
  const generateTestCards = () => {
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
        couplet: 'Твой флоу слабый, словно чай без заварки, а мой щит прочный от любой атаки!',
        description: 'Защита от следующей атаки противника',
        effects: [{ type: 'block', value: 4, description: 'Блокирует до 4 единиц урона' }],
        image: '/images/cards/default.png',
        rarity: 'common'
      },
      {
        _id: 'test-card-3',
        name: 'ТЕСТОВАЯ - Комбо-рифма',
        type: 'combo',
        power: 3,
        couplet: 'Сначала слева, потом справа, комбо-рифма - это слава!',
        description: 'Атака с возможностью сыграть ещё одну карту',
        effects: [
          { type: 'damage', value: 3, description: 'Наносит 3 урона' },
          { type: 'chain', value: 1, description: 'Позволяет сыграть ещё одну карту' }
        ],
        image: '/images/cards/default.png',
        rarity: 'uncommon'
      },
      {
        _id: 'test-card-4',
        name: 'ТЕСТОВАЯ - Тройной удар',
        type: 'attack',
        power: 7,
        couplet: 'Раз, два, три - сейчас ты упадешь, от моих барабанных рифм не уйдешь!',
        description: 'Мощная атака с высоким уроном',
        effects: [{ type: 'damage', value: 7, description: 'Наносит 7 урона противнику' }],
        image: '/images/cards/default.png',
        rarity: 'rare'
      },
      {
        _id: 'test-card-5',
        name: 'ТЕСТОВАЯ - Отмена комбо',
        type: 'special',
        power: 2,
        couplet: 'Твое комбо разбивается как стекло, мое мастерство его превзошло!',
        description: 'Отменяет последний комбо-эффект противника',
        effects: [{ type: 'cancel_combo', value: 0, description: 'Отменяет последний комбо-эффект противника' }],
        image: '/images/cards/default.png',
        rarity: 'uncommon'
      },
      {
        _id: 'test-card-6',
        name: 'ТЕСТОВАЯ - Двойной урон',
        type: 'special',
        power: 2,
        couplet: 'Удваиваю урон, удваиваю темп, после моего хода тебе не будет легко!',
        description: 'Удваивает урон от следующей атаки',
        effects: [{ type: 'double_points', value: 2, description: 'Удваивает очки от следующей атаки' }],
        image: '/images/cards/default.png',
        rarity: 'epic'
      },
      {
        _id: 'test-card-7',
        name: 'ТЕСТОВАЯ - Стальной барьер',
        type: 'defense',
        power: 6,
        couplet: 'Я строю стены из металлических слов, твоя атака для меня - лишь шум ветров!',
        description: 'Сильная защита от атак противника',
        effects: [{ type: 'block', value: 6, description: 'Блокирует до 6 единиц урона' }],
        image: '/images/cards/default.png',
        rarity: 'rare'
      },
      {
        _id: 'test-card-8',
        name: 'ТЕСТОВАЯ - Легендарный флоу',
        type: 'combo',
        power: 9,
        couplet: 'Мой флоу легендарный, как древний манускрипт, от моих слов даже сильнейший рэпер притих!',
        description: 'Мощная комбо-атака с высоким уроном и дополнительным эффектом',
        effects: [
          { type: 'damage', value: 9, description: 'Наносит 9 урона' },
          { type: 'combo', value: 3, description: 'Дает 3 дополнительных очка при успешной комбинации' }
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
    
    console.log(`✅ Успешно сгенерировано ${testCards.length} тестовых карт:`);
    testCards.forEach((card, index) => {
      console.log(`${index + 1}. ${card.name} (${card.type}, сила: ${card.power})`);
    });
    
    // Выводим предупреждение, если массив пустой (не должно случиться)
    if (testCards.length === 0) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА! Массив тестовых карт пуст!');
    }
    
    return testCards;
  };

  // Загрузка коллекции карт - полностью переписан
  const loadCards = async () => {
    console.log('💥 Запрос loadCards в GameContext был вызван');
    
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
  };
  
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

  // Присоединение к комнате
  const joinRoom = (roomId) => {
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
    
    // Принудительная загрузка карт при присоединении к комнате
    console.log('Принудительная загрузка карт при присоединении к комнате');
    // Даже если карты уже загружены или загружаются, повторно запрашиваем для надежности
    loadCards();
    
    // Проверяем, не в этой ли комнате мы уже находимся
    if (currentRoom === roomId && !roomChanged) {
      console.log('Вы уже находитесь в комнате:', roomId);
      
      // Запрашиваем актуальное состояние комнаты для синхронизации
      if (socket && socket.connected) {
        console.log('Отправляем запрос на получение актуального состояния комнаты');
        socket.emit('getRoomState', { roomId });
      }
      return;
    }
    
    console.log('Отправка запроса на присоединение к комнате:', roomId, 'для пользователя:', currentUser.id);
    // Устанавливаем явный путь в истории браузера, чтобы URL соответствовал комнате
    if (roomChanged && navigate) {
      navigate(`/game/${roomId}`);
    }
    
    // Эмитим событие присоединения к комнате
    socket.emit('joinRoom', { roomId, userId: currentUser.id });
    
    // Инициируем несколько запросов состояния комнаты с задержкой
    [500, 1500, 3000].forEach(delay => {
      setTimeout(() => {
        if (socket && socket.connected) {
          console.log(`Дополнительный запрос состояния комнаты с задержкой ${delay}мс`);
          socket.emit('getRoomState', { roomId });
        }
      }, delay);
    });
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
          socket.emit('getRoomState', { roomId: currentRoom });
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
    setGameStatus
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
} 