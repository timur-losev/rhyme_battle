import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../Cards/Card';
import BattleLog from './BattleLog';
import SpecialEvent from './SpecialEvent';

const BattleArena = () => {
  const { 
    gameState, 
    battleLog, 
    currentEvent, 
    selectedCards, 
    cardsCollection, 
    playCard 
  } = useGame();
  const { currentUser } = useAuth();
  const [playerCards, setPlayerCards] = useState([]);
  const [selectedCardToPlay, setSelectedCardToPlay] = useState(null);
  const [selectingTarget, setSelectingTarget] = useState(false);
  const [opponentLastCard, setOpponentLastCard] = useState(null);
  const [showEventNotification, setShowEventNotification] = useState(false);

  // Загрузка карт игрока
  useEffect(() => {
    if (cardsCollection.length > 0 && selectedCards.length > 0) {
      const playerCardObjects = selectedCards
        .map(cardId => cardsCollection.find(card => card._id === cardId))
        .filter(Boolean);
      setPlayerCards(playerCardObjects);
    }
  }, [cardsCollection, selectedCards]);

  // Отображение уведомления о специальном событии
  useEffect(() => {
    if (currentEvent) {
      setShowEventNotification(true);
      const timer = setTimeout(() => {
        setShowEventNotification(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [currentEvent]);

  // Обновление последней сыгранной карты оппонента
  useEffect(() => {
    if (battleLog.length > 0 && gameState) {
      const playerIndex = gameState.players.findIndex(p => p.userId === currentUser.id);
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      
      // Найти последний ход оппонента в логе
      const lastOpponentMove = [...battleLog]
        .reverse()
        .find(log => log.player === opponentIndex);
      
      if (lastOpponentMove) {
        // Найти карту в коллекции
        const card = cardsCollection.find(card => card._id === lastOpponentMove.cardPlayed);
        if (card) {
          setOpponentLastCard(card);
        }
      }
    }
  }, [battleLog, gameState, cardsCollection, currentUser]);

  // Определить, чей сейчас ход
  const isPlayerTurn = () => {
    if (!gameState) return false;
    
    const playerIndex = gameState.players.findIndex(p => p.userId === currentUser.id);
    return playerIndex === gameState.currentTurn.player;
  };

  // Обработчик выбора карты для игры
  const handleCardSelect = (card) => {
    // Если уже выбрана карта для игры
    if (selectedCardToPlay && selectedCardToPlay._id === card._id) {
      setSelectedCardToPlay(null);
      setSelectingTarget(false);
      return;
    }
    
    setSelectedCardToPlay(card);
    
    // Если карта защитная и есть последняя карта оппонента, 
    // входим в режим выбора цели
    if (card.type === 'defense' && opponentLastCard) {
      setSelectingTarget(true);
    } else {
      // Иначе сразу играем карту
      playCard(card._id);
      setSelectedCardToPlay(null);
    }
  };

  // Обработчик выбора цели для защитной карты
  const handleTargetSelect = () => {
    if (selectedCardToPlay && opponentLastCard) {
      playCard(selectedCardToPlay._id, opponentLastCard._id);
      setSelectedCardToPlay(null);
      setSelectingTarget(false);
    }
  };

  // Отмена выбора цели
  const handleCancelTargetSelect = () => {
    setSelectedCardToPlay(null);
    setSelectingTarget(false);
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-xl text-white">Загрузка данных боя...</p>
      </div>
    );
  }

  // Получаем индекс текущего игрока
  const playerIndex = gameState.players.findIndex(p => p.userId === currentUser.id);
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  
  // Данные игроков
  const player = gameState.players[playerIndex];
  const opponent = gameState.players[opponentIndex];

  return (
    <div className="bg-gray-900 text-white p-4">
      {/* Уведомление о специальном событии */}
      {showEventNotification && currentEvent && (
        <SpecialEvent event={currentEvent} onClose={() => setShowEventNotification(false)} />
      )}

      {/* Информация о текущем раунде */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">
          Раунд {gameState.currentTurn.round} - {
            isPlayerTurn() ? 
            <span className="text-green-400">Ваш ход</span> : 
            <span className="text-yellow-400">Ход противника</span>
          }
        </h2>
      </div>

      {/* Игровое поле */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Лог боя */}
        <div className="lg:col-span-2">
          <BattleLog 
            logs={battleLog} 
            currentRound={gameState.currentTurn.round} 
            playerIndex={playerIndex}
          />
        </div>
        
        {/* Центральная арена */}
        <div className="lg:col-span-3">
          {/* Оппонент */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Противник</h3>
              <div className="text-xl font-bold bg-purple-900 px-4 py-2 rounded-lg">
                {opponent.score} очков
              </div>
            </div>
            
            {/* Последняя сыгранная карта оппонента */}
            <div className="flex justify-center">
              {opponentLastCard ? (
                <div className={`relative ${selectingTarget ? 'cursor-pointer animate-pulse' : ''}`}>
                  <Card card={opponentLastCard} isPlayable={false} />
                  
                  {selectingTarget && (
                    <div 
                      className="absolute inset-0 bg-red-500 bg-opacity-30 rounded-lg flex items-center justify-center"
                      onClick={handleTargetSelect}
                    >
                      <div className="bg-black bg-opacity-70 text-white p-4 rounded text-center">
                        <p className="text-lg font-bold mb-2">Выбрать целью</p>
                        <button 
                          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
                          onClick={handleTargetSelect}
                        >
                          Атаковать
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 italic">Карты ещё не сыграны</div>
              )}
            </div>
          </div>
          
          {/* Специальное событие */}
          {currentEvent && (
            <div className="bg-yellow-900 rounded-lg p-4 mb-6 text-center">
              <h3 className="text-xl font-bold mb-2">Специальное событие:</h3>
              <p>{currentEvent.description}</p>
            </div>
          )}
          
          {/* Игрок */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Вы</h3>
              <div className="text-xl font-bold bg-blue-900 px-4 py-2 rounded-lg">
                {player.score} очков
              </div>
            </div>
            
            {selectingTarget && (
              <div className="bg-black bg-opacity-50 p-3 rounded-lg mb-4">
                <p className="text-center mb-2">Выберите карту противника для блокировки/контратаки</p>
                <div className="flex justify-center">
                  <button 
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded mr-2"
                    onClick={handleCancelTargetSelect}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
            
            {/* Карты игрока */}
            <div className="flex flex-wrap justify-center gap-4">
              {playerCards.map(card => (
                <Card
                  key={card._id}
                  card={card}
                  isSelected={selectedCardToPlay && selectedCardToPlay._id === card._id}
                  isPlayable={isPlayerTurn() && !selectingTarget}
                  onClick={isPlayerTurn() ? handleCardSelect : undefined}
                  className="transform transition-transform"
                />
              ))}
              
              {playerCards.length === 0 && (
                <div className="text-gray-500 italic">У вас не осталось карт</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleArena; 