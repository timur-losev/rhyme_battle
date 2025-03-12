const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  couplet: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['attack', 'defense', 'combo', 'special'],
    required: true
  },
  power: {
    type: Number,
    required: true,
    default: 3
  },
  description: {
    type: String,
    required: true
  },
  effects: [{
    type: {
      type: String,
      enum: ['damage', 'block', 'combo', 'cancel_combo', 'chain', 'double_points', 'special'],
      required: true
    },
    value: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      required: true
    }
  }],
  image: {
    type: String,
    default: '/images/cards/default.png'
  },
  tags: [{
    type: String
  }],
  requiredTag: {
    type: String,
    default: null
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Card', CardSchema); 