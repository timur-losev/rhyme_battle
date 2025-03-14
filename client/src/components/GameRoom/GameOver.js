import React from 'react';

const GameOver = ({ results, userId, onPlayAgain }) => {
    const isWinner = results.winner && results.winner.userId === userId;

    return (
        <div className={`${isWinner ? 'bg-green-900' : 'bg-red-900'} bg-opacity-40 p-8 rounded-lg text-center`}>
            <h2 className="text-3xl font-bold mb-6">
                {isWinner ? '🏆 Вы победили! 🏆' : '😞 Вы проиграли 😞'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-xl font-bold mb-2">Ваш счёт</h3>
                    <p className="text-3xl font-bold">
                        {isWinner && results.winner && results.winner.score ? results.winner.score : 0}
                    </p>
                </div>

                <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-xl font-bold mb-2">Счёт противника</h3>
                    <p className="text-3xl font-bold">
                        {!isWinner && results.winner && results.winner.score ? results.winner.score : 0}
                    </p>
                </div>
            </div>

            <button
                onClick={onPlayAgain}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white text-lg font-bold"
            >
                Вернуться в лобби
            </button>
        </div>
    );
};

export default GameOver; 