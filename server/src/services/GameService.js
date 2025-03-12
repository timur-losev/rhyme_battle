const { v4: uuidv4 } = require('uuid');
const Game = require('../models/Game');
const Card = require('../models/Card');
const mongoose = require('mongoose');

class GameService {
  constructor(io) {
    this.io = io;
    this.games = new Map(); // Хранение активных игр в памяти для быстрого доступа
    this.socketToRoom = new Map(); // Маппинг сокетов к комнатам
  }

  // Создать новую игровую комнату
  createRoom(userId) {
    console.log('GameService: Создание комнаты для пользователя:', userId);
    const roomId = uuidv4();
    
    // Инициализация игры в памяти
    this.games.set(roomId, {
      roomId,
      players: [
        {
          userId,
          selectedCards: [],
          score: 0,
          isReady: false
        }
      ],
      status: 'waiting',
      currentTurn: {
        player: 0,
        round: 1,
        phase: 'attack'
      },
      battleLog: [],
      specialEvents: []
    });
    
    console.log('GameService: Игра инициализирована в памяти для комнаты:', roomId);
    
    // Сохранение в БД
    try {
      const newGame = new Game({
        roomId,
        players: [{
          userId,
          selectedCards: [],
          score: 0,
          isReady: false
        }],
        status: 'waiting'
      });
      
      console.log('GameService: Попытка сохранить игру в БД:', roomId);
      newGame.save()
        .then(() => console.log('GameService: Игра успешно сохранена в БД:', roomId))
        .catch(err => console.error('GameService: Ошибка при сохранении игры в БД:', err));
    } catch (error) {
      console.error('GameService: Ошибка при создании экземпляра игры:', error);
      throw error;
    }
    
    return roomId;
  }

  // Проверка существования комнаты
  checkRoomExists(roomId) {
    const game = this.games.get(roomId);
    return !!game; // Преобразуем в булево значение
  }

  // Присоединиться к комнате
  joinRoom(roomId, userId) {
    console.log('GameService: Попытка присоединиться к комнате:', roomId, 'пользователем:', userId);
    const game = this.games.get(roomId);
    
    if (!game) {
      console.log('GameService: Комната не найдена:', roomId);
      return { success: false, message: 'Комната не найдена' };
    }
    
    // Проверяем, есть ли уже этот игрок в комнате
    const existingPlayerIndex = game.players.findIndex(player => player.userId === userId);
    
    if (existingPlayerIndex >= 0) {
      console.log('GameService: Пользователь уже в комнате, обновляем соединение:', userId);
      // Игрок уже присоединен, просто возвращаем успех
      return { success: true, message: 'Вы уже в этой комнате' };
    }
    
    if (game.players.length >= 2) {
      console.log('GameService: Комната полна:', roomId);
      return { success: false, message: 'Комната полна' };
    }
    
    // Добавление нового игрока в память
    game.players.push({
      userId,
      selectedCards: [],
      score: 0,
      isReady: false
    });
    
    console.log('GameService: Игрок добавлен в память:', userId);
    
    // Обновление статуса игры в памяти при присоединении второго игрока
    if (game.players.length === 2) {
      console.log('GameService: Второй игрок присоединился, обновляем статус на cards_selection');
      game.status = 'cards_selection';
    }
    
    // Обновление в БД
    Game.findOne({ roomId })
      .then(gameDoc => {
        if (!gameDoc) {
          console.error('GameService: Игра не найдена в БД:', roomId);
          return;
        }
        
        // Проверяем, есть ли уже этот игрок в БД
        const playerInDb = gameDoc.players.find(player => player.userId === userId);
        
        if (!playerInDb) {
          // Добавляем игрока только если его еще нет
          gameDoc.players.push({
            userId,
            selectedCards: [],
            score: 0,
            isReady: false
          });
        }
        
        // Обновляем статус при присоединении второго игрока
        if (gameDoc.players.length === 2) {
          gameDoc.status = 'cards_selection';
        }
        
        // Уведомляем всех игроков в комнате через сокеты
        try {
          const roomState = this.getRoomState(roomId);
          if (roomState) {
            this.io.to(roomId).emit('roomState', roomState);
          }
        } catch (err) {
          console.error('GameService: Ошибка при отправке состояния комнаты:', err);
        }
        
        return gameDoc.save();
      })
      .then(() => console.log('GameService: Игра успешно обновлена в БД:', roomId))
      .catch(err => console.error('GameService: Ошибка при обновлении игры в БД:', err));
    
    console.log('GameService: Успешное присоединение к комнате:', roomId);
    return { success: true };
  }

