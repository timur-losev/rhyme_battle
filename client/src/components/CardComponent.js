import React from 'react';
import '../styles/cards.css';

const CardComponent = ({ card, onClick, isSelected }) => {
  // Определяем класс редкости карты
  const getRarityClass = () => {
    if (!card || !card.rarity) return 'card-default';
    
    switch(card.rarity.toLowerCase()) {
      case 'common': return 'card-common';
      case 'rare': return 'card-rare';
      case 'epic': return 'card-epic';
      case 'legendary': return 'card-legendary';
      default: return 'card-default';
    }
  };
  
  // Если карта не определена, показываем пустой слот
  if (!card) {
    return (
      <div className={`card card-default empty-card`} onClick={() => onClick && onClick(null)}>
        <div className="card-content"></div>
      </div>
    );
  }
  
  return (
    <div 
      className={`card ${getRarityClass()} ${isSelected ? 'selected' : ''}`} 
      onClick={() => onClick && onClick(card)}
      title={card.name}
    >
      <div className="card-header">{card.name}</div>
      <div className="card-content"></div>
      <div className="card-footer">
        <span>{card.type}</span>
        <span>{card.power}</span>
      </div>
      <div className="rarity-indicator"></div>
    </div>
  );
};

export default CardComponent; 