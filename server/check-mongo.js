const { MongoClient } = require('mongodb');

async function checkMongoConnection() {
  const url = 'mongodb://localhost:27017';
  const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    console.log('Проверка соединения с MongoDB...');
    await client.connect();
    
    console.log('✅ Успешное подключение к MongoDB!');
    
    const dbs = await client.db().admin().listDatabases();
    console.log('Доступные базы данных:');
    dbs.databases.forEach(db => {
      console.log(` - ${db.name}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    console.log('\nВозможные решения:');
    console.log('1. Убедитесь, что MongoDB запущена');
    console.log('2. Проверьте URL подключения');
    console.log('3. Если вы используете MongoDB Atlas, проверьте сетевой доступ и настройки кластера');
    
    return false;
  } finally {
    await client.close();
  }
}

checkMongoConnection()
  .then(success => {
    if (!success) {
      console.log('\nКоманды для запуска MongoDB:');
      console.log('- macOS: brew services start mongodb-community');
      console.log('- Windows: запустите MongoDB из "Services" или через MongoDB Compass');
      console.log('- Linux: sudo systemctl start mongod');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Ошибка при выполнении проверки:', err);
    process.exit(1);
  }); 