  // Выбор карт игроком
  selectCards(roomId, userId, cardIds) {
    const game = this.games.get(roomId);
    
    if (!game) {
      return { success: false, message: 'Игра не найдена' };
    }
    
    const playerIndex = game.players.findIndex(player => player.userId === userId);
    
    if (playerIndex === -1) {
      return { success: false, message: 'Игрок не найден' };
    }
    
    console.log('GameService: Выбор карт для игрока:', userId, 'Карты:', cardIds);
    
    // Обновление выбранных карт в памяти
    game.players[playerIndex].selectedCards = cardIds;
    game.players[playerIndex].isReady = true;
    
    // Обновление в БД
    Game.findOne({ roomId }).then(gameDoc => {
      try {
        // Проверяем формат cardIds и обрабатываем тестовые карты
        const processedCardIds = cardIds.map(cardId => {
          // Если ID начинается с 'test-card-', создаем его как особый ObjectId
          // Для MongoDB _id может быть или ObjectId, или любым другим типом данных, указанным в схеме
          if (typeof cardId === 'string' && (cardId.startsWith('test-card-') || cardId.startsWith('emergency-card-'))) {
            console.log('Обрабатываем тестовую карту:', cardId);
            // Используем специальную конверсию для тестовых карт
            // Так как это тест, мы можем использовать специальные строки как id
            // Они будут обрабатываться отдельно в логике игры
            return cardId;
          }
          // В противном случае, пытаемся преобразовать в ObjectId
          try {
            return new mongoose.Types.ObjectId(cardId);
          } catch (err) {
            console.error('Ошибка при преобразовании ID карты:', cardId, err);
            // Возвращаем исходное значение, если не удалось преобразовать
            return cardId;
          }
        });
        
        console.log('Преобразованные ID карт:', processedCardIds);
        
        // Используем обработанные ID карт
        gameDoc.players[playerIndex].selectedCards = processedCardIds;
        gameDoc.players[playerIndex].isReady = true;
        gameDoc.save()
          .then(() => console.log('Карты успешно сохранены для игрока', userId))
          .catch(err => console.error('Ошибка при сохранении выбранных карт:', err));
      } catch (err) {
        console.error('Ошибка при обработке выбранных карт:', err);
      }
    });
    
    return { success: true };
  }

  // Проверка готовности всех игроков
  areAllPlayersReady(roomId) {
    const game = this.games.get(roomId);
    
    if (!game || game.players.length < 2) {
      return false;
    }
    
    return game.players.every(player => player.isReady);
  }

  // Получить состояние боя
  getBattleState(roomId) {
    const game = this.games.get(roomId);
    
    if (!game) {
      return null;
    }
    
    // Если все игроки готовы, начинаем бой
    if (this.areAllPlayersReady(roomId) && game.status === 'cards_selection') {
      game.status = 'battle';
      
      // Генерируем случайное событие для 3-го раунда
      game.specialEvents.push({
        round: 3,
        eventType: 'double_points',
        description: 'Все очки, полученные в этом раунде, удваиваются!',
        active: false
      });
      
      // Обновление в БД
      Game.findOneAndUpdate(
        { roomId },
        { 
          status: 'battle',
          specialEvents: game.specialEvents
        }
      ).exec();
    }
    
    // Проверка специальных событий для текущего раунда
    const currentRound = game.currentTurn.round;
    const activeEvent = game.specialEvents.find(event => event.round === currentRound && !event.active);
    
    if (activeEvent) {
      activeEvent.active = true;
      this.io.to(roomId).emit('specialEvent', activeEvent);
    }
    
    return {
      status: game.status,
      players: game.players.map(player => ({
        userId: player.userId,
        score: player.score,
        cardsRemaining: player.selectedCards.length
      })),
      currentTurn: game.currentTurn,
      battleLog: game.battleLog,
      specialEvents: game.specialEvents.filter(event => event.active || event.round === currentRound)
    };
  }

