import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Добавляем отладочную информацию
if (process.env.REACT_APP_DEBUG === 'true') {
  console.log('===== ЗАПУСК В РЕЖИМЕ ОТЛАДКИ =====');
  console.log('Информация об окружении:');
  console.log('- REACT_APP_DEBUG:', process.env.REACT_APP_DEBUG);
  console.log('- REACT_APP_API_URL:', process.env.REACT_APP_API_URL || 'не задан');
  console.log('- REACT_APP_SOCKET_URL:', process.env.REACT_APP_SOCKET_URL || 'не задан');
  console.log('- PORT:', process.env.PORT || '3000 (по умолчанию)');
  console.log('================================');

  // Глобальный обработчик ошибок
  window.addEventListener('error', (event) => {
    console.error('Глобальная ошибка:', event.error);
  });

  // Перехват отклоненных промисов
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Необработанная ошибка промиса:', event.reason);
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
