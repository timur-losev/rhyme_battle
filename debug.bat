@echo off
echo ===== Запуск Rhyme Battle в режиме отладки =====

rem Убиваем все процессы Node.js
echo Остановка всех процессов Node.js...
taskkill /f /im node.exe > nul 2>&1
timeout /t 2 > nul

rem Очищаем порты, на которых работают сервер и клиент
echo Очистка портов...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5101"') do taskkill /F /PID %%a > nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do taskkill /F /PID %%a > nul 2>&1
timeout /t 2 > nul

rem Запускаем сервер в режиме отладки
echo [Запуск сервера]
start cmd /k "title [СЕРВЕР] Rhyme Battle && cd server && echo РЕЖИМ ОТЛАДКИ СЕРВЕРА && set DEBUG=true && node --inspect=9229 src/index.js"

rem Ждем 5 секунд для запуска сервера
echo Ожидание запуска сервера... (5 секунд)
timeout /t 5 > nul

rem Проверяем, запущен ли сервер
echo Проверка доступности сервера...
curl -s http://localhost:5101 > nul
if %errorlevel% neq 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Сервер не отвечает на http://localhost:5101
    echo Возможно, сервер еще запускается или произошла ошибка.
    echo Проверьте окно запуска сервера!
) else (
    echo [УСПЕХ] Сервер запущен и отвечает на http://localhost:5101
)

rem Запускаем клиент в режиме отладки с увеличенным таймаутом и более строгими настройками
echo [Запуск клиента]
start cmd /k "title [КЛИЕНТ] Rhyme Battle && cd client && echo РЕЖИМ ОТЛАДКИ КЛИЕНТА && set REACT_APP_DEBUG=true && set GENERATE_SOURCEMAP=true && set BROWSER=none && set PORT=3000 && set DANGEROUSLY_DISABLE_HOST_CHECK=true && npm start"

echo Ожидание запуска клиента... (10 секунд)
timeout /t 10 > nul

rem Проверяем, запущен ли клиент
echo Проверка доступности клиента...
curl -s http://localhost:3000 > nul
if %errorlevel% neq 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Клиент не отвечает на http://localhost:3000
    echo Возможно, клиент еще запускается или произошла ошибка.
    echo Проверьте окно запуска клиента!
) else (
    echo [УСПЕХ] Клиент запущен и отвечает на http://localhost:3000
)

rem Открываем браузер вручную после запуска всех компонентов
echo Открытие браузера...
start "" http://localhost:3000

echo.
echo ===== Отладка запущена! =====
echo Сервер: http://localhost:5101
echo Клиент: http://localhost:3000
echo URL отладки сервера: chrome://inspect/#devices
echo.
echo ✓ Режим отладки активирован!
echo ✓ Для отладки сервера откройте Chrome и перейдите по адресу chrome://inspect/#devices
echo ✓ Для отладки клиента используйте F12 в окне браузера
echo.
echo Чтобы остановить отладку, нажмите любую клавишу...
pause > nul

rem Останавливаем все процессы
echo Остановка всех процессов...
taskkill /f /im node.exe > nul 2>&1
echo Отладка завершена. 