import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import CardSelector from '../components/Cards/CardSelector';
import BattleArena from '../components/Battle/BattleArena';

const GameRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { 
    joinRoom, 
    currentRoom, 
    gameStatus, 
    playerReady, 
    gameState, 
    isConnected,
    error,
    setError,
    resetGame,
    loadCards,
    cardsCollection,
    diagnoseSockets,
    socket,
    setGameStatus,
    isLoading,
    selectCardsForBattle,
    startBattle,
    throttledGetRoomState
  } = useGame();
  const [copied, setCopied] = useState(false);
  const [playersCount, setPlayersCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const joinAttempted = useRef(false);
  const [prevPlayersCount, setPrevPlayersCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  
  // Добавляем локальную функцию leaveRoom
  const leaveRoom = () => {
    console.log('Покидаем комнату и сбрасываем состояние');
    if (socket && socket.connected && currentRoom) {
      // Отправляем событие на сервер о выходе из комнаты
      socket.emit('leaveRoom', { roomId: currentRoom, userId: currentUser?.id });
      // Больше не вызываем resetGame() напрямую, это приводит к цикличным обновлениям
      // Теперь мы только отправляем событие серверу, а состояние reset будет происходить через эффекты
    }
  };

  // Новая функция для принудительной загрузки карт
  const forceLoadCards = async () => {
    console.log('GameRoom: Принудительная загрузка карт');
    try {
      const cards = await loadCards();
      console.log(`GameRoom: Загружено ${cards?.length || 0} карт`);
      return cards;
    } catch (err) {
      console.error('GameRoom: Ошибка загрузки карт:', err);
      return null;
    }
  };

  useEffect(() => {
    // Принудительно загружаем карты при монтировании компонента
    if (!cardsCollection || cardsCollection.length === 0) {
      console.log('🔴 GameRoom: Карты не загружены, инициируем загрузку');
      forceLoadCards();
      
      // Для надежности, добавляем еще попытки с задержкой
      setTimeout(() => {
        if (!cardsCollection || cardsCollection.length === 0) {
          console.log('🔴 GameRoom: Повторная загрузка карт через 1 секунду');
          forceLoadCards();
        }
      }, 1000);
      
      setTimeout(() => {
        if (!cardsCollection || cardsCollection.length === 0) {
          console.log('🔴 GameRoom: Последняя попытка загрузки карт через 3 секунды');
          forceLoadCards();
        }
      }, 3000);
    } else {
      console.log(`✅ GameRoom: Карты уже загружены (${cardsCollection.length} штук)`);
    }
  }, [cardsCollection]);

  // forceRefreshState перемещена вверх для предотвращения ошибки
  const forceRefreshState = useCallback(() => {
    if (roomId && currentUser) {
      console.log('Принудительное обновление состояния комнаты');
      throttledGetRoomState(roomId);
    }
  }, [roomId, currentUser, throttledGetRoomState]);

  // Добавление лога на страницу
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [...prevLogs, { timestamp, message, type }]);
  };

  // Присоединение к комнате при загрузке страницы
  useEffect(() => {
    if (!roomId) {
      setError('ID комнаты не указан');
      navigate('/');
      return;
    }

    if (!currentUser) {
      setError('Необходимо авторизоваться');
      navigate('/login');
      return;
    }

    console.log(`Подключение к комнате: ${roomId}`);
    addLog(`Подключение к комнате с ID: ${roomId}`);
    
    // Используем joinRoom вместо connectToRoom
    joinRoom(roomId);
    
    // Запрос состояния комнаты через небольшую задержку для гарантии обработки подключения
    const initialUpdateTimer = setTimeout(() => {
      console.log(`Запрос состояния комнаты: ${roomId}`);
      throttledGetRoomState(roomId);
    }, 1000); // Увеличиваем задержку до 1 секунды
  
    // Установка обработчика для закрытия соединения при уходе со страницы
    return () => {
      console.log('Пользователь покидает страницу комнаты');
      clearTimeout(initialUpdateTimer);
      leaveRoom();
    };
  }, [roomId, currentUser, joinRoom, navigate, setError, socket, currentRoom]);
  
  // Функция для ручного обновления состояния комнаты
  const refreshRoomState = useCallback(() => {
    if (isConnected && currentRoom) {
      console.log('Ручное обновление состояния комнаты:', currentRoom);
      // Используем socket из контекста через метод diagnoseSocket
      const socketStatus = diagnoseSockets();
      
      if (socketStatus.connected) {
        console.log('Отправка запроса обновления состояния комнаты');
        // Эмитим событие для получения актуального состояния
        throttledGetRoomState(currentRoom);
      } else {
        console.log('Невозможно обновить состояние: сокет не подключен');
        alert('Соединение с сервером потеряно. Попробуйте обновить страницу.');
      }
    }
  }, [isConnected, currentRoom, diagnoseSockets, socket, throttledGetRoomState]);

  // Присоединение к комнате при монтировании - используем useRef для отслеживания уже выполненного действия
  useEffect(() => {
    if (isConnected && roomId && !joinAttempted.current) {
      console.log('Первая попытка присоединения к комнате:', roomId);
      joinAttempted.current = true; // Отмечаем, что попытка уже была
      joinRoom(roomId);
      
      // Автоматическое обновление информации о комнате - используем один таймер
      const autoUpdateTimer = setTimeout(() => {
        console.log('Отложенное обновление состояния комнаты');
        forceRefreshState();
      }, 2000); // Оптимальная задержка в 2 секунды
      
      return () => {
        // Очищаем таймер при размонтировании компонента
        clearTimeout(autoUpdateTimer);
      };
    }
  }, [isConnected, roomId, joinRoom, forceRefreshState]);
  
  // Специальный эффект для обеспечения синхронизации при прямом переходе по URL
  useEffect(() => {
    // Если мы уже подключены и roomId не соответствует текущей комнате
    if (isConnected && roomId && currentRoom !== roomId) {
      console.log('Обнаружено несоответствие ID комнаты в URL и текущей комнаты');
      joinRoom(roomId);
    }
    
    // Если мы подключены к комнате, но интерфейс не отображает игроков
    if (isConnected && currentRoom && gameState && gameState.players && 
        gameState.players.length > playersCount) {
      console.log('Интерфейс не отображает всех игроков, выполняем принудительное обновление');
      setPlayersCount(gameState.players.length);
      
      // Если статус waiting, но два игрока - меняем статус
      if (gameStatus === 'waiting' && gameState.players.length === 2) {
        console.log('Принудительное обновление статуса на selecting_cards');
        setGameStatus('selecting_cards');
      } 
    }
  }, [isConnected, roomId, currentRoom, gameState, playersCount, gameStatus, setGameStatus, joinRoom]);
  
  // Добавляем автоматическое обновление состояния каждые 30 секунд,
  // чтобы гарантировать актуальность данных, особенно для второго игрока
  const autoUpdateIntervalRef = useRef(null);
  
  useEffect(() => {
    // Очищаем предыдущий интервал, если он существует
    if (autoUpdateIntervalRef.current) {
      clearInterval(autoUpdateIntervalRef.current);
      autoUpdateIntervalRef.current = null;
    }
    
    if (isConnected && currentRoom && socket) {
      console.log('Настройка периодического обновления состояния комнаты');
      
      // Устанавливаем новый интервал
      autoUpdateIntervalRef.current = setInterval(() => {
        console.log('Автоматическое обновление состояния комнаты');
        throttledGetRoomState(currentRoom); // Используем функцию с throttle из контекста
      }, 30000); // Каждые 30 секунд
    }
    
    // Очистка при размонтировании
    return () => {
      if (autoUpdateIntervalRef.current) {
        console.log('Очистка интервала автоматического обновления');
        clearInterval(autoUpdateIntervalRef.current);
        autoUpdateIntervalRef.current = null;
      }
    };
  }, [isConnected, currentRoom, socket, throttledGetRoomState]);

  // Обновление интерфейса при изменении gameState
  useEffect(() => {
    if (!gameState) {
      console.log('GameRoom: gameState отсутствует');
      return;
    }
    
    console.log('GameRoom: Получено обновление gameState:', gameState);
    
    // Логируем ключевые свойства объекта gameState
    console.log('GameRoom: Ключевые данные gameState:',
      '\n - status:', gameState.status,
      '\n - players:', gameState.players ? gameState.players.length : 0,
      '\n - playersCount:', gameState.playersCount,
      '\n - currentRoom:', currentRoom,
      '\n - gameStatus:', gameStatus
    );
    
    // Обновляем количество игроков, если оно изменилось
    if (gameState.players && gameState.players.length !== playersCount) {
      console.log('GameRoom: Обновление количества игроков:', gameState.players.length);
      setPlayersCount(gameState.players.length);
    }
    
    // Автоматическое выполнение принудительного обновления если необходимо
    if (gameState.players && gameState.players.length > playersCount) {
      console.log('GameRoom: Автоматическое обновление интерфейса - обнаружено расхождение в количестве игроков');
      setPlayersCount(gameState.players.length);
      forceRefreshState();
    }
    
    // Автоматическая коррекция статуса игры при расхождении
    if (gameState.status && gameState.status !== gameStatus) {
      console.log('GameRoom: Коррекция статуса игры из состояния:', gameState.status, 'текущий:', gameStatus);
      setGameStatus(gameState.status);
    }
  }, [gameState, gameStatus, playersCount, setGameStatus, forceRefreshState, currentRoom]);

  // Добавляем useEffect для отслеживания статуса игры
  useEffect(() => {
    console.log('GameRoom: Обновление статуса игры:', gameStatus);
    
    // Проверяем, загружены ли карты, когда статус игры изменился на выбор карт
    if ((gameStatus === 'selecting_cards' || gameStatus === 'cards_selection') && cardsCollection.length === 0) {
      console.log('GameRoom: Принудительная загрузка карт при переключении на статус выбора карт');
      loadCards();
    }
  }, [gameStatus, cardsCollection.length, loadCards]);

  // Отдельный эффект для обновления количества игроков
  useEffect(() => {
    if (gameState && gameState.players) {
      const newCount = gameState.players.length;
      if (playersCount !== newCount) {
        setPlayersCount(newCount);
        console.log('GameRoom: Обновление количества игроков:', newCount);
      }
    }
  }, [gameState?.players?.length, playersCount]);
  
  // Отдельный эффект для проверки необходимости загрузки карт
  useEffect(() => {
    if (gameStatus === 'battle' && cardsCollection.length === 0 && !loading) {
      loadCards();
    }
  }, [gameStatus, cardsCollection.length, loading, loadCards]);

  // Копирование ID комнаты в буфер обмена
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Обработчик выхода из игры
  const handleLeaveGame = () => {
    resetGame();
    navigate('/battle');
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-2xl mb-4">Подключение к серверу...</div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Если есть ошибка
  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 p-6 rounded-lg mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-bold mb-4">Ошибка</h2>
        <p className="mb-4">{error}</p>
        <button 
          onClick={handleLeaveGame}
          className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded text-white"
        >
          Вернуться в лобби
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      {/* Заголовок комнаты и статус */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <div className="flex flex-wrap justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Комната #{roomId}</h1>
          
          <div className="flex space-x-4">
            <button 
              onClick={refreshRoomState}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white flex items-center"
              title="Обновить состояние комнаты"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Обновить
            </button>
            
            <button 
              onClick={copyRoomId}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white flex items-center"
            >
              {copied ? 'Скопировано!' : 'Копировать ID'}
              <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </button>
            
            <button 
              onClick={handleLeaveGame}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white"
            >
              Покинуть игру
            </button>
          </div>
        </div>
        
        {/* Информация о состоянии игры */}
        <div className="flex flex-wrap justify-between items-center">
          <div className="mb-2 md:mb-0">
            <span className="font-semibold mr-2">Статус:</span>
            <StatusBadge status={gameStatus} />
          </div>
          
          {gameState && (
            <div className="flex flex-wrap space-x-4">
              <div>
                <span className="font-semibold mr-2">Игроков:</span>
                <span>{playersCount}/2</span>
              </div>
              
              {gameStatus === 'battle' && (
                <div>
                  <span className="font-semibold mr-2">Раунд:</span>
                  <span>{gameState.currentTurn.round}/3</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Тело игровой комнаты в зависимости от статуса */}
      {gameStatus === 'waiting' && (
        <WaitingRoom roomId={roomId} />
      )}
      
      {gameStatus === 'selecting_cards' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Выбор карт для баттла</h2>
          
          {/* Информация о готовности игроков */}
          {gameState && gameState.players && (
            <div className="bg-gray-800 p-4 rounded-lg mb-4">
              <h3 className="text-xl font-bold mb-2">Статус игроков:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameState.players.map((player, index) => (
                  <div key={player.userId} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="font-bold mr-2">Игрок {index + 1}</span>
                      {player.userId === currentUser.id && (
                        <span className="text-green-400 text-sm">(Вы)</span>
                      )}
                    </div>
                    
                    <div>
                      {player.isReady ? (
                        <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm">Готов</span>
                      ) : (
                        <span className="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm">Выбирает карты</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <CardSelector />
        </div>
      )}
      
      {gameStatus === 'battle' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Баттл</h2>
          <BattleArena />
        </div>
      )}
      
      {gameStatus === 'ended' && gameState && (
        <GameResults 
          results={gameState} 
          userId={currentUser.id} 
          onPlayAgain={handleLeaveGame} 
        />
      )}
    </div>
  );
};

// Компонент для отображения статуса
const StatusBadge = ({ status }) => {
  const getStatusInfo = () => {
    switch(status) {
      case 'waiting':
        return { label: 'Ожидание игроков', bgColor: 'bg-yellow-600' };
      case 'selecting_cards':
      case 'cards_selection': // Добавляем поддержку обоих вариантов названия
        return { label: 'Выбор карт', bgColor: 'bg-blue-600' };
      case 'battle':
        return { label: 'Баттл', bgColor: 'bg-red-600' };
      case 'ended':
      case 'finished': // Добавляем поддержку обоих вариантов названия
        return { label: 'Завершена', bgColor: 'bg-green-600' };
      default:
        console.log(`Неизвестный статус: "${status}"`);
        return { label: status || 'Неизвестно', bgColor: 'bg-gray-600' };
    }
  };
  
  const statusInfo = getStatusInfo();
  
  return (
    <span className={`${statusInfo.bgColor} text-white px-3 py-1 rounded-full`}>
      {statusInfo.label}
    </span>
  );
};

// Компонент зала ожидания
const WaitingRoom = ({ roomId }) => {
  return (
    <div className="bg-gray-800 p-8 rounded-lg text-center">
      <h2 className="text-2xl font-bold mb-6">Ожидание оппонента</h2>
      
      <div className="animate-pulse mb-6">
        <div className="inline-block w-16 h-16 bg-yellow-600 rounded-full"></div>
      </div>
      
      <p className="text-lg mb-8">
        Пригласите друга, отправив ему ID комнаты: 
        <span className="font-mono bg-gray-700 px-2 py-1 rounded ml-2">{roomId}</span>
      </p>
      
      <div className="bg-gray-700 p-4 rounded-lg max-w-lg mx-auto">
        <p className="text-sm text-gray-300">
          Оппонент должен нажать кнопку "Присоединиться к игре" на странице баттла
          и ввести ID комнаты для начала игры.
        </p>
      </div>
    </div>
  );
};

// Компонент результатов игры
const GameResults = ({ results, userId, onPlayAgain }) => {
  const isWinner = results.winner && results.winner.userId === userId;
  
  return (
    <div className={`${isWinner ? 'bg-green-900' : 'bg-red-900'} bg-opacity-40 p-8 rounded-lg text-center`}>
      <h2 className="text-3xl font-bold mb-6">
        {isWinner ? '🏆 Вы победили! 🏆' : '😞 Вы проиграли 😞'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-xl font-bold mb-2">Ваш счёт</h3>
          <p className="text-3xl font-bold">
            {isWinner ? results.winner.score : results.loser.score}
          </p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-xl font-bold mb-2">Счёт противника</h3>
          <p className="text-3xl font-bold">
            {isWinner ? results.loser.score : results.winner.score}
          </p>
        </div>
      </div>
      
      <button 
        onClick={onPlayAgain}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white text-lg font-bold"
      >
        Вернуться в лобби
      </button>
    </div>
  );
};

export default GameRoom; 