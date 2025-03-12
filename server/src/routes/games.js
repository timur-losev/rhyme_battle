const express = require('express');
const router = express.Router();
const Game = require('../models/Game');

// Добавляем тестовый маршрут для создания комнаты через HTTP
router.post('/create-test', async (req, res) => {
  try {
    if (!req.body.userId) {
      return res.status(400).json({ error: 'Необходимо указать userId' });
    }
    
    console.log('Тестовое создание комнаты для пользователя:', req.body.userId);
    
    // Создание комнаты с уникальным ID
    const roomId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const newGame = new Game({
      roomId,
      players: [{
        userId: req.body.userId,
        selectedCards: [],
        score: 0,
        isReady: false
      }],
      status: 'waiting'
    });
    
    await newGame.save();
    console.log('Тестовая комната успешно создана:', roomId);
    
    res.json({ 
      success: true, 
      roomId, 
      message: 'Комната успешно создана через HTTP API'
    });
  } catch (err) {
    console.error('Ошибка при создании тестовой комнаты:', err);
    res.status(500).json({ error: err.message });
  }
});

// Получить все активные игры
router.get('/', async (req, res) => {
  try {
    const games = await Game.find({ status: { $ne: 'finished' } })
      .populate('players.userId', 'username')
      .populate('winner', 'username');
    
    res.json(games);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Получить игру по ID
router.get('/:id', getGame, (req, res) => {
  res.json(res.game);
});

// Получить детальную информацию об игре
router.get('/:id/details', async (req, res) => {
  try {
    const game = await Game.findOne({ roomId: req.params.id })
      .populate('players.userId', 'username')
      .populate('players.selectedCards')
      .populate('winner', 'username')
      .populate('battleLog.cardPlayed')
      .populate('battleLog.targetCard');
    
    if (!game) {
      return res.status(404).json({ message: 'Игра не найдена' });
    }
    
    res.json(game);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Получить историю игр пользователя
router.get('/user/:userId', async (req, res) => {
  try {
    const games = await Game.find({ 
      'players.userId': req.params.userId,
      'status': 'finished' 
    })
      .populate('players.userId', 'username')
      .populate('winner', 'username')
      .sort({ updatedAt: -1 });
    
    res.json(games);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Middleware для получения игры по ID
async function getGame(req, res, next) {
  let game;
  try {
    game = await Game.findOne({ roomId: req.params.id })
      .populate('players.userId', 'username')
      .populate('winner', 'username');
    
    if (game == null) {
      return res.status(404).json({ message: 'Игра не найдена' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.game = game;
  next();
}

module.exports = router; 