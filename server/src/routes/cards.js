const express = require('express');
const router = express.Router();
const Card = require('../models/Card');

// Кэширование результатов для уменьшения нагрузки на базу данных
let cardsCache = null;
let lastCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут в миллисекундах

// Получить все карты
router.get('/', async (req, res) => {
  try {
    // Проверяем, есть ли актуальные данные в кэше
    const now = Date.now();
    if (cardsCache && lastCacheTime && (now - lastCacheTime < CACHE_DURATION)) {
      console.log('Отдаём карты из кэша');
      return res.json(cardsCache);
    }
    
    // Если кэша нет или он устарел, запрашиваем из базы
    console.log('Загрузка карт из базы данных');
    const cards = await Card.find();
    
    // Обновляем кэш
    cardsCache = cards;
    lastCacheTime = now;
    
    console.log(`Загружено ${cards.length} карт из базы данных`);
    res.json(cards);
  } catch (err) {
    console.error('Ошибка при получении карт:', err);
    res.status(500).json({ message: err.message });
  }
});

// Получить карту по ID
router.get('/:id', getCard, (req, res) => {
  res.json(res.card);
});

// Создать новую карту
router.post('/', async (req, res) => {
  const card = new Card({
    name: req.body.name,
    couplet: req.body.couplet,
    type: req.body.type,
    power: req.body.power,
    description: req.body.description,
    effects: req.body.effects,
    image: req.body.image,
    tags: req.body.tags,
    requiredTag: req.body.requiredTag,
    rarity: req.body.rarity
  });

  try {
    const newCard = await card.save();
    res.status(201).json(newCard);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Обновить карту
router.patch('/:id', getCard, async (req, res) => {
  if (req.body.name != null) {
    res.card.name = req.body.name;
  }
  if (req.body.couplet != null) {
    res.card.couplet = req.body.couplet;
  }
  if (req.body.type != null) {
    res.card.type = req.body.type;
  }
  if (req.body.power != null) {
    res.card.power = req.body.power;
  }
  if (req.body.description != null) {
    res.card.description = req.body.description;
  }
  if (req.body.effects != null) {
    res.card.effects = req.body.effects;
  }
  if (req.body.image != null) {
    res.card.image = req.body.image;
  }
  if (req.body.tags != null) {
    res.card.tags = req.body.tags;
  }
  if (req.body.requiredTag != null) {
    res.card.requiredTag = req.body.requiredTag;
  }
  if (req.body.rarity != null) {
    res.card.rarity = req.body.rarity;
  }

  try {
    const updatedCard = await res.card.save();
    res.json(updatedCard);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Удалить карту
router.delete('/:id', getCard, async (req, res) => {
  try {
    await res.card.remove();
    res.json({ message: 'Карта удалена' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Middleware для получения карты по ID
async function getCard(req, res, next) {
  let card;
  try {
    card = await Card.findById(req.params.id);
    if (card == null) {
      return res.status(404).json({ message: 'Карта не найдена' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.card = card;
  next();
}

module.exports = router; 