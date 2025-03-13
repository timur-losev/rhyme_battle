@echo off
echo ===== Проверка состояния сервера Rhyme Battle =====

rem Устанавливаем цвета
set GREEN=92m
set RED=91m
set YELLOW=93m
set RESET=0m

echo [%YELLOW%]Выполняем проверку порта 5101...[%RESET%]
netstat -ano | findstr :5101
if %errorlevel% == 0 (
    echo [%GREEN%]Порт 5101 занят (сервер запущен)[%RESET%]
) else (
    echo [%RED%]Порт 5101 свободен (сервер не запущен)[%RESET%]
)

echo.
echo [%YELLOW%]Проверка доступности сервера...[%RESET%]
curl -s http://localhost:5101/api/health
if %errorlevel% == 0 (
    echo [%GREEN%]Сервер доступен и отвечает[%RESET%]
) else (
    echo [%RED%]Сервер недоступен[%RESET%]
)

echo.
echo [%YELLOW%]Проверка процессов Node.js...[%RESET%]
tasklist | findstr node.exe
if %errorlevel% == 0 (
    echo [%GREEN%]Процессы Node.js запущены[%RESET%]
) else (
    echo [%RED%]Процессы Node.js не найдены[%RESET%]
)

echo.
echo [%YELLOW%]Выполняем ping localhost...[%RESET%]
ping 127.0.0.1 -n 1
if %errorlevel% == 0 (
    echo [%GREEN%]Локальный хост доступен[%RESET%]
) else (
    echo [%RED%]Проблема с локальным хостом[%RESET%]
)

echo.
echo [%YELLOW%]Проверка брандмауэра Windows...[%RESET%]
netsh advfirewall show currentprofile
echo.
echo ===== Проверка завершена =====
echo.
echo [%YELLOW%]Проблемы с доступом к клиенту или серверу могут быть вызваны:[%RESET%]
echo 1. Блокировкой портов брандмауэром
echo 2. Конфликтом процессов на портах 3000 или 5101
echo 3. Недостаточными правами для запуска сервера
echo 4. Проблемами с сетевыми настройками
echo.
echo Для решения проблем попробуйте:
echo 1. Перезапустите скрипт debug.bat от имени администратора
echo 2. Убейте все процессы node.exe и запустите скрипт заново
echo 3. Временно отключите брандмауэр Windows
echo 4. Используйте другие порты, изменив настройки в .env файлах
echo.
pause 