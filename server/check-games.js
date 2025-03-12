require('dotenv').config();
const mongoose = require('mongoose');
const Game = require('./src/models/Game');

async function checkGames() {
  try {
    console.log('Подключение к MongoDB...');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rhyme-master';
    console.log('URI: ', mongoURI);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Подключение к MongoDB успешно');
    
    // Проверка количества игр
    const gamesCount = await Game.countDocuments();
    console.log(`В базе данных найдено ${gamesCount} игр`);
    
    // Получение всех игр
    if (gamesCount > 0) {
      const games = await Game.find();
      console.log('Список игровых комнат:');
      games.forEach(game => {
        console.log(`
ID комнаты: ${game.roomId}
Статус: ${game.status}
Игроки: ${game.players.length}
ID игроков: ${game.players.map(p => p.userId).join(', ')}
Обновлено: ${game.updatedAt}
-----------------------------`);
      });
    }
    
    // Попытка создать новую игру напрямую в БД
    const demoGameId = `demo-${Date.now()}`;
    const newGame = new Game({
      roomId: demoGameId,
      players: [{
        userId: new mongoose.Types.ObjectId(),
        selectedCards: [],
        score: 0,
        isReady: false
      }],
      status: 'waiting'
    });
    
    await newGame.save();
    console.log(`Демо-игра создана успешно с ID: ${demoGameId}`);
    
  } catch (err) {
    console.error('Ошибка при работе с играми:', err);
  } finally {
    await mongoose.connection.close();
    console.log('Соединение с MongoDB закрыто');
  }
}

checkGames(); 