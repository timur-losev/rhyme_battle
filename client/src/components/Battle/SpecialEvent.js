import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

const eventTypeIcons = {
  'double_points': '✖️2',
  'card_restriction': '🚫',
  'theme_change': '🔄',
  'random_effect': '🎲'
};

const eventTypeColors = {
  'double_points': 'from-yellow-500 to-orange-600',
  'card_restriction': 'from-red-500 to-red-600',
  'theme_change': 'from-blue-500 to-indigo-600',
  'random_effect': 'from-purple-500 to-pink-600'
};

const SpecialEvent = ({ event, onClose }) => {
  useEffect(() => {
    // Автоматическое закрытие уведомления через 5 секунд
    const timer = setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-0 left-0 right-0 flex justify-center items-start p-4 z-50 animate-slideDown">
      <div className={`bg-gradient-to-r ${eventTypeColors[event.eventType] || 'from-gray-700 to-gray-800'} 
                      rounded-lg shadow-lg p-4 max-w-md w-full`}>
        <div className="flex items-start">
          <div className="flex-shrink-0 p-3 mr-3 bg-black bg-opacity-30 rounded-full">
            <span className="text-2xl">{eventTypeIcons[event.eventType] || '🎯'}</span>
          </div>
          
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2 text-white">Специальное событие в раунде {event.round}</h3>
            <p className="text-white mb-2">{event.description}</p>
            
            {/* Дополнительные инструкции в зависимости от типа события */}
            {event.eventType === 'double_points' && (
              <p className="text-yellow-200 text-sm italic">
                Все очки, полученные в этом раунде, будут удвоены!
              </p>
            )}
            
            {event.eventType === 'card_restriction' && (
              <p className="text-red-200 text-sm italic">
                Некоторые карты могут быть ограничены в использовании!
              </p>
            )}
            
            {event.eventType === 'theme_change' && (
              <p className="text-blue-200 text-sm italic">
                Тема баттла изменилась - некоторые карты могут получить бонусы!
              </p>
            )}
            
            {event.eventType === 'random_effect' && (
              <p className="text-purple-200 text-sm italic">
                Случайный эффект повлияет на этот раунд!
              </p>
            )}
          </div>
          
          <button 
            onClick={onClose}
            className="ml-2 text-white hover:text-gray-300 p-1 focus:outline-none"
            aria-label="Закрыть"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

SpecialEvent.propTypes = {
  event: PropTypes.shape({
    round: PropTypes.number.isRequired,
    eventType: PropTypes.oneOf(['double_points', 'card_restriction', 'theme_change', 'random_effect']).isRequired,
    description: PropTypes.string.isRequired,
    active: PropTypes.bool
  }).isRequired,
  onClose: PropTypes.func
};

export default SpecialEvent; 