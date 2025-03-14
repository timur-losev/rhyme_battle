import React from 'react';

const WaitingRoom = ({ gameState, currentRoom, currentUser }) => {
    return (
        <div className="bg-gray-800 p-8 rounded-lg text-center">
            <h2 className="text-2xl font-bold mb-6">Ожидание оппонента</h2>
            <div className="animate-pulse mb-6">
                <div className="inline-block w-16 h-16 bg-yellow-600 rounded-full"></div>
            </div>
            <p className="text-lg mb-8">
                Пригласите друга, отправив ему ID комнаты:
                <span className="font-mono bg-gray-700 px-2 py-1 rounded ml-2">{currentRoom}</span>
            </p>
            <div className="bg-gray-700 p-4 rounded-lg max-w-lg mx-auto">
                <p className="text-sm text-gray-300">
                    Оппонент должен нажать кнопку "Присоединиться к игре" на странице баттла
                    и ввести ID комнаты для начала игры.
                </p>
            </div>
        </div>
    );
};

export default WaitingRoom; 