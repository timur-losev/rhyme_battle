@echo off
echo ===== Подготовка проекта Rhyme Battle к отладке =====

rem Устанавливаем зависимости клиента
echo [1/4] Установка зависимостей клиента...
cd client
call npm install --save-dev http-proxy-middleware
call npm install cross-env --save-dev
cd ..

rem Устанавливаем зависимости сервера
echo [2/4] Установка зависимостей сервера...
cd server
call npm install cors dotenv
cd ..

rem Проверяем, что файл настройки прокси существует
echo [3/4] Проверка настройки прокси...
if not exist client\src\setupProxy.js (
    echo [ОШИБКА] Файл setupProxy.js не найден. Создайте его вручную.
    echo Содержимое файла должно быть:
    echo const { createProxyMiddleware } = require('http-proxy-middleware');
    echo module.exports = function(app) {
    echo   app.use(
    echo     '/api',
    echo     createProxyMiddleware({
    echo       target: 'http://localhost:5101',
    echo       changeOrigin: true,
    echo     }),
    echo   );
    echo };
) else (
    echo [УСПЕХ] Файл setupProxy.js найден.
)

rem Создаем .env файлы если их нет
echo [4/4] Проверка файлов окружения...
if not exist client\.env (
    echo [СОЗДАНИЕ] Файл client\.env
    echo PORT=3000 > client\.env
    echo REACT_APP_DEBUG=true >> client\.env
    echo GENERATE_SOURCEMAP=true >> client\.env
    echo BROWSER=none >> client\.env
    echo DANGEROUSLY_DISABLE_HOST_CHECK=true >> client\.env
    echo FAST_REFRESH=true >> client\.env
    echo CHOKIDAR_USEPOLLING=true >> client\.env
    echo WDS_SOCKET_PORT=0 >> client\.env
    echo REACT_APP_API_URL=http://localhost:5101 >> client\.env
    echo REACT_APP_SOCKET_URL=http://localhost:5101 >> client\.env
) else (
    echo [УСПЕХ] Файл client\.env найден.
)

echo.
echo ===== Подготовка завершена! =====
echo Теперь можно запустить отладку с помощью команды debug.bat
echo.
pause 