  // Разыгрывание карты
  playCard(roomId, userId, cardId, targetCardId = null) {
    const game = this.games.get(roomId);
    
    if (!game || game.status !== 'battle') {
      return { success: false, message: 'Игра не в режиме боя' };
    }
    
    const playerIndex = game.players.findIndex(player => player.userId === userId);
    
    if (playerIndex === -1 || playerIndex !== game.currentTurn.player) {
      return { success: false, message: 'Не ваш ход' };
    }
    
    // Находим карту в выбранных картах игрока
    const cardIndex = game.players[playerIndex].selectedCards.indexOf(cardId);
    
    if (cardIndex === -1) {
      return { success: false, message: 'Карта не найдена в вашей колоде' };
    }
    
    // Получаем информацию о карте
    return Card.findById(cardId).then(card => {
      if (!card) {
        return { success: false, message: 'Карта не найдена в базе данных' };
      }
      
      // Убираем карту из колоды игрока
      game.players[playerIndex].selectedCards.splice(cardIndex, 1);
      
      // Определяем противника
      const opponentIndex = (playerIndex === 0) ? 1 : 0;
      
      // Расчет очков на основе типа карты и специальных событий
      let points = card.power;
      let turnEnded = false;
      let gameEnded = false;
      
      // Проверка специальных событий (например, удвоение очков)
      const doublePointsEvent = game.specialEvents.find(event => 
        event.round === game.currentTurn.round && 
        event.active && 
        event.eventType === 'double_points'
      );
      
      if (doublePointsEvent) {
        points *= 2;
      }
      
      // Логика обработки различных типов карт
      let effectApplied = false;
      
      // Если это атакующая карта
      if (card.type === 'attack') {
        game.players[playerIndex].score += points;
        effectApplied = true;
      }
      
      // Если это защитная карта (блок)
      else if (card.type === 'defense' && targetCardId) {
        // Находим последнюю сыгранную карту противника
        const lastOpponentCard = game.battleLog
          .filter(log => log.player === opponentIndex)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        if (lastOpponentCard && lastOpponentCard.cardPlayed.toString() === targetCardId) {
          // Блокируем часть очков противника (например, половину)
          const blockedPoints = Math.floor(lastOpponentCard.points / 2);
          game.players[opponentIndex].score -= blockedPoints;
          
          effectApplied = true;
        }
      }
      
      // Если это комбо-карта
      else if (card.type === 'combo') {
        game.players[playerIndex].score += points;
        
        // Добавляем бонус за комбо
        const comboEffect = card.effects.find(effect => effect.type === 'combo');
        if (comboEffect) {
          game.players[playerIndex].score += comboEffect.value;
        }
        
        effectApplied = true;
        
        // Проверяем, есть ли эффект chain (цепочка), позволяющий сыграть еще одну карту
        const chainEffect = card.effects.find(effect => effect.type === 'chain');
        if (chainEffect) {
          turnEnded = false; // Игрок может сыграть еще одну карту
        } else {
          turnEnded = true;
        }
      }
      
      // Если это специальная карта
      else if (card.type === 'special') {
        // Применяем различные эффекты
        card.effects.forEach(effect => {
          if (effect.type === 'cancel_combo') {
            // Находим последний комбо-бонус противника и отменяем его
            const lastComboLog = game.battleLog
              .filter(log => log.player === opponentIndex && log.effect === 'combo')
              .sort((a, b) => b.timestamp - a.timestamp)[0];
            
            if (lastComboLog) {
              game.players[opponentIndex].score -= lastComboLog.points;
              effectApplied = true;
            }
          }
          
          if (effect.type === 'damage') {
            game.players[playerIndex].score += effect.value;
            effectApplied = true;
          }
        });
        
        turnEnded = true;
      }
      
      // Если эффект не применен, просто начисляем базовые очки
      if (!effectApplied) {
        game.players[playerIndex].score += points;
      }
      
      // Записываем действие в лог
      const logEntry = {
        round: game.currentTurn.round,
        player: playerIndex,
        cardPlayed: cardId,
        targetCard: targetCardId,
        effect: card.type,
        points: points,
        description: `Игрок ${playerIndex + 1} разыграл карту "${card.name}" и получил ${points} очков.`,
        timestamp: new Date()
      };
      
      game.battleLog.push(logEntry);
      
      // Проверяем, закончился ли ход
      if (turnEnded !== false) {
        // Переход хода к другому игроку
        game.currentTurn.player = opponentIndex;
        
        // Проверяем, закончился ли раунд
        if (game.currentTurn.player === 0) {
          game.currentTurn.round++;
        }
        
        // Проверяем, закончилась ли игра (3 раунда)
        if (game.currentTurn.round > 3) {
          game.status = 'finished';
          
          // Определяем победителя
          const winner = game.players[0].score > game.players[1].score ? 0 : 1;
          game.winner = game.players[winner].userId;
          
          gameEnded = true;
          
          // Обновляем в БД
          Game.findOneAndUpdate(
            { roomId },
            {
              status: 'finished',
              winner: game.players[winner].userId,
              updatedAt: new Date()
            }
          ).exec();
        }
      }
      
      // Обновляем игру в БД
      Game.findOne({ roomId }).then(gameDoc => {
        gameDoc.players = game.players;
        gameDoc.currentTurn = game.currentTurn;
        gameDoc.battleLog.push(logEntry);
        gameDoc.status = game.status;
        
        if (game.winner) {
          gameDoc.winner = game.winner;
        }
        
        gameDoc.updatedAt = new Date();
        gameDoc.save();
      });
      
      return {
        success: true,
        cardPlayed: {
          id: card._id,
          name: card.name,
          type: card.type,
          points: points
        },
        player: {
          userId: userId,
          index: playerIndex,
          newScore: game.players[playerIndex].score
        },
        battleLog: logEntry,
        turnEnded: turnEnded,
        gameEnded: gameEnded
      };
    });
  }

