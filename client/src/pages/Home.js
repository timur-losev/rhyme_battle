import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import './Home.css';

function Home() {
  const { currentUser } = useAuth();
  const { createRoom, joinRoom, currentRoom, loading, error } = useGame();
  const navigate = useNavigate();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [savedRoom, setSavedRoom] = useState(localStorage.getItem('currentRoom'));
  
  // Проверяем наличие сохраненной комнаты при загрузке компонента
  useEffect(() => {
    // Получаем сохраненную комнату из localStorage
    const savedRoomId = localStorage.getItem('currentRoom');
    if (savedRoomId) {
      console.log('Обнаружена сохраненная комната:', savedRoomId);
      setSavedRoom(savedRoomId);
    }
  }, []);
  
  const handleCreateRoom = () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    createRoom();
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (roomIdInput.trim()) {
      joinRoom(roomIdInput);
    }
  };

  // Обработчик для возвращения в сохраненную комнату
  const handleReturnToRoom = () => {
    if (savedRoom) {
      console.log('Возвращаемся в сохраненную комнату:', savedRoom);
      navigate(`/game/${savedRoom}`);
    }
  };

  // Обработчик для перехода к тестированию карт
  const handleViewTestCards = () => {
    console.log('Переход к тестированию карт...');
    navigate('/test-cards');
  };

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1>Rhyme Battle</h1>
        <p className="tagline">Состязание в искусстве рифмы и ритма</p>
        
        {savedRoom && (
          <div className="saved-room-notification">
            <p>У вас есть активная игровая комната</p>
            <button 
              className="btn btn-primary" 
              onClick={handleReturnToRoom}
            >
              Вернуться в комнату
            </button>
          </div>
        )}
        
        {currentUser ? (
          <div className="action-buttons">
            <button 
              className="btn btn-primary" 
              onClick={handleCreateRoom}
              disabled={loading}
            >
              Создать комнату
            </button>
            
            <form onSubmit={handleJoinRoom} className="join-room-form">
              <input
                type="text"
                placeholder="Введите ID комнаты"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                className="room-input"
              />
              <button 
                type="submit" 
                className="btn btn-secondary"
                disabled={loading || !roomIdInput.trim()}
              >
                Присоединиться
              </button>
            </form>
            
            {error && <p className="error-message">{error}</p>}
          </div>
        ) : (
          <div className="login-prompt">
            <p>Чтобы создать комнату или присоединиться к игре, необходимо войти в аккаунт</p>
            <Link to="/login" className="btn btn-primary">Войти</Link>
            <Link to="/register" className="btn btn-outline">Регистрация</Link>
          </div>
        )}
        
        {/* Добавляем кнопку тестирования карт */}
        <div className="test-cards-section" style={{ marginTop: '20px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleViewTestCards}
            style={{ 
              backgroundColor: '#6b46c1', 
              borderColor: '#553c9a',
              padding: '10px 20px'
            }}
          >
            Тестирование карт
          </button>
          <p style={{ fontSize: '0.8rem', color: '#a0aec0', marginTop: '5px' }}>
            Просмотр и тестирование всех доступных карт
          </p>
        </div>
      </div>
      
      <div className="features-section">
        <h2>Как играть</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Создайте комнату</h3>
            <p>Создайте игровую комнату и пригласите друга, отправив ему ID комнаты.</p>
          </div>
          <div className="feature-card">
            <h3>Выберите карты</h3>
            <p>Каждый игрок выбирает карты со словами и рифмами для своей колоды.</p>
          </div>
          <div className="feature-card">
            <h3>Сражайтесь</h3>
            <p>Используйте свои карты, чтобы создать лучшие рифмы и победить оппонента.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home; 