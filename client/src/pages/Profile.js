import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { id } = useParams();
  const { currentUser, getUserProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    rating: 1000
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const userData = await getUserProfile(id);
        setProfile(userData);
        
        // Здесь мы бы загрузили статистику с сервера
        // Для примера используем заглушку
        setStats({
          wins: 15,
          losses: 7,
          draws: 3,
          winRate: Math.round(15 / (15 + 7 + 3) * 100),
          rating: 1250
        });
      } catch (err) {
        console.error('Ошибка при загрузке профиля:', err);
        setError('Не удалось загрузить профиль. Пожалуйста, попробуйте снова позже.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, getUserProfile]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500 text-white p-4 rounded-lg">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Пользователь не найден</h1>
      </div>
    );
  }

  const isCurrentUser = currentUser && currentUser.id === profile.id;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center text-3xl font-bold">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          
          <div>
            <h1 className="text-3xl font-bold">{profile.username}</h1>
            <p className="text-gray-400">{profile.email}</p>
            <p className="mt-2">На сайте с {new Date(profile.createdAt).toLocaleDateString()}</p>
          </div>
          
          {isCurrentUser && (
            <button className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition">
              Редактировать профиль
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Статистика</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-400">Рейтинг</p>
              <p className="text-2xl font-bold">{stats.rating}</p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-400">Винрейт</p>
              <p className="text-2xl font-bold">{stats.winRate}%</p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-400">Побед</p>
              <p className="text-2xl font-bold text-green-500">{stats.wins}</p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-400">Поражений</p>
              <p className="text-2xl font-bold text-red-500">{stats.losses}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Достижения</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg flex items-center">
              <div className="w-12 h-12 bg-yellow-600 rounded-full mr-3 flex items-center justify-center">
                🏆
              </div>
              <div>
                <p className="font-bold">Первая победа</p>
                <p className="text-sm text-gray-400">Выиграйте свой первый бой</p>
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg flex items-center opacity-50">
              <div className="w-12 h-12 bg-gray-600 rounded-full mr-3 flex items-center justify-center">
                🎮
              </div>
              <div>
                <p className="font-bold">Коллекционер</p>
                <p className="text-sm text-gray-400">Соберите 50 карт</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Недавние игры</h2>
        <div className="space-y-4">
          <div className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
            <div>
              <p className="font-bold text-green-500">Победа</p>
              <p className="text-sm text-gray-400">против Player123</p>
            </div>
            <div className="text-right">
              <p className="font-bold">+15 рейтинга</p>
              <p className="text-sm text-gray-400">13 мин. назад</p>
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
            <div>
              <p className="font-bold text-red-500">Поражение</p>
              <p className="text-sm text-gray-400">против MasterGamer</p>
            </div>
            <div className="text-right">
              <p className="font-bold">-8 рейтинга</p>
              <p className="text-sm text-gray-400">2 часа назад</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 