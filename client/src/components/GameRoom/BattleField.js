import React from 'react';

const BattleField = ({ gameState, currentUser }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">Поле боя</h3>
            <div className="flex justify-center items-center h-32 bg-gray-700 rounded-lg">
                <p className="text-gray-400">Здесь будет отображаться игровой процесс</p>
            </div>
        </div>
    );
};

export default BattleField; 