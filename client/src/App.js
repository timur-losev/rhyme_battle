import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
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
import TestCards from './pages/TestCards';

import Header from './components/UI/Header';
import Footer from './components/UI/Footer';
import PrivateRoute from './components/UI/PrivateRoute';

import './App.css';
import addDefaultCardImage from './utils/generateDefaultCard';

// Компонент для принудительной загрузки карт при запуске приложения
// Важно: Переписан для избежания условных хуков и минимизации повторных загрузок
const CardsInitializer = () => {
  const { loadCards, cardsCollection, loading } = useGame();
  // Используем useRef для отслеживания состояния инициализации
  const initAttemptedRef = useRef(false);
  const loadTimeoutRef = useRef(null);

  useEffect(() => {
    // Проверяем, была ли уже попытка инициализации
    if (initAttemptedRef.current) {
      console.log('🚀 App: Инициализация карт уже была запущена ранее');
      return;
    }

    // Проверяем, загружены ли уже карты
    if (cardsCollection.length > 0) {
      console.log(`🚀 App: Карты уже загружены (${cardsCollection.length} шт.), инициализация не требуется`);
      initAttemptedRef.current = true;
      return;
    }

    // Проверяем, идет ли уже загрузка
    if (loading) {
      console.log('🚀 App: Загрузка карт уже выполняется в другом компоненте, ожидаем');
      initAttemptedRef.current = true;
      return;
    }

    // Отмечаем, что попытка была сделана
    initAttemptedRef.current = true;

    // Принудительная загрузка карт при запуске приложения
    console.log('🚀 App: Принудительная инициализация карт при запуске');

    // Очищаем существующий таймаут, если он есть
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    // Безусловно вызываем loadCards для избежания проблем с хуками
    // но с задержкой, чтобы не конфликтовать с инициализацией в GameContext
    loadTimeoutRef.current = setTimeout(() => {
      // Проверяем, загружены ли карты к этому моменту
      if (cardsCollection.length === 0 && !loading) {
        console.log('🚀 App: Запуск отложенной загрузки карт');
        loadCards().then(cards => {
          console.log(`🚀 App: Загружено ${cards?.length || 0} карт при инициализации`);
        }).catch(err => {
          console.error('🚀 App: Ошибка загрузки карт при инициализации:', err);
        });
      } else {
        console.log('🚀 App: Отложенная загрузка отменена - карты уже загружаются или загружены');
      }
    }, 1000);

    // Функция очистки для отмены загрузки при размонтировании
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []); // Пустой массив зависимостей - только при монтировании

  return null; // Этот компонент не рендерит ничего
};

// Оборачивающий компонент для отображения тестового баннера
const TestBanner = ({ children }) => {
  const { cardsCollection, loading } = useGame();

  // Индикатор статуса загрузки карт
  const cardsStatus = (() => {
    if (loading) {
      return "⏳ ЗАГРУЗКА КАРТ...";
    } else if (cardsCollection.length > 0) {
      return `✅ КАРТЫ ЗАГРУЖЕНЫ (${cardsCollection.length} ШТ.)`;
    } else {
      return "❌ КАРТЫ НЕ ЗАГРУЖЕНЫ";
    }
  })();

  return (
    <div className="relative">
      {/* Тестовый баннер */}
      <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-1 text-center z-50 text-sm">
        ⚠️ ТЕСТОВЫЙ РЕЖИМ ПРИЛОЖЕНИЯ {/* - АВТОМАТИЧЕСКАЯ ЗАГРУЗКА КАРТ */}
        <span className="ml-2 px-2 py-0.5 rounded bg-red-800">
          {cardsStatus}
        </span>
      </div>

      {/* Основной контент с отступом для баннера */}
      <div className="pt-6">
        {children}
      </div>
    </div>
  );
};

function App() {
  const [connectionError, setConnectionError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Проверка доступности сервера при запуске
  useEffect(() => {
    const checkServerConnection = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5101';
        console.log(`Проверка соединения с сервером: ${apiUrl}`);

        // Добавляем параметр к URL, чтобы избежать кэширования
        const response = await fetch(`${apiUrl}/api/health?t=${Date.now()}`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (response.ok) {
          console.log('Сервер доступен!');
          setConnectionError(null);
        } else {
          console.error(`Сервер недоступен. Код: ${response.status}`);
          setConnectionError(`Сервер недоступен (${response.status})`);
        }
      } catch (error) {
        console.error('Ошибка подключения к серверу:', error);
        setConnectionError(`Не удалось подключиться к серверу: ${error.message}`);
      } finally {
        // Даже при ошибке помечаем приложение как готовое, чтобы показать страницу с ошибкой
        setIsReady(true);
      }
    };

    checkServerConnection();
  }, []);

  // Предзагрузка изображения карты по умолчанию при запуске приложения
  useEffect(() => {
    addDefaultCardImage();
  }, []);

  // Функция для рендеринга содержимого приложения,
  // выносим всю логику условного рендеринга для предотвращения ошибок с хуками
  const renderContent = () => {
    if (!isReady) {
      return (
        <div className="flex h-screen bg-gray-900 text-white">
          <div className="m-auto text-center p-8">
            <h2 className="text-2xl font-bold mb-4">Загрузка приложения...</h2>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        </div>
      );
    }

    if (connectionError) {
      return (
        <div className="flex h-screen bg-gray-900 text-white">
          <div className="m-auto text-center p-8 max-w-xl">
            <h2 className="text-2xl font-bold mb-4 text-red-500">Ошибка подключения</h2>
            <p className="mb-4">{connectionError}</p>
            <div className="bg-gray-800 p-4 rounded-lg text-left mb-4">
              <p className="font-bold mb-2">Возможные причины:</p>
              <ul className="list-disc pl-5 mb-3">
                <li>Сервер не запущен</li>
                <li>Неверный адрес сервера в настройках</li>
                <li>Брандмауэр блокирует соединение</li>
                <li>Проблемы с CORS</li>
              </ul>
              <p className="font-bold mb-2">Решения:</p>
              <ul className="list-disc pl-5">
                <li>Запустите сервер (debug.bat)</li>
                <li>Проверьте настройки в файле .env</li>
                <li>Временно отключите брандмауэр</li>
              </ul>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-4"
              >
                Повторить попытку
              </button>
              <button
                onClick={() => {
                  setConnectionError(null);
                  setIsReady(true);
                }}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
              >
                Продолжить в автономном режиме
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Router>
        <AuthProvider>
          <GameProvider>
            <TestBanner>
              <div className="min-h-screen flex flex-col bg-gray-900 text-white">
                <Header />
                <CardsInitializer /> {/* Компонент для инициализации карт */}

                <main className="flex-grow container mx-auto px-4 py-8">
                  {process.env.REACT_APP_DEBUG === 'true' && (
                    <div className="mb-4 p-2 bg-blue-900 text-white rounded-lg text-sm">
                      <strong>🐞 Режим отладки</strong> активен.
                      Среда: {process.env.NODE_ENV},
                      API: {process.env.REACT_APP_API_URL || 'http://localhost:5101'}
                    </div>
                  )}

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
                    <Route path="/test-cards" element={<TestCards />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>

                {/* Footer убран по запросу пользователя */}
              </div>
            </TestBanner>
          </GameProvider>
        </AuthProvider>
      </Router>
    );
  };

  return renderContent();
}

export default App;
