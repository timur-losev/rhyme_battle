# Советы по отладке приложения в VSCode

## Устранение проблемы с pwsh и задачами

Если вы видите ошибки, связанные с pwsh при запуске задач, это может быть связано с:

1. Различиями в синтаксисе между pwsh и CMD
2. Проблемами доступа к сетевым портам
3. Проблемами с закрытием процессов node.exe

### Решение ошибки "The term 'exit' is not recognized"

Мы исправили эту ошибку, заменив синтаксис CMD на правильный синтаксис pwsh в файле tasks.json:

```pwsh
# Вместо
taskkill /f /im node.exe || echo 'Нет активных процессов' && exit 0

# Используем
try { taskkill /f /im node.exe } catch { Write-Host 'Нет активных процессов' }; exit 0
```

## Перед запуском отладки

1. **Проверьте открытые порты**
   
   В палитре команд VSCode (Ctrl+Shift+P) выберите "Run Task" и запустите задачу "check-ports"
   Это покажет, заняты ли порты 3000 и 5101.

2. **Убедитесь, что у вас закрыты все окна браузера**
   
   При настройке Chrome для отладки лучше закрыть все окна Chrome перед запуском.

3. **Проверьте, что нет активных процессов node.js**
   
   Выполните в pwsh:
   ```pwsh
   Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
   ```

## Если серверы запускаются, но браузер показывает "This site can't be reached"

1. **Проверьте логи запуска**
   
   - В терминале сервера должно быть сообщение "Сервер запущен на порту 5101"
   - В терминале клиента должно быть сообщение "Compiled successfully!" и "You can now view..."

2. **Проверьте тестовые маршруты**
   
   Выполните в pwsh:
   ```pwsh
   Invoke-RestMethod -Uri http://localhost:5101/api/health
   Invoke-RestMethod -Uri http://localhost:3000/proxy-status
   ```

3. **Проверьте работу в браузере**
   
   Откройте новую вкладку в браузере и введите:
   - http://localhost:5101/api/health (должен вернуть JSON с статусом "ok")
   - http://localhost:3000/proxy-status (проверка работы прокси)

## Отладка в Chrome DevTools

1. После запуска отладки через "Server + Client" или "Chrome Debug", 
   откройте DevTools в браузере (F12)

2. Перейдите на вкладку "Network" и убедитесь, что:
   - WebSocket соединение успешно установлено (должен быть запрос к socket.io)
   - API запросы выполняются без ошибок CORS

3. Фильтр по типам запросов:
   - Фильтр "WS" показывает только WebSocket соединения
   - Фильтр "XHR" показывает запросы к API

## Отладка вебсокетов

Если возникают проблемы с сокетами:

1. Откройте консоль браузера и выполните:
   ```javascript
   const socket = io('http://localhost:5101', { transports: ['websocket'] });
   socket.on('connect', () => console.log('Соединение установлено!'));
   socket.on('connect_error', (err) => console.error('Ошибка соединения:', err));
   ```

2. Убедитесь что CORS правильно настроен в server/src/index.js

## Альтернативный запуск отладки через командную строку

Если запуск через VSCode все еще вызывает проблемы, можно запустить отладку через командную строку pwsh:

```pwsh
# Открыть первое окно pwsh
cd server
$env:DEBUG = 'true'
node --inspect=9229 src/index.js

# Открыть второе окно pwsh
cd client
$env:REACT_APP_DEBUG = 'true'
$env:PORT = '3000'
$env:BROWSER = 'none'
npm start
```

## Проверка сетевых портов с pwsh

```pwsh
# Проверка порта 5101
Get-NetTCPConnection -LocalPort 5101 -ErrorAction SilentlyContinue

# Проверка порта 3000
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

# Освобождение портов (закрытие процессов)
Get-Process -Id (Get-NetTCPConnection -LocalPort 5101).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Проверка брандмауэра Windows с pwsh

```pwsh
# Проверка правил брандмауэра для порта 5101
Get-NetFirewallRule | Where-Object { $_.Name -like "*5101*" }

# Проверка правил брандмауэра для порта 3000
Get-NetFirewallRule | Where-Object { $_.Name -like "*3000*" }

# Временное отключение брандмауэра (с правами администратора)
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
```

## Другие советы

1. **Попробуйте запуск без отладки**
   
   Иногда обычный запуск через терминал может работать лучше:
   ```bash
   # Терминал 1
   cd server && node src/index.js
   
   # Терминал 2
   cd client && npm start
   ```

2. **Проверьте брандмауэр Windows**
   
   Убедитесь, что правила брандмауэра разрешают соединения на портах 3000 и 5101.

3. **Очистите кэш браузера**
   
   Полностью очистите кэш и файлы cookie для localhost.

4. **Проверьте сетевую активность вне браузера**
   ```bash
   curl http://localhost:5101/api/health
   ``` 