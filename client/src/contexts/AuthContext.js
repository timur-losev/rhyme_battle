import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Установим базовый URL для API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5101';
console.log('API URL:', API_URL);

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Загрузка пользователя из localStorage при инициализации
  useEffect(() => {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (user && token) {
      setCurrentUser(JSON.parse(user));
      // Установка токена в заголовках по умолчанию
      axios.defaults.headers.common['auth-token'] = token;
    }
    
    setLoading(false);
  }, []);

  // Регистрация пользователя
  const register = async (userData) => {
    try {
      setError('');
      const response = await axios.post(`${API_URL}/api/users/register`, userData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка регистрации');
      throw err;
    }
  };

  // Вход пользователя
  const login = async (email, password) => {
    try {
      setError('');
      console.log('Попытка входа:', { email, url: `${API_URL}/api/users/login` });
      
      const response = await axios.post(`${API_URL}/api/users/login`, { email, password });
      console.log('Результат входа:', response.data);
      
      const { token, user } = response.data;
      
      // Сохранение в localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Установка текущего пользователя
      setCurrentUser(user);
      
      // Установка токена в заголовках по умолчанию
      axios.defaults.headers.common['auth-token'] = token;
      
      return user;
    } catch (err) {
      console.error('Ошибка при входе:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Ошибка входа');
      throw err;
    }
  };

  // Выход пользователя
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    delete axios.defaults.headers.common['auth-token'];
  };

  // Обновление профиля пользователя
  const updateProfile = async (userId, userData) => {
    try {
      setError('');
      const response = await axios.patch(`${API_URL}/api/users/profile/${userId}`, userData);
      
      // Обновление данных пользователя в state и localStorage
      const updatedUser = { ...currentUser, ...response.data };
      setCurrentUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка обновления профиля');
      throw err;
    }
  };

  // Получение профиля пользователя
  const getProfile = async (userId) => {
    try {
      setError('');
      const response = await axios.get(`${API_URL}/api/users/profile/${userId}`);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка получения профиля');
      throw err;
    }
  };

  const value = {
    currentUser,
    loading,
    error,
    register,
    login,
    logout,
    updateProfile,
    getProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 