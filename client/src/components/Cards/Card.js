import React from 'react';
import PropTypes from 'prop-types';

const cardTypeColors = {
  attack: 'from-red-600 to-red-800',
  defense: 'from-blue-600 to-blue-800',
  combo: 'from-purple-600 to-purple-800',
  special: 'from-yellow-600 to-yellow-800'
};

const rarityStyles = {
  common: 'border-gray-300',
  uncommon: 'border-green-400',
  rare: 'border-blue-400',
  epic: 'border-purple-400',
  legendary: 'border-yellow-400 animate-pulse'
};

const Card = ({ card, isSelected, isPlayable, onClick, className }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(card);
    }
  };

  // Определение стиля карты на основе типа
  const getCardTypeColor = (type) => {
    switch (type) {
      case 'attack':
        return 'from-red-500 to-red-700 border-red-600';
      case 'defense':
        return 'from-blue-500 to-blue-700 border-blue-600';
      case 'combo':
        return 'from-purple-500 to-purple-700 border-purple-600';
      case 'special':
        return 'from-yellow-500 to-yellow-700 border-yellow-600';
      default:
        return 'from-gray-500 to-gray-700 border-gray-600';
    }
  };

  // Определение стиля редкости карты
  const getRarityStyle = (rarity) => {
    switch (rarity) {
      case 'legendary':
        return 'shadow-lg shadow-yellow-400 border-2 border-yellow-400';
      case 'epic':
        return 'shadow-md shadow-purple-400 border-2 border-purple-400';
      case 'rare':
        return 'shadow-md shadow-blue-400 border-2 border-blue-400';
      case 'uncommon':
        return 'shadow-sm shadow-green-400 border-2 border-green-400';
      case 'common':
      default:
        return 'shadow-sm shadow-gray-400 border-2 border-gray-400';
    }
  };

  return (
    <div 
      className={`
        card relative w-full max-w-xs rounded-lg overflow-hidden 
        bg-gradient-to-b ${getCardTypeColor(card.type)} 
        ${isSelected ? 'ring-4 ring-yellow-400' : ''}
        ${isPlayable ? 'cursor-pointer hover:opacity-90 transform hover:scale-105 transition-all' : 'opacity-70 cursor-not-allowed'}
        ${card.name.includes('ТЕСТОВАЯ') ? 'ring-4 ring-pink-600 animate-pulse' : ''}
        ${getRarityStyle(card.rarity)}
        m-2 transition-all duration-200
      `}
      onClick={() => isPlayable && onClick && onClick(card)}
    >
      {/* Заголовок карты */}
      <div className="card-header p-3 border-b border-gray-600 bg-black bg-opacity-50">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white truncate">{card.name}</h3>
          <span className="font-mono font-bold text-lg text-white">{card.power}</span>
        </div>
        <div className="text-sm text-gray-300 italic truncate">
          {card.type === 'attack' && 'Атака'}
          {card.type === 'defense' && 'Защита'}
          {card.type === 'combo' && 'Комбо'}
          {card.type === 'special' && 'Специальная'}
        </div>
      </div>
      
      {/* Изображение карты */}
      <div className="card-image h-40 bg-gray-800 overflow-hidden">
        <img 
          src={card.image} 
          alt={card.name} 
          className="w-full h-full object-cover"
          onError={(e) => {
            console.log(`Ошибка загрузки изображения для карты "${card.name}"`);
            e.target.onerror = null; // Предотвращаем бесконечный цикл
            e.target.src = '/images/cards/default.png'; // Заменяем на изображение по умолчанию
            if (!e.target.parentElement.querySelector('.image-error-message')) {
              const errorMessage = document.createElement('div');
              errorMessage.className = 'image-error-message absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-center text-red-400 p-2 text-sm';
              errorMessage.textContent = 'Изображение не удалось загрузить';
              e.target.parentElement.appendChild(errorMessage);
            }
          }}
        />
      </div>
      
      {/* Куплет карты */}
      <div className="card-couplet p-3 bg-black bg-opacity-60 border-t border-b border-gray-600">
        <p className="text-white text-sm italic font-serif">"{card.couplet}"</p>
      </div>
      
      {/* Описание карты */}
      <div className="card-description p-3 bg-black bg-opacity-40">
        <p className="text-white text-sm">{card.description}</p>
        
        {/* Эффекты карты */}
        {card.effects && card.effects.length > 0 && (
          <div className="mt-2">
            {card.effects.map((effect, idx) => (
              <div key={idx} className="text-xs text-gray-300 flex items-center mt-1">
                <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                <span>{effect.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Индикатор выбора */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="rounded-full bg-yellow-400 w-6 h-6 flex items-center justify-center text-black font-bold">
            ✓
          </div>
        </div>
      )}
    </div>
  );
};

Card.propTypes = {
  card: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string.isRequired,
    couplet: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['attack', 'defense', 'combo', 'special']).isRequired,
    power: PropTypes.number.isRequired,
    description: PropTypes.string.isRequired,
    effects: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string.isRequired,
        value: PropTypes.number,
        description: PropTypes.string.isRequired
      })
    ),
    image: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    rarity: PropTypes.oneOf(['common', 'uncommon', 'rare', 'epic', 'legendary'])
  }).isRequired,
  isSelected: PropTypes.bool,
  isPlayable: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string
};

Card.defaultProps = {
  isSelected: false,
  isPlayable: true
};

export default Card; 