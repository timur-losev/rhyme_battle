import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';

function Home() {
  const { currentUser } = useAuth();
  const { createRoom, loadCards, cardsCollection, error, isConnected } = useGame();
  const navigate = useNavigate();

  // Загрузка карт при монтировании компонента
  useEffect(() => {
    // Принудительно загружаем карты для тестирования
    if (cardsCollection.length === 0) {
      console.log('Home: Автоматическая загрузка карт');
      loadCards().then(cards => {
        console.log(`Home: Загружено ${cards?.length || 0} тестовых карт`);
      });
    } else {
      console.log(`Home: Карты уже загружены (${cardsCollection.length} штук)`);
    }
  }, []);
  
  // Функция для создания новой комнаты
  const handleCreateRoom = () => {
    if (!currentUser) {
      console.log('Невозможно создать комнату: пользователь не авторизован');
      navigate('/login');
      return;
    }
    
    console.log('Создание новой комнаты...');
    createRoom();
  };
  
  // Функция для перехода к просмотру карт (тестирование)
  const handleViewCards = () => {
    console.log('Переход к просмотру карт...');
    navigate('/test-cards');
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          Баттл Рэп Ритмов
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Собери свою колоду, сразись с противниками и стань лучшим мастером рэп-баттлов!
        </p>
        
        {/* Статус загрузки карт */}
        <div className="mb-4 text-sm bg-gray-800 inline-block px-4 py-2 rounded-lg">
          <p>Статус соединения: {isConnected ? (
            <span className="text-green-400">Подключено</span>
          ) : (
            <span className="text-red-400">Не подключено</span>
          )}</p>
          <p>Карты: {cardsCollection.length > 0 ? (
            <span className="text-green-400">Загружено {cardsCollection.length} карт</span>
          ) : (
            <span className="text-yellow-400">Не загружены</span>
          )}</p>
          {error && <p className="text-red-400">Ошибка: {error}</p>}
        </div>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
          {currentUser ? (
            <button
              onClick={handleCreateRoom}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex-1 max-w-xs mx-auto"
            >
              Создать комнату
            </button>
          ) : (
            <Link 
              to="/login" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex-1 max-w-xs mx-auto flex items-center justify-center"
            >
              Войти в игру
            </Link>
          )}
          
          {/* Кнопка для тестирования карт */}
          <button
            onClick={handleViewCards}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex-1 max-w-xs mx-auto"
          >
            Просмотр тестовых карт
          </button>
        </div>
        
        {/* Тестовый блок с информацией о количестве загруженных карт */}
        <div className="bg-gray-800 p-4 rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-2">Состояние тестовых карт</h2>
          {cardsCollection.length > 0 ? (
            <div className="text-green-400">
              <p>✅ Тестовые карты успешно загружены!</p>
              <p>Количество карт: {cardsCollection.length}</p>
              <p className="text-sm text-gray-400 mt-1">
                (Нажмите кнопку "Просмотр тестовых карт" для отображения)
              </p>
            </div>
          ) : (
            <div className="text-yellow-400">
              <p>⚠️ Тестовые карты еще не загружены</p>
              <p className="text-sm text-gray-400 mt-1">
                При переходе к просмотру карт они будут загружены автоматически
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Как играть?</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Создайте новую комнату или присоединитесь к существующей</li>
            <li>Выберите 5 карт для баттла из своей коллекции</li>
            <li>По очереди разыгрывайте карты против оппонента</li>
            <li>Используйте комбинации и специальные эффекты</li>
            <li>Побеждает игрок, который наберет больше очков!</li>
          </ol>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Типы карт</h2>
          <ul className="space-y-3">
            <li className="flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              <span className="font-bold text-red-400 mr-2">Атака:</span>
              <span>Наносит урон противнику</span>
            </li>
            <li className="flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              <span className="font-bold text-blue-400 mr-2">Защита:</span>
              <span>Блокирует урон от атак противника</span>
            </li>
            <li className="flex items-center">
              <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
              <span className="font-bold text-purple-400 mr-2">Комбо:</span>
              <span>Позволяет разыграть дополнительные карты</span>
            </li>
            <li className="flex items-center">
              <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
              <span className="font-bold text-yellow-400 mr-2">Специальные:</span>
              <span>Уникальные эффекты, меняющие ход игры</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Home; 