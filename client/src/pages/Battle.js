import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client'; // Добавляем прямой импорт socket.io для теста

const Battle = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { createRoom, createRoomHttp, joinRoom, error, isConnected, diagnoseSockets, reconnectSocket } = useGame();
  const [joinRoomId, setJoinRoomId] = useState('');
  const [activeTab, setActiveTab] = useState('online'); // online, ai, offline
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // create, join
  const [socketStatus, setSocketStatus] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [testSocket, setTestSocket] = useState(null); // Состояние для тестового сокета

  // Проверка состояния сокета при загрузке
  useEffect(() => {
    const checkSocket = () => {
      if (diagnoseSockets) {
        const status = diagnoseSockets();
        // Обновляем состояние только если оно изменилось
        if (JSON.stringify(status) !== JSON.stringify(socketStatus)) {
          setSocketStatus(status);
          setLastPing(new Date().toISOString());
          console.log('Обновление статуса сокета:', status, 'isConnected:', isConnected);
        }
      }
    };
    
    if (currentUser) {
      // Первичная проверка при монтировании
      checkSocket();
      
      // Проверяем состояние каждые 6 секунд (было 3 секунды)
      const interval = setInterval(checkSocket, 6000);
      
      return () => clearInterval(interval);
    }
  }, [diagnoseSockets, currentUser, isConnected, socketStatus]); // Добавляем socketStatus в зависимости

  // Получаем текущее состояние и отображаем его более понятно
  const getConnectionStatusText = () => {
    if (isConnected) {
      return "Соединение с сервером: активно";
    } else if (socketStatus && typeof socketStatus === 'object' && socketStatus.connected) {
      return "Соединение с сервером: активно (через Socket.io)";
    } else {
      return "Соединение с сервером: отсутствует";
    }
  };

  const getConnectionStatusColor = () => {
    if (isConnected || (socketStatus && typeof socketStatus === 'object' && socketStatus.connected)) {
      return "text-green-500";
    } else {
      return "text-red-500";
    }
  };

  // Обработчик диагностики сокета
  const handleDiagnoseSocket = () => {
    if (diagnoseSockets) {
      const status = diagnoseSockets();
      setSocketStatus(status);
      setLastPing(new Date().toISOString());
      alert(`Состояние сокета: ${JSON.stringify(status, null, 2)}`);
    }
  };
  
  // Обработчик принудительного переподключения
  const handleReconnect = () => {
    if (reconnectSocket) {
      const result = reconnectSocket();
      if (result) {
        alert('Запрос на переподключение отправлен. Проверьте состояние через 3 секунды.');
        setTimeout(() => {
          if (diagnoseSockets) {
            const status = diagnoseSockets();
            setSocketStatus(status);
            setLastPing(new Date().toISOString());
          }
        }, 3000);
      }
    }
  };

  // Обработчик создания новой комнаты
  const handleCreateRoom = () => {
    console.log('Запрос на создание комнаты. Состояние соединения:', isConnected);
    
    if (isConnected) {
      createRoom();
    } else {
      console.error('Подключение к серверу отсутствует. Невозможно создать комнату.');
      alert('Подключение к серверу отсутствует. Попробуйте позже.');
    }
  };

  // Обработчик создания новой комнаты через HTTP
  const handleCreateRoomHttp = () => {
    createRoomHttp();
  };

  // Обработчик присоединения к комнате
  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) {
      console.error('ID комнаты не указан');
      alert('Введите ID комнаты');
      return;
    }

    console.log('Запрос на присоединение к комнате:', joinRoomId.trim(), 'Состояние соединения:', isConnected);
    
    if (isConnected) {
      joinRoom(joinRoomId.trim());
    } else {
      console.error('Подключение к серверу отсутствует. Невозможно присоединиться к комнате.');
      alert('Подключение к серверу отсутствует. Попробуйте позже.');
    }
  };

  // Открыть модальное окно
  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  // Закрыть модальное окно
  const closeModal = () => {
    setShowModal(false);
    setJoinRoomId('');
  };

  // Новая функция для прямого тестирования socket.io
  const testDirectSocketConnection = () => {
    try {
      // Создаем новый сокет напрямую, минуя контекст
      const directSocket = io('http://localhost:5101', {
        transports: ['websocket', 'polling'],
        autoConnect: false // Отключаем автоматическое подключение
      });
      
      directSocket.on('connect', () => {
        console.log('Тестовый сокет подключен успешно!', directSocket.id);
        alert(`Тестовый сокет успешно подключен! ID: ${directSocket.id}`);
        setTestSocket(directSocket);
      });
      
      directSocket.on('connect_error', (err) => {
        console.error('Ошибка подключения тестового сокета:', err.message);
        alert(`Ошибка подключения тестового сокета: ${err.message}`);
      });
      
      directSocket.on('error', (err) => {
        console.error('Общая ошибка тестового сокета:', err);
      });
      
      console.log('Инициализирован тестовый сокет, вызываем connect()...');
      directSocket.connect(); // Явно вызываем connect, как в тестовой странице
    } catch (err) {
      console.error('Критическая ошибка при создании тестового сокета:', err);
      alert(`Критическая ошибка при создании тестового сокета: ${err.message}`);
    }
  };
  
  // Отключение тестового сокета
  const disconnectTestSocket = () => {
    if (testSocket) {
      testSocket.disconnect();
      setTestSocket(null);
      console.log('Тестовый сокет отключен');
      alert('Тестовый сокет отключен');
    } else {
      alert('Нет активного тестового сокета');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">Режим баттла</h1>

      {/* Информация о пользователе */}
      {currentUser && (
        <div className="text-center text-sm text-gray-400 mb-2">
          Вы вошли как: {currentUser.username || currentUser.email} (ID: {currentUser.id})
        </div>
      )}

      {/* Статус соединения */}
      <div className="text-center mb-6 bg-gray-800 p-4 rounded-lg max-w-lg mx-auto">
        <p className={`font-bold ${getConnectionStatusColor()}`}>
          {getConnectionStatusText()}
        </p>
        {socketStatus && typeof socketStatus === 'object' && (
          <p className="text-sm text-gray-400 mt-1">
            Socket ID: {socketStatus.id || 'не доступен'}
          </p>
        )}
        {lastPing && (
          <p className="text-xs text-gray-500 mt-1">
            Последняя проверка: {new Date(lastPing).toLocaleTimeString()}
          </p>
        )}
        <div className="flex justify-center space-x-2 mt-3">
          <button 
            onClick={handleDiagnoseSocket}
            className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
          >
            Диагностика соединения
          </button>
          <button 
            onClick={handleReconnect}
            className="px-4 py-2 bg-blue-700 text-white rounded text-sm hover:bg-blue-600"
          >
            Переподключиться
          </button>
        </div>
        
        {/* Добавляем кнопки для прямого тестирования socket.io */}
        <div className="flex justify-center space-x-2 mt-3">
          <button 
            onClick={testDirectSocketConnection}
            className="px-4 py-2 bg-green-700 text-white rounded text-sm hover:bg-green-600"
          >
            Тест прямого подключения
          </button>
          <button 
            onClick={disconnectTestSocket}
            className="px-4 py-2 bg-red-700 text-white rounded text-sm hover:bg-red-600"
          >
            Отключить тестовый сокет
          </button>
        </div>
        
        {/* Статус тестового сокета */}
        {testSocket && (
          <div className="mt-3 p-2 bg-gray-700 rounded">
            <p className="text-green-400 font-bold">Тестовый сокет активен</p>
            <p className="text-sm text-gray-300">ID: {testSocket.id}</p>
          </div>
        )}
      </div>

      {/* Вкладки режимов */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-800 rounded-lg p-1">
          <button
            className={`px-6 py-3 rounded-lg font-semibold ${
              activeTab === 'online'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
            onClick={() => setActiveTab('online')}
          >
            Онлайн
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-semibold ${
              activeTab === 'ai'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
            onClick={() => setActiveTab('ai')}
          >
            Против ИИ
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-semibold ${
              activeTab === 'offline'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
            onClick={() => setActiveTab('offline')}
          >
            Локальный
          </button>
        </div>
      </div>

      {/* Содержимое вкладок */}
      {activeTab === 'online' && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">Онлайн баттл</h2>
            <p className="mb-6 text-gray-300">
              Вызовите друга на рэп-баттл или сразитесь с случайным оппонентом в онлайн режиме. Выбирайте карты с куплетами, разыгрывайте комбинации и побеждайте в словесной дуэли!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => openModal('create')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded flex items-center justify-center"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Создать игру
              </button>
              <button
                onClick={() => openModal('join')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded flex items-center justify-center"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14"
                  />
                </svg>
                Присоединиться к игре
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Как играть</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Создайте новую игру или присоединитесь к существующей по ID</li>
              <li>Выберите 5 карт с куплетами для своей колоды</li>
              <li>Разыгрывайте карты в свой ход, планируя стратегию</li>
              <li>Используйте комбинации, атаки и защиту для победы</li>
              <li>Побеждает игрок с наибольшим количеством очков после 3 раундов</li>
            </ol>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="max-w-3xl mx-auto bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Баттл против ИИ</h2>
          <p className="mb-6 text-gray-300">
            Сразитесь с искусственным интеллектом в рэп-баттле. Выберите уровень сложности и проверьте свои навыки!
          </p>

          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4">Выберите сложность</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded">
                Легкий
              </button>
              <button className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded">
                Средний
              </button>
              <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded">
                Сложный
              </button>
            </div>
          </div>

          <div className="text-center text-gray-400">
            <p>Режим против ИИ будет доступен в ближайшем обновлении</p>
          </div>
        </div>
      )}

      {activeTab === 'offline' && (
        <div className="max-w-3xl mx-auto bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Локальный баттл</h2>
          <p className="mb-6 text-gray-300">
            Играйте локально с другом на одном устройстве. Идеально для игры вдвоем за одним компьютером!
          </p>

          <div className="mb-6">
            <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded w-full sm:w-auto">
              Начать локальную игру
            </button>
          </div>

          <div className="text-center text-gray-400">
            <p>Локальный режим будет доступен в ближайшем обновлении</p>
          </div>
        </div>
      )}

      {/* Модальное окно */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {modalType === 'create'
                  ? 'Создать новую игру'
                  : 'Присоединиться к игре'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {error && (
              <div className="bg-red-900 bg-opacity-50 text-white p-3 rounded mb-4">
                {error}
              </div>
            )}

            {modalType === 'create' ? (
              <div>
                <p className="mb-6 text-gray-300">
                  Создайте новую игру и пригласите друга, отправив ему ID комнаты.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleCreateRoom}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded w-full"
                  >
                    Создать комнату через Socket.io
                  </button>
                  
                  <button
                    onClick={handleCreateRoomHttp}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded w-full"
                  >
                    Создать комнату через HTTP API
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-4 text-gray-300">
                  Введите ID комнаты, который вам предоставил создатель игры.
                </p>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Введите ID комнаты"
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded mb-4"
                />
                <button
                  onClick={handleJoinRoom}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded w-full"
                >
                  Присоединиться
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Battle; 