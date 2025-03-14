import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../../contexts/GameContext';
import Card from './Card';

// КОНСТАНТЫ ВЫНЕСЕНЫ ВВЕРХ ДЛЯ УДОБСТВА РЕДАКТИРОВАНИЯ
const MAX_SELECTABLE_CARDS = 5;

// Список тестовых карт и статусов для проверки работы без API
const TEST_STATUSES = [
  'waiting',
  'selecting_cards',
  'cards_selection',
  'battle',
  'ended',
  'idle'
];

// Отдельный компонент CardsDebugTools для экспорта
function CardsDebugToolsComponent({ toggleVisible = true }) {
  const { loadCards, cardsCollection, loading, diagnoseCardsState } = useGame();
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugResult, setDebugResult] = useState(null);

  // Запускает диагностику состояния карт
  const runDiagnostics = useCallback(() => {
    console.log('Запуск диагностики карт...');
    try {
      // Если функция диагностики существует, запускаем ее
      if (typeof diagnoseCardsState === 'function') {
        const result = diagnoseCardsState();
        setDebugResult(result);
      } else {
        // Иначе формируем базовый результат
        setDebugResult({
          cardsCount: cardsCollection.length,
          loading,
          loadStats: { totalCalls: 0, successfulLoads: 0, failedLoads: 0 }
        });
        console.log('Функция diagnoseCardsState недоступна, используем базовую диагностику');
      }
    } catch (err) {
      console.error('Ошибка при диагностике карт:', err);
    }
  }, [diagnoseCardsState, cardsCollection.length, loading]);

  // Принудительно перезагружает карты
  const forceLoadCards = useCallback(async () => {
    console.log('Принудительная загрузка карт...');
    try {
      const cards = await loadCards();
      console.log(`Загружено ${cards?.length || 0} карт`);
      runDiagnostics();
    } catch (err) {
      console.error('Ошибка загрузки карт:', err);
    }
  }, [loadCards, runDiagnostics]);

  // Если не нужно отображать кнопку переключения, скрываем компонент
  if (!toggleVisible && !debugVisible) {
    return null;
  }

  return (
    <div className="card-debug-tools">
      {toggleVisible && (
        <button
          onClick={() => setDebugVisible(prev => !prev)}
          className="px-3 py-1 text-xs bg-gray-700 text-white rounded mb-2"
        >
          {debugVisible ? 'Скрыть инструменты отладки' : 'Показать инструменты отладки'}
        </button>
      )}

      {debugVisible && (
        <div className="p-3 bg-gray-800 rounded-lg mb-4 text-sm">
          <h3 className="font-bold mb-2 text-white">Отладка карт</h3>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={runDiagnostics}
              className="px-2 py-1 bg-blue-600 text-white rounded"
              disabled={loading}
            >
              Диагностика карт
            </button>
            <button
              onClick={forceLoadCards}
              className="px-2 py-1 bg-yellow-600 text-white rounded"
              disabled={loading}
            >
              Принуд. загрузка
            </button>
          </div>

          {loading && (
            <div className="text-yellow-400 mb-2">
              Загрузка карт...
            </div>
          )}

          {debugResult && (
            <div className="bg-gray-900 p-2 rounded text-xs font-mono text-green-400 overflow-auto max-h-32">
              <div>Карт: {debugResult.cardsCount}</div>
              <div>Загрузка: {debugResult.loading ? 'да' : 'нет'}</div>
              <div>Всего вызовов: {debugResult.loadStats?.totalCalls || 0}</div>
              <div>Успешно: {debugResult.loadStats?.successfulLoads || 0}</div>
              <div>Ошибок: {debugResult.loadStats?.failedLoads || 0}</div>
            </div>
          )}

          <div className="text-xs text-gray-400 mt-2">
            Проблемы отображения карт могут быть из-за:
            <ul className="list-disc pl-4 mt-1">
              <li>Отсутствия загрузки карт</li>
              <li>Ошибки в фильтрации карт</li>
              <li>Проблем в компоненте Card</li>
              <li>Неправильной структуры данных</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Экспортируем компонент отладки
export const CardsDebugTools = CardsDebugToolsComponent;

const CardSelector = () => {
  // Получаем все необходимые свойства и функции из контекста сразу на верхнем уровне
  const {
    cardsCollection,
    loadCards,
    loading,
    error,
    selectCardsForBattle,
    playerReady,
    gameStatus,
    currentRoom,
    socket,
    debugCardInfo,
    diagnoseCardsState
  } = useGame();

  const [selectedCards, setSelectedCards] = useState([]);
  const [filters, setFilters] = useState({
    type: '',
    search: ''
  });
  const [localState, setLocalState] = useState({
    lastCardLoad: null,
    loadAttempts: 0,
    debugMode: true,
    lastStatusCheck: new Date().toISOString()
  });

  // НАЧАЛО ТЕСТОВОГО БЛОКА - БУДЕТ ВИДНО ЕСЛИ ИЗМЕНЕНИЯ ПРИМЕНИЛИСЬ
  useEffect(() => {
    console.log('⚠️ ТЕСТОВЫЙ КОМПОНЕНТ CARD SELECTOR ЗАГРУЖЕН - ВЕРСИЯ С ОТЛАДКОЙ ⚠️');

    // Проверка текущего состояния при загрузке
    console.table({
      'Статус игры': gameStatus,
      'Количество карт': cardsCollection.length,
      'Карты загружаются': loading,
      'Ошибка загрузки': error || 'нет',
      'Игрок готов': playerReady,
      'Текущая комната': currentRoom || 'нет'
    });

    // Устанавливаем временные отметки для контроля обновлений компонента
    setLocalState(prev => ({
      ...prev,
      lastStatusCheck: new Date().toISOString(),
      componentLoaded: true
    }));

    // Добавляем глобальный обработчик пользовательского события
    const handlePlayerReadyStateChange = (event) => {
      console.log('CardSelector: Получено пользовательское событие playerReadyStateChanged:', event.detail);

      if (event.detail.ready === true) {
        // Обновляем UI, показывая что выбор карт подтвержден
        setLocalState(prev => ({
          ...prev,
          selectionInProgress: false,
          errorDetails: '',
          retryAttempt: 0,
          successTime: new Date().toISOString()
        }));

        console.log('CardSelector: UI обновлен на основе пользовательского события');
      }
    };

    window.addEventListener('playerReadyStateChanged', handlePlayerReadyStateChange);

    // СРАЗУ загружаем карты независимо от состояния
    console.log('⚠️ ПРИНУДИТЕЛЬНАЯ ЗАГРУЗКА КАРТ В CARD SELECTOR ⚠️');
    loadCards().then(cards => {
      console.log(`CardSelector: Загружено ${cards?.length || 0} карт при монтировании`);
    }).catch(err => {
      console.error('CardSelector: Ошибка загрузки карт при монтировании:', err);
    });

    // Удаляем обработчик события при размонтировании
    return () => {
      window.removeEventListener('playerReadyStateChanged', handlePlayerReadyStateChange);
    };
  }, []);
  // КОНЕЦ ТЕСТОВОГО БЛОКА

  // Улучшенная логика загрузки карт при монтировании компонента и изменении статуса
  useEffect(() => {
    console.log('CardSelector: Проверка наличия карт. Статус:', gameStatus, 'Карт:', cardsCollection.length);

    // Принудительно загружаем карты при монтировании компонента независимо от статуса
    if (cardsCollection.length === 0 && !loading && localState.loadAttempts < 3) {
      console.log('CardSelector: Запрос на загрузку карт. Попытка:', localState.loadAttempts + 1);

      // Устанавливаем флаг и время последней попытки
      setLocalState(prev => ({
        ...prev,
        lastCardLoad: new Date().toISOString(),
        loadAttempts: prev.loadAttempts + 1
      }));

      // Вызываем загрузку карт
      loadCards().then(cards => {
        if (cards && cards.length > 0) {
          console.log(`CardSelector: Успешно загружено ${cards.length} карт`);
        } else {
          console.error('CardSelector: Ошибка загрузки карт или получен пустой список');

          // Если попытка была не более 3-х раз, пробуем загрузить снова через 2 секунды
          if (localState.loadAttempts < 3) {
            console.log('CardSelector: Запланирована повторная попытка загрузки карт');
            setTimeout(() => {
              setLocalState(prev => ({
                ...prev,
                loadAttempts: prev.loadAttempts - 1 // Уменьшаем счетчик для возможности новой попытки
              }));
            }, 2000);
          }
        }
      });
    }
  }, [cardsCollection.length, loading, loadCards, gameStatus, localState.loadAttempts]);

  const handleCardClick = (card) => {
    if (playerReady) return; // Если игрок уже готов, не даем менять выбор

    // Если карта уже выбрана - удаляем её из выбранных
    if (selectedCards.includes(card._id)) {
      setSelectedCards(prevSelected => prevSelected.filter(id => id !== card._id));
    }
    // Иначе добавляем, если ещё не выбрано максимальное количество
    else if (selectedCards.length < MAX_SELECTABLE_CARDS) {
      setSelectedCards(prevSelected => [...prevSelected, card._id]);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedCards.length !== MAX_SELECTABLE_CARDS) {
      setLocalState(prev => ({
        ...prev,
        errorDetails: `Необходимо выбрать ${MAX_SELECTABLE_CARDS} карт`
      }));
      return;
    }

    console.log('CardSelector: Нажата кнопка подтверждения выбора карт:', selectedCards);

    // Проверяем глобальный статус готовности
    if (window._playerReadyState === true) {
      console.log('CardSelector: Игрок уже отмечен как готовый в глобальном состоянии');
      setLocalState(prev => ({
        ...prev,
        selectionInProgress: false,
        errorDetails: ''
      }));
      return;
    }

    // Проверяем, подключен ли сокет
    if (!socket || !socket.connected) {
      console.error('CardSelector: Сокет не подключен при попытке подтвердить выбор карт');
      setLocalState(prev => ({
        ...prev,
        errorDetails: 'Нет соединения с сервером. Пожалуйста, обновите страницу и попробуйте снова.'
      }));
      return;
    }

    // Добавляем явное логирование состояния готовности игрока перед отправкой
    console.log('CardSelector: Текущее состояние playerReady перед отправкой:', playerReady);

    // Очистка предыдущих ошибок
    setLocalState(prev => ({
      ...prev,
      errorDetails: '',
      selectionInProgress: true,
      lastSelectionAttempt: new Date().toISOString()
    }));

    // Отмечаем, что есть активная ошибка UI, которую можно сбросить через событие
    window._cardSelectionErrorUI = true;

    // Диагностика состояния сокета
    console.log("CardSelector: Состояние сокета:", {
      id: socket?.id,
      connected: socket?.connected,
      disconnected: socket?.disconnected
    });

    // ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА: устанавливаем явные обработчики событий
    console.log("CardSelector: Устанавливаем локальные обработчики для диагностики");

    const onCardSelectedHandler = (data) => {
      console.log("CardSelector: Получено событие cardsSelected:", data);

      if (data && data.success) {
        console.log("CardSelector: Сбрасываем ошибку после получения cardsSelected с success=true");
        setLocalState(prev => ({
          ...prev,
          selectionInProgress: false,
          errorDetails: '',
          retryAttempt: 0,
          successTime: new Date().toISOString()
        }));

        // Сбрасываем флаг ошибки UI
        window._cardSelectionErrorUI = false;
      }
    };

    const onPlayerReadyHandler = (data) => {
      console.log("CardSelector: Получено событие playerReady:", data);

      // Обрабатываем даже без явного userId
      if (data) {
        console.log("CardSelector: Сбрасываем ошибку после получения playerReady");
        setLocalState(prev => ({
          ...prev,
          selectionInProgress: false,
          errorDetails: '',
          retryAttempt: 0,
          successTime: new Date().toISOString()
        }));

        // Сбрасываем флаг ошибки UI
        window._cardSelectionErrorUI = false;
      }
    };

    const onUpdatePlayerStatusHandler = (data) => {
      console.log("CardSelector: Получено событие updatePlayerStatus:", data);

      if (data && data.isReady === true) {
        console.log("CardSelector: Сбрасываем ошибку после получения updatePlayerStatus с isReady=true");
        setLocalState(prev => ({
          ...prev,
          selectionInProgress: false,
          errorDetails: '',
          retryAttempt: 0,
          successTime: new Date().toISOString()
        }));

        // Сбрасываем флаг ошибки UI
        window._cardSelectionErrorUI = false;
      }
    };

    // Установка обработчика для roomState
    const onRoomStateHandler = (data) => {
      console.log("CardSelector: Получено событие roomState для проверки статуса игрока");

      if (data && data.players) {
        // Используем context socket, который содержит информацию о текущем пользователе
        const userId = socket && socket.auth && socket.auth.userId;
        const player = data.players.find(p => p.userId === userId);

        if (player && player.isReady) {
          console.log("CardSelector: Игрок найден как готовый в roomState, сбрасываем ошибку");
          setLocalState(prev => ({
            ...prev,
            selectionInProgress: false,
            errorDetails: '',
            retryAttempt: 0,
            successTime: new Date().toISOString()
          }));

          // Сбрасываем флаг ошибки UI
          window._cardSelectionErrorUI = false;
        }
      }
    };

    // Устанавливаем временные обработчики для диагностики
    socket.on('cardsSelected', onCardSelectedHandler);
    socket.on('playerReady', onPlayerReadyHandler);
    socket.on('updatePlayerStatus', onUpdatePlayerStatusHandler);
    socket.on('roomState', onRoomStateHandler);

    // Через 15 секунд снимаем диагностические обработчики
    setTimeout(() => {
      console.log("CardSelector: Снимаем локальные диагностические обработчики");
      socket.off('cardsSelected', onCardSelectedHandler);
      socket.off('playerReady', onPlayerReadyHandler);
      socket.off('updatePlayerStatus', onUpdatePlayerStatusHandler);
      socket.off('roomState', onRoomStateHandler);
    }, 15000);

    // Отправляем карты
    try {
      const result = selectCardsForBattle(selectedCards);
      console.log('CardSelector: Результат вызова selectCardsForBattle:', result);

      // Запускаем таймер для проверки статуса
      setTimeout(() => {
        if (!playerReady) {
          console.log('CardSelector: Проверка после 5 секунд - статус playerReady:', playerReady);

          if (!playerReady) {
            console.log('CardSelector: Игрок все еще не отмечен как готовый после 5 секунд');
            setLocalState(prev => ({
              ...prev,
              selectionInProgress: false,
              errorDetails: 'Сервер получил карты, но не подтвердил выбор. Ожидание...',
              retryAttempt: (prev.retryAttempt || 0) + 1
            }));
          }
        } else {
          console.log('CardSelector: Проверка после 5 секунд - игрок уже отмечен как готовый');
        }
      }, 5000);

      // Запускаем и второй таймер, для повторной проверки
      setTimeout(() => {
        console.log('CardSelector: Проверка после 10 секунд - статус playerReady:', playerReady);

        if (!playerReady) {
          console.log('CardSelector: Игрок все еще не отмечен как готовый после 10 секунд');

          // Запрашиваем обновление состояния комнаты
          if (socket && socket.connected && currentRoom) {
            console.log('CardSelector: Отправляем запрос getRoomState для проверки статуса');
            socket.emit('getRoomState', { roomId: currentRoom });
          }
        }
      }, 10000);

      return true;
    } catch (error) {
      console.error('CardSelector: Ошибка при отправке карт:', error);
      setLocalState(prev => ({
        ...prev,
        errorDetails: `Ошибка: ${error.message}`,
        selectionInProgress: false
      }));
      return false;
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Ручная загрузка карт при нажатии кнопки
  const handleManualLoadCards = () => {
    console.log('CardSelector: Ручная загрузка карт');
    setLocalState(prev => ({
      ...prev,
      loadAttempts: 0 // Сбрасываем счетчик попыток
    }));
    loadCards();
  };

  // Функция для прямого обращения к API карт для отладки
  const handleDirectApiCall = async () => {
    try {
      console.log('Прямой запрос к API карт для отладки');
      const response = await fetch('http://localhost:5101/api/cards');

      if (!response.ok) {
        throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`API вернул ${data.length} карт:`, data);

      // Проверяем данные на наличие ключевых полей
      if (data.length > 0) {
        // Проверяем, что у всех карт есть необходимые поля
        const validCards = data.filter(card => card && card._id && card.name && card.type);

        console.log(`API вернул ${validCards.length} валидных карт из ${data.length}`);

        if (validCards.length > 0) {
          // Обновляем через контекст
          loadCards();
          console.log('Инициировано обновление карт через GameContext');
        } else {
          console.error('Получены карты без необходимых полей');
        }
      } else {
        console.error('API вернул пустой массив карт');
      }
    } catch (err) {
      console.error('Ошибка прямого запроса API:', err);
      alert(`Ошибка API: ${err.message}`);
    }
  };

  // Фильтрация карт
  const filteredCards = cardsCollection.filter(card => {
    // ОТЛАДКА: логируем все карты, чтобы понять, что приходит
    if (cardsCollection.length > 0 && !window.cardsLogged) {
      console.log('ОТЛАДКА КАРТ В ФИЛЬТРЕ:', JSON.stringify(cardsCollection.slice(0, 3)));
      window.cardsLogged = true;
    }

    // Проверяем, что карта имеет все необходимые свойства
    if (!card || !card._id || !card.type || !card.name || !card.couplet) {
      console.error('Карта некорректного формата:', card);
      return false;
    }

    // ОТКЛЮЧАЕМ ФИЛЬТРАЦИЮ В ОТЛАДОЧНОМ РЕЖИМЕ - ПОКАЗЫВАЕМ ВСЕ КАРТЫ
    if (window.location.search.includes('nofilter')) {
      return true;
    }

    // Фильтр по типу
    if (filters.type && card.type !== filters.type) {
      return false;
    }

    // Фильтр по поиску (в названии или куплете)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        card.name.toLowerCase().includes(searchLower) ||
        card.couplet.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Обязательно отображаем все карты в режиме отладки
  const displayCards = cardsCollection.length > 0 ? cardsCollection : [];

  // ОТЛАДКА: выводим результат фильтрации
  useEffect(() => {
    console.log(`Фильтрация: исходно ${cardsCollection.length} карт → отфильтровано ${filteredCards.length} карт`);
    console.log('Текущие фильтры:', filters);

    // Принудительно отображаем карты в консоли
    if (cardsCollection.length > 0) {
      console.log('======= ОТЛАДКА КАРТ =========');
      console.log(`Всего карт: ${cardsCollection.length}`);
      console.log(`Отфильтровано: ${filteredCards.length}`);
      console.log('Первые 3 карты:');
      cardsCollection.slice(0, 3).forEach((card, index) => {
        console.log(`Карта ${index + 1}:`, card);
      });
      console.log('======= КОНЕЦ ОТЛАДКИ =========');
    }

    // Автоматически сбрасываем фильтры, если нет карт после фильтрации
    if (cardsCollection.length > 0 && filteredCards.length === 0) {
      console.log('Фильтрация привела к пустому результату, сбрасываем фильтры');
      setFilters({ type: '', search: '' });
    }
  }, [cardsCollection.length, filteredCards.length, filters]);

  const isCardSelectionComplete = selectedCards.length === MAX_SELECTABLE_CARDS;
  const isSelectionPhase = gameStatus === 'selecting_cards' || gameStatus === 'cards_selection';

  // Отображение деталей состояния загрузки карт
  const renderCardLoadingDetails = () => {
    if (loading) {
      return (
        <div className="text-yellow-400">
          <span className="animate-pulse">⟳</span> Загрузка карт из API...
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-red-400">
          <span className="font-bold">Ошибка:</span> {error}
          <button
            className="ml-2 underline text-blue-400 hover:text-blue-300"
            onClick={handleManualLoadCards}
          >
            Повторить загрузку
          </button>
        </div>
      );
    }

    if (cardsCollection.length === 0) {
      return (
        <div className="text-red-400">
          Карты не загружены
          <button
            className="ml-2 underline text-blue-400 hover:text-blue-300"
            onClick={handleManualLoadCards}
          >
            Загрузить сейчас
          </button>
        </div>
      );
    }

    return (
      <div className="text-green-400">
        Карты успешно загружены ({cardsCollection.length} шт.)
        {gameStatus && <span className="ml-2">[Фаза: {gameStatus}]</span>}
        {currentRoom && <span className="ml-2">[Комната: {currentRoom.slice(0, 8)}...]</span>}
      </div>
    );
  };

  // Принудительная перезагрузка страницы
  const handleReloadPage = () => {
    window.location.reload();
  };

  // Добавляем кнопку отладки в интерфейс
  const renderDebugTools = () => (
    <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-yellow-500">
      <h4 className="text-lg font-bold text-yellow-500 mb-2">Инструменты отладки</h4>
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded text-sm"
          onClick={handleDirectApiCall}
        >
          Проверить API карт
        </button>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm"
          onClick={handleManualLoadCards}
        >
          Загрузить через контекст
        </button>
        <button
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded text-sm"
          onClick={debugCardStructure}
        >
          Проверить структуру карт
        </button>
        <button
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded text-sm"
          onClick={() => {
            // Вызываем debugCardInfo из контекста
            if (typeof debugCardInfo === 'function') {
              debugCardInfo();
            } else {
              console.log('Функция debugCardInfo не найдена в контексте');
              debugCardStructure(); // Используем альтернативу
            }
          }}
        >
          Анализ коллекции карт
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1 rounded text-sm"
          onClick={() => window.location.reload()}
        >
          Перезагрузить страницу
        </button>
        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1 rounded text-sm"
          onClick={() => {
            window.localStorage.clear();
            console.log('Локальное хранилище очищено');
            alert('Локальное хранилище очищено. Перезагрузите страницу, чтобы изменения вступили в силу.');
          }}
        >
          Очистить кэш
        </button>
        <button
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-1 rounded text-sm"
          onClick={() => window.location.href = window.location.pathname + '?nofilter=true&debug=true'}
        >
          Режим без фильтров
        </button>
      </div>
      <div className="mt-3 text-xs text-gray-300">
        <p className="mb-1">Проблемы с отображением:</p>
        <ul className="list-disc ml-5">
          <li>Проверьте, что в консоли нет ошибок</li>
          <li>Нажмите "Проверить API карт" для диагностики</li>
          <li>Убедитесь, что карты правильно загружены (проверьте структуру)</li>
          <li>Если страница не отвечает, перезагрузите её</li>
        </ul>
      </div>
    </div>
  );

  // Функция для отладки структуры карт
  const debugCardStructure = () => {
    console.log('===== ОТЛАДКА СТРУКТУРЫ КАРТ =====');

    if (!cardsCollection || cardsCollection.length === 0) {
      console.error('Коллекция карт пуста!');
      alert('Ошибка: Коллекция карт пуста!');
      return;
    }

    // Получаем первую карту для анализа
    const sampleCard = cardsCollection[0];
    console.log('Пример карты:', sampleCard);

    // Проверяем ключевые поля
    const requiredFields = ['_id', 'name', 'type', 'power', 'couplet', 'description', 'effects', 'image', 'rarity'];
    const missingFields = requiredFields.filter(field => !sampleCard.hasOwnProperty(field));

    if (missingFields.length > 0) {
      console.error('В карте отсутствуют обязательные поля:', missingFields.join(', '));
      alert(`Ошибка структуры карт: отсутствуют поля ${missingFields.join(', ')}`);
    } else {
      console.log('Структура карты корректна, все обязательные поля присутствуют');
      alert('Структура карт корректна: все обязательные поля присутствуют');
    }

    // Выводим сводку по картам
    const cardTypes = {};
    cardsCollection.forEach(card => {
      if (!cardTypes[card.type]) cardTypes[card.type] = 0;
      cardTypes[card.type]++;
    });

    console.log('Распределение карт по типам:', cardTypes);
    console.log('===== КОНЕЦ ОТЛАДКИ СТРУКТУРЫ КАРТ =====');
  };

  // Добавляем функцию для повторной отправки выбора карт
  const retryCardSelection = () => {
    console.log('CardSelector: Повторная попытка отправки выбора карт:', selectedCards);

    if (selectedCards.length !== MAX_SELECTABLE_CARDS) {
      alert(`Для повторной отправки необходимо выбрать ${MAX_SELECTABLE_CARDS} карт.`);
      return;
    }

    setLocalState(prev => ({
      ...prev,
      retryAttempt: (prev.retryAttempt || 0) + 1,
      lastRetryTime: new Date().toISOString(),
      errorDetails: 'Повторная отправка карт...'
    }));

    // Явно проверяем соединение
    if (!socket || !socket.connected) {
      console.error('CardSelector: Сокет не подключен при повторной попытке!');
      alert('Соединение с сервером отсутствует. Обновите страницу и попробуйте еще раз.');
      return;
    }

    // Повторно отправляем карты
    const result = selectCardsForBattle(selectedCards);

    console.log('CardSelector: Результат повторной отправки карт:', result);

    if (result === false) {
      setTimeout(() => {
        alert('Не удалось отправить карты. Проверьте соединение с сервером и попробуйте еще раз.');
      }, 500);
    }
  };

  // Функция для отображения статуса отправки карт с возможностью повтора
  const renderSelectionStatus = () => {
    if (!localState.selectionInProgress && !localState.errorDetails) {
      return null;
    }

    return (
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h3 className="text-xl font-bold mb-2">Статус выбора карт</h3>

        {localState.selectionInProgress && (
          <div className="flex items-center mb-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse mr-2"></div>
            <span className="text-yellow-500">Отправка выбора карт на сервер...</span>
          </div>
        )}

        {localState.errorDetails && (
          <div className="mb-3">
            <div className="flex items-center mb-1">
              <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
              <span className="text-red-500">{localState.errorDetails}</span>
            </div>

            <div className="text-xs text-gray-400 mb-2">
              Последняя попытка: {new Date(localState.lastSelectionAttempt || Date.now()).toLocaleTimeString()}
              {localState.retryAttempt > 0 && `, повторных попыток: ${localState.retryAttempt}`}
            </div>

            <div className="flex gap-2">
              <button
                onClick={retryCardSelection}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                disabled={selectedCards.length !== MAX_SELECTABLE_CARDS}
              >
                Повторить отправку
              </button>

              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
              >
                Обновить страницу
              </button>
            </div>
          </div>
        )}

        {playerReady && (
          <div className="flex items-center mb-2">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
            <span className="text-green-500">Выбор карт подтвержден!</span>
          </div>
        )}
      </div>
    );
  };

  // Добавляем функцию для отображения списка карт
  const renderCards = () => {
    // Применяем фильтры к коллекции карт
    const filteredCards = cardsCollection.filter(card => {
      // Фильтр по типу
      if (filters.type && card.type !== filters.type) {
        return false;
      }

      // Фильтр по поиску в имени или описании
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = card.name.toLowerCase().includes(searchLower);
        const descMatch = card.description?.toLowerCase().includes(searchLower);
        const coupletMatch = card.couplet?.toLowerCase().includes(searchLower);

        if (!nameMatch && !descMatch && !coupletMatch) {
          return false;
        }
      }

      return true;
    });

    if (loading) {
      return (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-300">Загрузка карт...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-900 bg-opacity-50 p-4 rounded-lg text-center">
          <p className="text-red-300 mb-3">{error}</p>
          <button
            onClick={handleManualLoadCards}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
          >
            Повторить загрузку
          </button>
        </div>
      );
    }

    if (filteredCards.length === 0) {
      return (
        <div className="bg-gray-800 p-6 rounded-lg text-center">
          <p className="text-gray-400 mb-3">
            {cardsCollection.length === 0
              ? "Карты не загружены"
              : "Нет карт, соответствующих фильтрам"}
          </p>
          {cardsCollection.length === 0 ? (
            <button
              onClick={handleManualLoadCards}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            >
              Загрузить карты
            </button>
          ) : (
            <button
              onClick={() => setFilters({ type: '', search: '' })}
              className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredCards.map(card => (
          <Card
            key={card._id}
            card={card}
            isSelected={selectedCards.includes(card._id)}
            isPlayable={!playerReady}
            onClick={handleCardClick}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="card-selector">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Выберите карты для баттла</h2>
        <p className="text-gray-300 mb-4">
          Выберите {MAX_SELECTABLE_CARDS} карт, которые вы будете использовать в бою.
          Стратегически подбирайте карты разных типов для максимальной эффективности.
        </p>

        {/* Отображаем отладочную панель */}
        <CardsDebugTools toggleVisible={true} />

        {/* Статус соединения */}
        <div className="flex items-center mb-4">
          <div className={`w-3 h-3 rounded-full mr-2 ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={socket?.connected ? 'text-green-500' : 'text-red-500'}>
            {socket?.connected ? 'Подключено к серверу' : 'Нет соединения с сервером'}
          </span>
        </div>

        {/* Статус выбора карт */}
        {renderSelectionStatus()}

        {/* Готовность игрока */}
        {playerReady ? (
          <div className="bg-green-800 bg-opacity-40 p-4 rounded-lg mb-4">
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <h3 className="text-xl font-bold text-green-500">Вы готовы к бою!</h3>
            </div>
            <p className="text-gray-300">Ожидание готовности соперника...</p>
          </div>
        ) : (
          <>
            {/* Фильтры для карт */}
            <div className="filters-container mb-4">
              <div className="filter-controls flex flex-wrap gap-2 mb-3">
                <select
                  name="type"
                  value={filters.type}
                  onChange={handleFilterChange}
                  className="bg-gray-700 text-white px-3 py-2 rounded"
                >
                  <option value="">Все типы</option>
                  <option value="attack">Атака</option>
                  <option value="defense">Защита</option>
                  <option value="combo">Комбо</option>
                  <option value="special">Специальная</option>
                </select>

                <input
                  type="text"
                  name="search"
                  placeholder="Поиск по названию"
                  value={filters.search}
                  onChange={handleFilterChange}
                  className="bg-gray-700 text-white px-3 py-2 rounded flex-grow"
                />
              </div>
            </div>

            {/* Выбранные карты */}
            <div className="selected-cards mb-6">
              <h3 className="text-xl font-bold mb-2">Выбранные карты ({selectedCards.length}/{MAX_SELECTABLE_CARDS})</h3>
              <div className="bg-gray-800 p-3 rounded-lg">
                {selectedCards.length === 0 ? (
                  <p className="text-gray-400 italic">Выберите карты из списка ниже</p>
                ) : (
                  <div className="selected-cards-list flex flex-wrap gap-2">
                    {selectedCards.map(cardId => {
                      const card = cardsCollection.find(c => c._id === cardId);
                      return card ? (
                        <div
                          key={card._id}
                          className="selected-card-indicator px-2 py-1 rounded flex items-center bg-gray-700 hover:bg-red-900 cursor-pointer transition-colors"
                          onClick={() => handleCardClick(card)}
                        >
                          <span className="font-bold mr-1">{card.power}</span>
                          <span className="truncate" style={{ maxWidth: '150px' }}>{card.name}</span>
                          <span className="ml-1 text-red-500">&times;</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <button
                  className={`px-4 py-2 rounded font-bold w-full ${selectedCards.length === MAX_SELECTABLE_CARDS
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    }`}
                  onClick={handleConfirmSelection}
                  disabled={selectedCards.length !== MAX_SELECTABLE_CARDS}
                >
                  {selectedCards.length === MAX_SELECTABLE_CARDS
                    ? 'Подтвердить выбор карт'
                    : `Выберите еще ${MAX_SELECTABLE_CARDS - selectedCards.length} карт`}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Список доступных карт */}
        <div className="available-cards">
          <h3 className="text-xl font-bold mb-2">Доступные карты</h3>
          {renderCardLoadingDetails()}

          {renderCards()}
        </div>
      </div>
    </div>
  );
};

export default CardSelector; 