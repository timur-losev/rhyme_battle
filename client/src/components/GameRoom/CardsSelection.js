import React from 'react';
import CardSelector from '../Cards/CardSelector';

const CardsSelection = () => {
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Выбор карт для баттла</h2>
            <CardSelector />
        </div>
    );
};

export default CardsSelection; 