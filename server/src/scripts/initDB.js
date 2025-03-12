/**
 * Скрипт для инициализации базы данных тестовыми данными
 * Запуск: node src/scripts/initDB.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Card = require('../models/Card');
const User = require('../models/User');
const demoCards = require('../data/cards');
const bcrypt = require('bcryptjs');

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rhyme-master', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB подключена'))
.catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Очистка и заполнение коллекции карт
async function initCards() {
  try {
    // Очистка коллекции
    await Card.deleteMany({});
    console.log('Коллекция карт очищена');
    
    // Вставка демо-карт
    const insertedCards = await Card.insertMany(demoCards);
    console.log(`Добавлено ${insertedCards.length} демо-карт`);
    
    return insertedCards;
  } catch (err) {
    console.error('Ошибка при инициализации карт:', err);
    throw err;
  }
}

// Создание тестовых пользователей
async function initUsers() {
  try {
    // Очистка коллекции пользователей
    await User.deleteMany({});
    console.log('Коллекция пользователей очищена');
    
    const plainPassword1 = 'password123';
    const plainPassword2 = 'password456';
    console.log('Создаем пользователей с паролями:', { player1: plainPassword1, player2: plainPassword2 });
    
    // Хеширование паролей
    const salt = await bcrypt.genSalt(10);
    const hashedPassword1 = await bcrypt.hash(plainPassword1, salt);
    const hashedPassword2 = await bcrypt.hash(plainPassword2, salt);
    
    // Проверка хеширования
    console.log('Хеш пароля player1:', hashedPassword1);
    console.log('Хеш пароля player2:', hashedPassword2);
    
    // Создание двух тестовых пользователей
    const user1 = new User({
      username: 'player1',
      email: 'player1@example.com',
      password: hashedPassword1,
      avatar: '/images/avatars/player1.png',
      stats: {
        gamesPlayed: 10,
        gamesWon: 6,
        totalScore: 154
      }
    });
    
    const user2 = new User({
      username: 'player2',
      email: 'player2@example.com',
      password: hashedPassword2,
      avatar: '/images/avatars/player2.png',
      stats: {
        gamesPlayed: 8,
        gamesWon: 3,
        totalScore: 112
      }
    });
    
    const savedUser1 = await user1.save();
    const savedUser2 = await user2.save();
    
    console.log('Созданы тестовые пользователи:');
    console.log('- player1:', { id: savedUser1._id, email: savedUser1.email });
    console.log('- player2:', { id: savedUser2._id, email: savedUser2.email });
    
    // Проверка, что можем найти пользователя
    const foundUser = await User.findOne({ email: 'player1@example.com' });
    if (foundUser) {
      console.log('Пользователь player1 успешно найден в базе');
    } else {
      console.log('ОШИБКА: Пользователь player1 не найден в базе после создания!');
    }
    
    return [savedUser1, savedUser2];
  } catch (err) {
    console.error('Ошибка при создании тестовых пользователей:', err);
    throw err;
  }
}

// Главная функция инициализации
async function initDatabase() {
  try {
    const cards = await initCards();
    const users = await initUsers();
    
    // Добавление избранных карт пользователям
    const user1FavoriteCards = cards.slice(0, 3).map(card => card._id);
    const user2FavoriteCards = cards.slice(3, 6).map(card => card._id);
    
    await User.findByIdAndUpdate(users[0]._id, {
      'stats.favoriteCards': user1FavoriteCards
    });
    
    await User.findByIdAndUpdate(users[1]._id, {
      'stats.favoriteCards': user2FavoriteCards
    });
    
    console.log('Избранные карты добавлены пользователям');
    console.log('База данных успешно инициализирована');
    
    // Тестирование входа
    console.log('\nТестирование входа:');
    const user = await User.findOne({ email: 'player1@example.com' });
    if (user) {
      const validPassword = await bcrypt.compare('password123', user.password);
      console.log('Проверка пароля для player1:', { validPassword });
      if (!validPassword) {
        console.log('ВНИМАНИЕ: Пароль не совпадает с хешем! Вход будет невозможен.');
      }
    }
    
    // Закрытие соединения с базой данных
    mongoose.connection.close();
  } catch (err) {
    console.error('Ошибка при инициализации базы данных:', err);
    process.exit(1);
  }
}

// Запуск инициализации
initDatabase(); 