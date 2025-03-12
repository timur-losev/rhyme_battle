import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();
  
  // Функция для перехода к просмотру карт (тестирование)
  const handleViewCards = () => {
    console.log('Переход к просмотру карт...');
    navigate('/test-cards');
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-6 text-red-500">404</h1>
        <h2 className="text-3xl font-bold mb-4">Страница не найдена</h2>
        <p className="text-lg text-gray-400 mb-8">
          Извините, запрашиваемая страница не существует или была удалена.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Вернуться на главную
          </Link>
          
          <button
            onClick={handleViewCards}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Просмотреть тестовые карты
          </button>
        </div>
        
        <div className="mt-12 p-4 bg-gray-800 rounded-lg inline-block">
          <p className="text-gray-400">
            Для отладки можно перейти к просмотру карт нажав кнопку выше
          </p>
        </div>
      </div>
    </div>
  );
}

export default NotFound; 