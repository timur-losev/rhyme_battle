import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GameProvider, useGame } from './contexts/GameContext';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import CardCollection from './pages/CardCollection';
import Battle from './pages/Battle';
import GameRoom from './pages/GameRoom';
import NotFound from './pages/NotFound';
import CardSelector from './components/Cards/CardSelector';

import Header from './components/UI/Header';
import Footer from './components/UI/Footer';
import PrivateRoute from './components/UI/PrivateRoute';

import './App.css';
import addDefaultCardImage from './utils/generateDefaultCard';

// Компонент для принудительной загрузки карт при запуске приложения
const CardsInitializer = () => {
  const { loadCards, cardsCollection } = useGame();
  
  useEffect(() => {
    // Принудительная загрузка карт при запуске приложения
    console.log('🚀 App: Принудительная инициализация карт при запуске');
    
    // Проверяем, загружены ли уже карты
    if (!cardsCollection || cardsCollection.length === 0) {
      console.log('🚀 App: Карты не загружены, вызываем loadCards');
      
      // Вызываем loadCards для загрузки карт
      loadCards().then(cards => {
        console.log(`🚀 App: Загружено ${cards?.length || 0} карт при инициализации`);
      }).catch(err => {
        console.error('🚀 App: Ошибка загрузки карт при инициализации:', err);
      });
    } else {
      console.log(`🚀 App: Карты уже загружены (${cardsCollection.length} штук)`);
    }
  }, [loadCards, cardsCollection]);
  
  return null; // Этот компонент не рендерит ничего
};

// Оборачивающий компонент для отображения тестового баннера
const TestBanner = ({ children }) => {
  return (
    <div className="relative">
      {/* Тестовый баннер */}
      <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-1 text-center z-50 text-sm">
        ⚠️ ТЕСТОВЫЙ РЕЖИМ ПРИЛОЖЕНИЯ - АВТОМАТИЧЕСКАЯ ЗАГРУЗКА КАРТ ⚠️
      </div>
      
      {/* Основной контент с отступом для баннера */}
      <div className="pt-6">
        {children}
      </div>
    </div>
  );
};

function App() {
  // Предзагрузка изображения карты по умолчанию при запуске приложения
  useEffect(() => {
    addDefaultCardImage();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <GameProvider>
          <TestBanner>
            <div className="min-h-screen flex flex-col bg-gray-900 text-white">
              <Header />
              <CardsInitializer /> {/* Компонент для инициализации карт */}
              
              <main className="flex-grow container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/profile/:id" element={
                    <PrivateRoute>
                      <Profile />
                    </PrivateRoute>
                  } />
                  <Route path="/cards" element={
                    <PrivateRoute>
                      <CardCollection />
                    </PrivateRoute>
                  } />
                  <Route path="/battle" element={
                    <PrivateRoute>
                      <Battle />
                    </PrivateRoute>
                  } />
                  <Route path="/game/:roomId" element={
                    <PrivateRoute>
                      <GameRoom />
                    </PrivateRoute>
                  } />
                  <Route path="/test-cards" element={<CardSelector />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>

              <Footer />
            </div>
          </TestBanner>
        </GameProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
