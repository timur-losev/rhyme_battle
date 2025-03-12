const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    selectedCards: [{
      type: mongoose.Schema.Types.Mixed,
      ref: 'Card'
    }],
    score: {
      type: Number,
      default: 0
    },
    isReady: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['waiting', 'cards_selection', 'battle', 'finished'],
    default: 'waiting'
  },
  currentTurn: {
    player: {
      type: Number,
      default: 0
    },
    round: {
      type: Number,
      default: 1
    },
    phase: {
      type: String,
      enum: ['attack', 'defense', 'effect'],
      default: 'attack'
    }
  },
  battleLog: [{
    round: Number,
    player: Number,
    cardPlayed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card'
    },
    targetCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card'
    },
    effect: {
      type: String,
      enum: ['attack', 'defense', 'combo', 'special']
    },
    points: Number,
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  specialEvents: [{
    round: Number,
    eventType: {
      type: String,
      enum: ['double_points', 'card_restriction', 'theme_change', 'random_effect']
    },
    description: String,
    active: Boolean
  }],
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Логируем информацию о валидации при сохранении
GameSchema.pre('save', function(next) {
  console.log('Сохранение игры:', {
    roomId: this.roomId,
    playersCount: this.players.length,
    playerIds: this.players.map(p => p.userId),
    status: this.status
  });
  
  if (this.players.length > 2) {
    const error = new Error('Игра не может иметь более 2 игроков');
    console.error('Ошибка валидации игры:', error.message);
    return next(error);
  }
  
  next();
});

// Логируем ошибки при сохранении
GameSchema.post('save', function(doc, next) {
  console.log('Игра успешно сохранена:', doc.roomId);
  next();
});

GameSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('Ошибка при сохранении игры:', error);
    next(error);
  } else {
    next();
  }
});

const Game = mongoose.model('Game', GameSchema);

module.exports = Game; 