import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CardSelector from '../components/Cards/CardSelector';
import { useGame } from '../contexts/GameContext';

function TestCards() {
  const navigate = useNavigate();
  const { loadCards, cardsCollection, loading } = useGame();

  // Принудительно загружаем карты при монтировании компонента
  useEffect(() => {
    console.log('TestCards: Компонент монтируется, проверяем наличие карт');
    
    if (cardsCollection.length === 0 && !loading) {
      console.log('TestCards: Карты не загружены, вызываем loadCards');
      loadCards().then(cards => {
        console.log(`TestCards: Загружено ${cards?.length || 0} карт`);
      }).catch(err => {
        console.error('TestCards: Ошибка загрузки карт:', err);
      });
    } else if (cardsCollection.length > 0) {
      console.log(`TestCards: Карты уже загружены (${cardsCollection.length} шт.)`);
    } else if (loading) {
      console.log('TestCards: Загрузка карт уже выполняется...');
    }
  }, [loadCards, cardsCollection.length, loading]);

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="test-cards-page">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Тестирование карт</h1>
        <button 
          onClick={handleBack}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          Вернуться на главную
        </button>
      </div>
      
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <p className="text-lg mb-2">Эта страница позволяет:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Просмотреть все доступные карты</li>
          <li>Протестировать загрузку карт</li>
          <li>Проверить отображение разных типов карт</li>
        </ul>
        
        <div className="mt-4 flex space-x-4">
          <button 
            onClick={() => loadCards()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            {loading ? 'Загрузка...' : 'Принудительно загрузить карты'}
          </button>
        </div>
      </div>
      
      <CardSelector />
    </div>
  );
}

export default TestCards; 