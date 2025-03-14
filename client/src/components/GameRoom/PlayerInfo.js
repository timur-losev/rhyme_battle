import React from 'react';

const PlayerInfo = ({ player, isCurrentPlayer }) => {
    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-2">
                {isCurrentPlayer ? 'Вы' : 'Соперник'}
                {player && player.username && ` (${player.username})`}
            </h3>
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {player && player.username ? player.username.charAt(0).toUpperCase() : '?'}
                </div>
                <div>
                    <div className="text-sm text-gray-400">Здоровье</div>
                    <div className="text-lg font-bold">{player?.health || 10}/10</div>
                </div>
            </div>
        </div>
    );
};

export default PlayerInfo; 