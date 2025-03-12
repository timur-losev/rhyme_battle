import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const CardCollection = () => {
  const { currentUser } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Заглушка для карт (в реальном приложении это были бы данные с сервера)
  const mockCards = [
    { id: 1, name: 'Огненный маг', type: 'attack', rarity: 'rare', power: 8, health: 5, img: 'https://via.placeholder.com/150/FF4433/FFFFFF?text=Fire+Mage' },
    { id: 2, name: 'Ледяной голем', type: 'defense', rarity: 'epic', power: 5, health: 12, img: 'https://via.placeholder.com/150/3344FF/FFFFFF?text=Ice+Golem' },
    { id: 3, name: 'Лесной эльф', type: 'support', rarity: 'common', power: 4, health: 6, img: 'https://via.placeholder.com/150/33AA33/FFFFFF?text=Forest+Elf' },
    { id: 4, name: 'Тёмный колдун', type: 'attack', rarity: 'legendary', power: 10, health: 7, img: 'https://via.placeholder.com/150/663399/FFFFFF?text=Dark+Wizard' },
    { id: 5, name: 'Целитель', type: 'support', rarity: 'common', power: 2, health: 8, img: 'https://via.placeholder.com/150/FFDD33/000000?text=Healer' },
    { id: 6, name: 'Каменный страж', type: 'defense', rarity: 'rare', power: 4, health: 10, img: 'https://via.placeholder.com/150/777777/FFFFFF?text=Stone+Guard' },
  ];

  useEffect(() => {
    // Имитация загрузки данных с сервера
    const fetchCards = async () => {
      try {
        setLoading(true);
        // В реальном приложении здесь был бы запрос к API
        setTimeout(() => {
          setCards(mockCards);
          setLoading(false);
        }, 1000);
      } catch (err) {
        console.error('Ошибка при загрузке карт:', err);
        setError('Не удалось загрузить коллекцию карт');
        setLoading(false);
      }
    };

    fetchCards();
  }, []);

  const filteredCards = cards
    .filter(card => {
      if (filter === 'all') return true;
      return card.type === filter;
    })
    .filter(card => 
      card.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'power') {
        return b.power - a.power;
      } else if (sortBy === 'health') {
        return b.health - a.health;
      } else if (sortBy === 'rarity') {
        const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4 };
        return rarityOrder[b.rarity] - rarityOrder[a.rarity];
      }
      return 0;
    });

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return 'text-gray-300';
      case 'rare': return 'text-blue-400';
      case 'epic': return 'text-purple-400';
      case 'legendary': return 'text-yellow-400';
      default: return 'text-white';
    }
  };

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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Моя коллекция карт</h1>
          <p className="text-gray-400">Всего карт: {cards.length}</p>
        </div>
        
        <button className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition">
          Открыть новый набор
        </button>
      </div>
      
      <div className="bg-gray-800 p-4 rounded-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="filter" className="block mb-2">Фильтр по типу</label>
            <select
              id="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
            >
              <option value="all">Все карты</option>
              <option value="attack">Атака</option>
              <option value="defense">Защита</option>
              <option value="support">Поддержка</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="search" className="block mb-2">Поиск</label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Название карты..."
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
            />
          </div>
          
          <div>
            <label htmlFor="sort" className="block mb-2">Сортировка</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
            >
              <option value="name">По имени</option>
              <option value="power">По силе</option>
              <option value="health">По здоровью</option>
              <option value="rarity">По редкости</option>
            </select>
          </div>
        </div>
      </div>
      
      {filteredCards.length === 0 ? (
        <div className="text-center p-8 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">Карты не найдены</h2>
          <p>Попробуйте изменить параметры фильтрации</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCards.map(card => (
            <div key={card.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105">
              <div className="h-48 bg-gray-700 relative flex justify-center items-center">
                <img src={card.img} alt={card.name} className="h-full w-full object-cover" />
                <span className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-bold ${getRarityColor(card.rarity)} bg-gray-900/80`}>
                  {card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}
                </span>
              </div>
              
              <div className="p-4">
                <h3 className="text-xl font-bold mb-2">{card.name}</h3>
                <div className="flex justify-between mb-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    card.type === 'attack' ? 'bg-red-900 text-red-300' :
                    card.type === 'defense' ? 'bg-blue-900 text-blue-300' :
                    'bg-green-900 text-green-300'
                  }`}>
                    {card.type === 'attack' ? 'Атака' :
                     card.type === 'defense' ? 'Защита' :
                     'Поддержка'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <div className="flex items-center">
                    <span className="text-red-400 mr-1">⚔️</span>
                    <span>{card.power}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-400 mr-1">❤️</span>
                    <span>{card.health}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-900 flex justify-between">
                <button className="text-blue-400 hover:underline text-sm">Детали</button>
                <button className="text-blue-400 hover:underline text-sm">В колоду</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CardCollection; 