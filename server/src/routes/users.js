const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Регистрация пользователя
router.post('/register', async (req, res) => {
  // Проверка, существует ли пользователь
  const emailExists = await User.findOne({ email: req.body.email });
  if (emailExists) {
    return res.status(400).json({ message: 'Email уже используется' });
  }

  const usernameExists = await User.findOne({ username: req.body.username });
  if (usernameExists) {
    return res.status(400).json({ message: 'Имя пользователя уже занято' });
  }

  // Хеширование пароля
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.password, salt);

  // Создание нового пользователя
  const user = new User({
    username: req.body.username,
    email: req.body.email,
    password: hashedPassword,
    avatar: req.body.avatar || '/images/avatars/default.png'
  });

  try {
    const savedUser = await user.save();
    // Исключаем пароль из ответа
    const { password, ...userWithoutPassword } = savedUser.toObject();
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Авторизация пользователя
router.post('/login', async (req, res) => {
  console.log('Попытка входа:', { email: req.body.email });
  
  // Проверка существования пользователя
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    console.log('Пользователь не найден:', req.body.email);
    return res.status(400).json({ message: 'Email или пароль неверны' });
  }

  console.log('Пользователь найден:', { id: user._id, email: user.email });

  // Проверка пароля
  try {
    const validPassword = await bcrypt.compare(req.body.password, user.password);
    console.log('Проверка пароля:', { validPassword });
    
    if (!validPassword) {
      return res.status(400).json({ message: 'Email или пароль неверны' });
    }

    // Создание и назначение токена
    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET || 'default_secret_key');
    res.header('auth-token', token).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Ошибка при авторизации:', err);
    res.status(500).json({ message: 'Ошибка сервера при авторизации' });
  }
});

// Получить профиль пользователя
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Обновить профиль пользователя
router.patch('/profile/:id', verifyToken, async (req, res) => {
  // Проверка, что пользователь обновляет свой собственный профиль
  if (req.params.id !== req.user._id) {
    return res.status(403).json({ message: 'Нет доступа к редактированию этого профиля' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          username: req.body.username,
          avatar: req.body.avatar
        }
      },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Middleware для проверки токена
function verifyToken(req, res, next) {
  const token = req.header('auth-token');
  if (!token) return res.status(401).json({ message: 'Доступ запрещен' });

  try {
    const verified = jwt.verify(token, process.env.TOKEN_SECRET || 'default_secret_key');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Неверный токен' });
  }
}

module.exports = router; 