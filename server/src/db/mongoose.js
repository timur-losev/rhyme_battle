const mongoose = require('mongoose');

// Подключение к MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rhyme-master';
    console.log('Попытка подключения к MongoDB:', mongoURI);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('MongoDB успешно подключена');
  } catch (err) {
    console.error('Ошибка подключения к MongoDB:', err.message);
    // Выход из процесса с ошибкой
    process.exit(1);
  }
};

module.exports = connectDB; 