import React, { useState, useEffect } from 'react';
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
    debugCardInfo
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

    // СРАЗУ загружаем карты независимо от состояния
    console.log('⚠️ ПРИНУДИТЕЛЬНАЯ ЗАГРУЗКА КАРТ В CARD SELECTOR ⚠️');
    loadCards().then(cards => {
      console.log(`CardSelector: Загружено ${cards?.length || 0} карт при монтировании`);
    }).catch(err => {
      console.error('CardSelector: Ошибка загрузки карт при монтировании:', err);
    });
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
    if (selectedCards.length === MAX_SELECTABLE_CARDS) {
      console.log('CardSelector: Подтверждение выбора карт:', selectedCards);

      try {
        // Добавляем обратную связь непосредственно в компоненте
        setLocalState(prev => ({
          ...prev,
          selectionInProgress: true,
          lastSelectionAttempt: new Date().toISOString(),
          lastSelectedCards: [...selectedCards], // Сохраняем копию последнего выбора
          errorDetails: null // Сбрасываем предыдущие ошибки
        }));

        // Показываем более подробное сообщение через консоль
        console.table({
          'Выбранные карты': selectedCards,
          'Время попытки': new Date().toLocaleTimeString(),
          'Статус игры': gameStatus,
          'ID комнаты': currentRoom || 'Нет'
        });

        // Вызываем функцию выбора карт из контекста с обработкой результата
        const result = selectCardsForBattle(selectedCards);

        console.log('CardSelector: Результат отправки карт:', result);

        // Проверяем результат и предоставляем обратную связь
        if (result === false) {
          console.error('CardSelector: Ошибка при отправке выбранных карт');

          setTimeout(() => {
            // Если через 1 секунду всё ещё идёт отправка (ожидание восстановления соединения)
            if (localState.selectionInProgress) {
              // Обновляем UI, но не сбрасываем флаг
              setLocalState(prev => ({
                ...prev,
                errorDetails: 'Проблема с соединением, пробуем восстановить...',
                retryAttempt: (prev.retryAttempt || 0) + 1
              }));
            }
          }, 1000);

          // Через 6 секунд если выбор всё ещё обрабатывается, предлагаем отменить
          setTimeout(() => {
            if (localState.selectionInProgress && !playerReady) {
              alert('Ошибка при отправке выбранных карт. Возможно, есть проблемы с соединением. Попробуйте обновить страницу и выбрать карты снова.');

              setLocalState(prev => ({
                ...prev,
                selectionInProgress: false,
                errorDetails: 'Таймаут ожидания ответа от сервера'
              }));
            }
          }, 6000);
        } else {
          console.log('CardSelector: Карты успешно отправлены на сервер');

          // Добавляем таймер для проверки обновления статуса
          setTimeout(() => {
            if (!playerReady) {
              console.log('CardSelector: Статус игрока не обновился на "готов" после отправки карт');

              // Обновляем состояние с информацией о задержке ответа
              setLocalState(prev => ({
                ...prev,
                errorDetails: 'Сервер получил карты, но не подтвердил выбор. Ожидание...'
              }));

              // На всякий случай еще раз запрашиваем обновление состояния через сокет
              if (socket && socket.connected) {
                socket.emit('getRoomState', { roomId: currentRoom });
              }

              // Если через 5 секунд статус не обновился, предлагаем действия
              setTimeout(() => {
                if (!playerReady) {
                  alert('Сервер не подтвердил выбор карт. Возможно, есть проблемы на сервере. Попробуйте выбрать карты еще раз или обновите страницу.');

                  // Сбрасываем флаг процесса выбора
                  setLocalState(prev => ({
                    ...prev,
                    selectionInProgress: false,
                    errorDetails: 'Таймаут ожидания подтверждения от сервера'
                  }));
                } else {
                  // Если статус обновился, отмечаем успешное завершение
                  setLocalState(prev => ({
                    ...prev,
                    selectionInProgress: false,
                    successTime: new Date().toISOString(),
                    errorDetails: null
                  }));
                }
              }, 5000);
            }
          }, 3000);
        }
      } catch (err) {
        console.error('CardSelector: Ошибка при подтверждении выбора карт:', err);

        // Показываем подробное сообщение об ошибке
        setLocalState(prev => ({
          ...prev,
          selectionInProgress: false,
          errorDetails: `Ошибка: ${err.message || 'Неизвестная ошибка'}`
        }));

        alert(`Произошла ошибка: ${err.message || 'Неизвестная ошибка'}. Попробуйте еще раз.`);
      }
    } else {
      alert(`Необходимо выбрать ровно ${MAX_SELECTABLE_CARDS} карт для продолжения.`);
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

  return (
    <div className="w-full">
      {/* ТЕСТОВЫЙ БЛОК - ЯВНОЕ ПОДТВЕРЖДЕНИЕ ЧТО ИЗМЕНЕНИЯ ПРИМЕНИЛИСЬ */}
      <div className="mb-6 bg-red-800 p-4 rounded-lg text-white border-2 border-yellow-400">
        <h2 className="text-2xl font-bold mb-2">⚠️ ТЕСТОВАЯ ВЕРСИЯ КОМПОНЕНТА ⚠️</h2>
        <p>Этот блок виден только в отладочной версии компонента</p>
        <div className="mt-2">
          <p>Текущий статус игры: <span className="font-bold">{gameStatus || 'не установлен'}</span></p>
          <p>Загружено карт: <span className="font-bold">{cardsCollection.length}</span></p>
          <p>Время последней проверки: {new Date().toLocaleTimeString()}</p>
          <p>Компонент загружен в: {localState.lastStatusCheck ? new Date(localState.lastStatusCheck).toLocaleTimeString() : 'неизвестно'}</p>
        </div>
      </div>

      <div className="mb-6 bg-gray-800 p-4 rounded-lg">
        <h2 className="text-2xl font-bold mb-4 text-white">Выберите {MAX_SELECTABLE_CARDS} карт для баттла</h2>

        {/* Статус выбора */}
        <div className="mb-4">
          <div className="flex items-center">
            <span className="text-white mr-2">Выбрано: {selectedCards.length}/{MAX_SELECTABLE_CARDS}</span>
            {playerReady ? (
              <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                Готово
              </span>
            ) : localState.selectionInProgress ? (
              <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
                Отправка выбора...
              </span>
            ) : (
              <button
                className={`${isCardSelectionComplete
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 cursor-not-allowed'
                  } text-white px-4 py-2 rounded`}
                disabled={!isCardSelectionComplete || localState.selectionInProgress}
                onClick={handleConfirmSelection}
              >
                Подтвердить выбор
              </button>
            )}

            {cardsCollection.length === 0 && (
              <button
                className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                onClick={handleManualLoadCards}
              >
                Загрузить карты
              </button>
            )}

            {/* Кнопка перезагрузки страницы */}
            <button
              className="ml-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
              onClick={handleReloadPage}
            >
              Перезагрузить страницу
            </button>
          </div>

          {/* Отображение статуса последней попытки отправки карт */}
          {localState.lastSelectionAttempt && (
            <div className="text-sm mt-2">
              <span className="text-gray-400">Последняя попытка отправки: </span>
              <span className="text-yellow-400">
                {new Date(localState.lastSelectionAttempt).toLocaleTimeString()}
                ({Math.floor((new Date() - new Date(localState.lastSelectionAttempt)) / 1000)} сек. назад)
              </span>
              {playerReady && (
                <span className="ml-2 text-green-400">✓ Выбор подтвержден!</span>
              )}
              {localState.errorDetails && (
                <div className="mt-1 text-red-400">
                  <span className="font-bold">Проблема: </span> {localState.errorDetails}
                  {localState.retryAttempt > 0 && (
                    <span className="ml-2">(Попытка восстановления: {localState.retryAttempt})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Прогресс-бар отправки данных */}
          {localState.selectionInProgress && (
            <div className="mt-2 bg-gray-700 rounded-full h-2.5 w-full overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full animate-pulse"
                style={{
                  width: '100%',
                  animationDuration: '1.5s'
                }}
              ></div>
            </div>
          )}
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search" className="block text-sm text-gray-400 mb-1">
              Поиск
            </label>
            <input
              type="text"
              id="search"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Поиск по названию или тексту..."
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              disabled={!isSelectionPhase || playerReady}
            />
          </div>

          <div className="w-40">
            <label htmlFor="type" className="block text-sm text-gray-400 mb-1">
              Тип карты
            </label>
            <select
              id="type"
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              disabled={!isSelectionPhase || playerReady}
            >
              <option value="">Все типы</option>
              <option value="attack">Атака</option>
              <option value="defense">Защита</option>
              <option value="combo">Комбо</option>
              <option value="special">Специальная</option>
            </select>
          </div>
        </div>

        {/* Статистика карт - для отладки */}
        <div className="mt-2 text-xs text-gray-400">
          <p>Всего загружено карт: {cardsCollection.length}</p>
          <p>Статус загрузки: {loading ? 'Загрузка...' : 'Готово'}</p>
          {renderCardLoadingDetails()}
          <p>Текущая фаза: {gameStatus}</p>
          <p>Время последней проверки: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Выбранные карты */}
      {selectedCards.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-4 text-white">Выбранные карты:</h3>
          <div className="flex flex-wrap gap-4 overflow-x-auto py-4">
            {selectedCards.map(cardId => {
              const card = cardsCollection.find(c => c._id === cardId);
              return (
                card && (
                  <Card
                    key={card._id}
                    card={card}
                    isSelected={true}
                    onClick={playerReady ? undefined : handleCardClick}
                    isPlayable={!playerReady}
                  />
                )
              );
            })}
          </div>
        </div>
      )}

      {/* Список всех карт для выбора с улучшенной обработкой ошибок */}
      <div>
        <h3 className="text-xl font-bold mb-4 text-white">Доступные карты:</h3>
        {/* Отладочная информация о коллекции */}
        <pre className="mt-2 mb-4 p-3 text-xs bg-gray-900 text-white rounded overflow-auto max-h-40">
          {JSON.stringify({
            gameStatus,
            cardsTotal: cardsCollection.length,
            filteredTotal: filteredCards.length,
            filters,
            sample: cardsCollection.length > 0 ?
              JSON.stringify(cardsCollection[0]).substring(0, 100) + '...' : 'нет карт',
            socketConnected: socket?.connected ? 'да' : 'нет',
            currentRoom: currentRoom || 'нет',
            playerReady
          }, null, 2)}
        </pre>

        {loading ? (
          <div className="text-center py-10 text-white">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
            <p>Загрузка карт...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-4"
              onClick={handleManualLoadCards}
            >
              Попробовать загрузить карты
            </button>
            <button
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
              onClick={handleReloadPage}
            >
              Перезагрузить страницу
            </button>
          </div>
        ) : cardsCollection.length === 0 ? (
          <div className="text-center py-10 text-white">
            <p className="mb-4">Карты не загружены</p>
            <div>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-4"
                onClick={handleManualLoadCards}
              >
                Попробовать загрузить карты
              </button>
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                onClick={handleReloadPage}
              >
                Перезагрузить страницу
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ПРИНУДИТЕЛЬНОЕ ОТОБРАЖЕНИЕ ВСЕХ КАРТ - ОТЛАДОЧНЫЙ БЛОК */}
            <div className="mb-6 bg-red-900 p-3 rounded-lg border border-yellow-500">
              <h3 className="text-lg font-bold text-yellow-500 mb-2">⚠️ ОТЛАДОЧНОЕ ОТОБРАЖЕНИЕ КАРТ ({cardsCollection.length}) ⚠️</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {cardsCollection.length > 0 ? (
                  cardsCollection.slice(0, 8).map((card, index) => (
                    <div key={card._id || index} className="bg-gray-800 p-4 rounded-lg">
                      <h4 className="text-yellow-400 font-bold">{card.name || 'Без имени'}</h4>
                      <p className="text-white">Тип: {card.type || 'Неизвестно'}</p>
                      <p className="text-white">Сила: {card.power}</p>
                      <p className="text-gray-300 text-sm mt-2">{card.couplet || 'Нет текста'}</p>
                      <button
                        className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-sm"
                        onClick={() => handleCardClick(card)}
                      >
                        Выбрать
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 text-center text-red-500">
                    Нет карт для отображения
                  </div>
                )}
              </div>
              <div className="mt-3 text-center">
                <button
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
                  onClick={() => setFilters({ type: '', search: '' })}
                >
                  Сбросить все фильтры
                </button>
              </div>
            </div>

            {/* Обычное отображение карт */}
            <div className="mb-4 p-2 bg-gray-700 rounded">
              <p className="text-gray-300 text-sm">
                Найдено {filteredCards.length} из {cardsCollection.length} карт
                {filters.type || filters.search ? " (применены фильтры)" : ""}
                <button
                  className="ml-4 underline text-blue-400 hover:text-blue-300 text-xs"
                  onClick={() => window.location.href = window.location.pathname + '?nofilter'}
                >
                  Показать все без фильтров
                </button>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Принудительно отображаем все карты, а не только отфильтрованные */}
              {Array.isArray(displayCards) && displayCards.length > 0 ? (
                displayCards.map(card => (
                  card && card._id ? (
                    <Card
                      key={card._id}
                      card={card}
                      isSelected={selectedCards.includes(card._id)}
                      onClick={handleCardClick}
                      isPlayable={!playerReady && (!isCardSelectionComplete || selectedCards.includes(card._id))}
                    />
                  ) : (
                    <div key={Math.random()} className="bg-red-800 p-4 rounded-lg text-white text-center">
                      <p>Некорректная карта без ID</p>
                      <pre className="text-xs mt-2 bg-gray-900 p-2 rounded overflow-auto">
                        {JSON.stringify(card, null, 2)}
                      </pre>
                    </div>
                  )
                ))
              ) : (
                <div className="col-span-4 bg-red-800 p-4 rounded-lg text-white text-center">
                  <p className="mb-2 font-bold">Проблема с отображением карт</p>
                  <p>Количество карт в коллекции: {cardsCollection.length}</p>
                  <p>Количество отфильтрованных карт: {filteredCards.length}</p>
                  <p>Фильтры: {JSON.stringify(filters)}</p>
                  <button
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                    onClick={() => setFilters({ type: '', search: '' })}
                  >
                    Сбросить фильтры
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {renderDebugTools()}
    </div>
  );
};

export default CardSelector; 