  // Получить результаты игры
  getGameResults(roomId) {
    const game = this.games.get(roomId);
    
    if (!game || game.status !== 'finished') {
      return { success: false, message: 'Игра еще не завершена' };
    }
    
    const winner = game.players[0].score > game.players[1].score ? 0 : 1;
    
    return {
      winner: {
        userId: game.players[winner].userId,
        score: game.players[winner].score
      },
      loser: {
        userId: game.players[winner === 0 ? 1 : 0].userId,
        score: game.players[winner === 0 ? 1 : 0].score
      },
      battleLog: game.battleLog,
      rounds: game.currentTurn.round - 1
    };
  }

  // Обработчик отключения игрока
  handleDisconnect(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    
    if (roomId) {
      // Удаляем маппинг
      this.socketToRoom.delete(socketId);
      
      // Если игра еще не завершена, отмечаем как прерванную
      const game = this.games.get(roomId);
      if (game && game.status !== 'finished') {
        game.status = 'finished';
        game.winner = null; // Никто не побеждает при разрыве соединения
        
        // Обновляем в БД
        Game.findOneAndUpdate(
          { roomId },
          {
            status: 'finished',
            updatedAt: new Date()
          }
        ).exec();
        
        // Уведомляем других игроков в комнате
        this.io.to(roomId).emit('playerDisconnected', { message: 'Противник отключился' });
      }
    }
  }

  // Метод для получения состояния комнаты
  getRoomState(roomId) {
    if (!roomId) {
      console.log("GameService: Запрос состояния без ID комнаты");
      return { error: "ID комнаты не указан" };
    }

    try {
      // Проверяем, существует ли комната
      if (!this.games.get(roomId)) {
        console.log(`GameService: Комната ${roomId} не существует`);
        return { error: `Комната ${roomId} не существует` };
      }

      const game = this.games.get(roomId);
      
      // Создаем базовое состояние комнаты
      const state = {
        roomId,
        players: game.players.map(player => ({
          userId: player.userId,
          isReady: player.isReady || false,
          score: player.score || 0
        })),
        playersCount: game.players.length,
        status: game.status || 'selecting_cards', // Используем статус из комнаты или значение по умолчанию
        timestamp: new Date().toISOString()
      };

      console.log(`GameService: Получение статуса комнаты ${roomId}, статус: ${state.status}`);
      
      // Если игра в режиме боя, добавляем информацию о текущем ходе
      if (game.status === 'battle' && game.currentTurn) {
        state.currentTurn = {
          round: game.currentTurn.round,
          playerIndex: game.currentTurn.player,
          phase: game.currentTurn.phase
        };
      }
      
      // Если игра завершена, добавляем информацию о победителе и проигравшем
      if (game.status === 'finished' && game.winner) {
        state.winner = {
          userId: game.winner,
          score: game.players.find(player => player.userId === game.winner).score || 0
        };
        
        state.loser = {
          userId: game.players.find(player => player.userId !== game.winner).userId,
          score: game.players.find(player => player.userId !== game.winner).score || 0
        };
      }

      return state;
    } catch (error) {
      console.error(`GameService: Ошибка при получении состояния комнаты ${roomId}:`, error);
      return { error: `Ошибка при получении состояния комнаты: ${error.message}` };
    }
  }

  // Получение статуса комнаты
  getRoomStatus(roomId) {
    const game = this.games.get(roomId);
    if (!game) {
      return null;
    }
    return game.status;
  }

  // Обновить состояние комнаты и отправить всем игрокам
  updateAndBroadcastRoomState(roomId) {
    if (!roomId) return null;
    
    const roomState = this.getRoomState(roomId);
    if (roomState) {
      console.log('GameService: Отправка обновленного состояния всем в комнате:', roomId);
      this.io.to(roomId).emit('roomState', roomState);
    }
    
    return roomState;
  }
}

module.exports = GameService; 