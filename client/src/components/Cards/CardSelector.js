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
    socket
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
      'Игрок готов': playerReady
    });
    
    // Устанавливаем временные отметки для контроля обновлений компонента
    setLocalState(prev => ({
      ...prev,
      lastStatusCheck: new Date().toISOString(),
      componentLoaded: true
    }));
    
    // Попытка загрузить карты сразу, если они нужны
    if (cardsCollection.length === 0 && !loading) {
      console.log('⚠️ АВТОМАТИЧЕСКАЯ ЗАГРУЗКА КАРТ ПРИ ПЕРВОМ РЕНДЕРЕ ⚠️');
      loadCards();
    }
  }, [cardsCollection.length, loading, loadCards, gameStatus, error, playerReady]);
  // КОНЕЦ ТЕСТОВОГО БЛОКА

  // Улучшенная логика загрузки карт при монтировании компонента и изменении статуса
  useEffect(() => {
    console.log('CardSelector: Проверка наличия карт. Статус:', gameStatus, 'Карт:', cardsCollection.length);
    
    const shouldLoadCards = cardsCollection.length === 0 && !loading && 
                          (gameStatus === 'selecting_cards' || gameStatus === 'cards_selection') &&
                          localState.loadAttempts < 3;

    if (shouldLoadCards) {
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

  // Фильтрация карт
  const filteredCards = cardsCollection.filter(card => {
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

  const isCardSelectionComplete = selectedCards.length === MAX_SELECTABLE_CARDS;
  const isSelectionPhase = gameStatus === 'selecting_cards' || gameStatus === 'cards_selection';

  // Отображение деталей состояния загрузки карт
  const renderCardLoadingDetails = () => {
    if (loading) {
      return <div className="text-yellow-400">Загрузка карт из API...</div>;
    }
    
    if (error) {
      return <div className="text-red-400">Ошибка: {error}</div>;
    }
    
    if (cardsCollection.length === 0) {
      return <div className="text-red-400">Карты не загружены</div>;
    }
    
    return <div className="text-green-400">Карты успешно загружены ({cardsCollection.length} шт.)</div>;
  };

  // Принудительная перезагрузка страницы
  const handleReloadPage = () => {
    window.location.reload();
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
                className={`${
                  isCardSelectionComplete
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
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-10 text-white">
            <p className="mb-4">Карты не найдены</p>
            {cardsCollection.length === 0 ? (
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
            ) : (
              <p>Доступных карт нет, попробуйте изменить параметры фильтра</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 p-2 bg-gray-700 rounded">
              <p className="text-gray-300 text-sm">Найдено {filteredCards.length} карт</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredCards.map(card => (
                <Card
                  key={card._id}
                  card={card}
                  isSelected={selectedCards.includes(card._id)}
                  onClick={handleCardClick}
                  isPlayable={!playerReady && (!isCardSelectionComplete || selectedCards.includes(card._id))}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CardSelector; 