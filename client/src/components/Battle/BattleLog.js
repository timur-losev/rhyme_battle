import React from 'react';
import PropTypes from 'prop-types';

const BattleLog = ({ logs, currentRound, playerIndex }) => {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 h-full">
        <h3 className="text-xl font-bold mb-4">Лог боя</h3>
        <div className="text-gray-400 italic">Бой еще не начался</div>
      </div>
    );
  }

  // Группировка логов по раундам
  const logsByRound = logs.reduce((acc, log) => {
    if (!acc[log.round]) {
      acc[log.round] = [];
    }
    acc[log.round].push(log);
    return acc;
  }, {});

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full max-h-[600px] overflow-y-auto">
      <h3 className="text-xl font-bold mb-4">Лог боя</h3>
      
      {Object.keys(logsByRound)
        .sort((a, b) => b - a) // Сортировка раундов в обратном порядке
        .map(round => (
          <div key={`round-${round}`} className="mb-4">
            <h4 className={`font-bold mb-2 ${round == currentRound ? 'text-yellow-400' : 'text-gray-400'}`}>
              Раунд {round}
            </h4>
            
            <div className="space-y-2">
              {logsByRound[round]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Сортировка ходов в обратном порядке
                .map((log, index) => {
                  const isPlayerMove = log.player === playerIndex;
                  
                  return (
                    <div 
                      key={`log-${round}-${index}`} 
                      className={`p-3 rounded-lg ${
                        isPlayerMove 
                          ? 'bg-blue-900 bg-opacity-50 border-l-4 border-blue-500' 
                          : 'bg-purple-900 bg-opacity-50 border-l-4 border-purple-500'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold">
                          {isPlayerMove ? 'Вы' : 'Противник'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${getEffectColor(log.effect)}`}>
                          {formatEffectType(log.effect)}
                        </span>
                      </div>
                      
                      <p className="text-sm mb-1">{log.description}</p>
                      
                      {log.points && (
                        <div className="flex justify-end">
                          <span className="bg-black bg-opacity-30 px-2 py-1 rounded text-xs">
                            {isPlayerMove ? '+' : '-'}{log.points} очков
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
};

// Вспомогательная функция для форматирования типа эффекта
const formatEffectType = (effectType) => {
  switch (effectType) {
    case 'attack':
      return 'Атака';
    case 'defense':
      return 'Защита';
    case 'combo':
      return 'Комбо';
    case 'special':
      return 'Особый';
    default:
      return 'Ход';
  }
};

// Вспомогательная функция для определения цвета эффекта
const getEffectColor = (effectType) => {
  switch (effectType) {
    case 'attack':
      return 'bg-red-700';
    case 'defense':
      return 'bg-blue-700';
    case 'combo':
      return 'bg-purple-700';
    case 'special':
      return 'bg-yellow-700';
    default:
      return 'bg-gray-700';
  }
};

BattleLog.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      round: PropTypes.number.isRequired,
      player: PropTypes.number.isRequired,
      cardPlayed: PropTypes.string,
      targetCard: PropTypes.string,
      effect: PropTypes.string,
      points: PropTypes.number,
      description: PropTypes.string,
      timestamp: PropTypes.oneOfType([
        PropTypes.string, 
        PropTypes.instanceOf(Date)
      ])
    })
  ),
  currentRound: PropTypes.number,
  playerIndex: PropTypes.number.isRequired
};

BattleLog.defaultProps = {
  logs: [],
  currentRound: 1
};

export default BattleLog; 