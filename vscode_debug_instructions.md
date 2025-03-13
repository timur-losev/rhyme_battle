# Инструкция по отладке в VSCode

## Проблема: Ошибка Source Map

При запуске отладки через Chrome вы можете видеть ошибку:
```
Could not read source map for chrome-error://chromewebdata/: Unexpected 503 response from chrome-error://chromewebdata/neterror.rollup.js.map: Unsupported protocol "chrome-error:"
```

Это распространенная ошибка при работе с Chrome DevTools и не влияет на процесс отладки. Она возникает, когда браузер пытается загрузить карты исходного кода для внутренних страниц Chrome.

## Рекомендуемый способ отладки

### 1. Запуск через debug.bat

Самый простой способ запустить отладку:

1. Запустите файл `debug.bat` из корня проекта
2. Дождитесь запуска сервера и клиента
3. Откройте Chrome и перейдите к `chrome://inspect/#devices`
4. В разделе Remote Target нажмите "inspect" для узла с портом 9229
5. Откроется отладчик для серверной части

### 2. Отладка через VSCode

Для полноценной отладки через VSCode:

1. Откройте вкладку "Run and Debug" (Ctrl+Shift+D)
2. Выберите конфигурацию "Server + Client"
3. Нажмите кнопку "Start Debugging" (F5)
4. VSCode запустит сервер и браузер для клиента
5. Вы можете устанавливать breakpoints в клиентском и серверном коде

### 3. Решение проблем Source Map

Если возникают проблемы с Source Map:

1. В файле `.env` в директории `client` убедитесь, что `GENERATE_SOURCEMAP=true`
2. Перезапустите отладку, полностью закрыв все процессы node.js
3. Используйте опцию "Hard Reload" в Chrome (Ctrl+Shift+R)
4. Если проблема сохраняется, очистите кэш браузера

### 4. Отладка отдельно клиента или сервера

#### Отладка сервера:
```bash
cd server
node --inspect src/index.js
```
Затем откройте Chrome и перейдите к `chrome://inspect/#devices`

#### Отладка клиента:
```bash
cd client
set REACT_APP_DEBUG=true && npm start
```
Затем используйте Chrome DevTools (F12) на открывшейся странице.

### 5. Полезные команды консоли для отладки клиента

В консоли браузера можно использовать:

```javascript
// Получить список всех карт через контекст
const gameContext = document.querySelector('#root').__REACT_CONTEXT_DEVTOOLS_GLOBAL_HOOK.renderers[0].storeMap.get('GameContext');
console.log(gameContext.cardsCollection);

// Отключить фильтрацию карт 
window.location.search = "?nofilter=true&debug=true";

// Проверить состояние сокета
console.log(gameContext.socket);
```

## Диагностика проблем

1. Если карты не отображаются:
   - Проверьте консоль на наличие ошибок
   - Используйте кнопку "Анализ коллекции карт" в панели отладки
   - Убедитесь, что cardsCollection не пуста
   - Проверьте структуру карт на наличие всех требуемых полей

2. Если не работает сокет:
   - Проверьте, запущен ли сервер
   - Используйте функцию `diagnoseSockets()` из контекста
   - Проверьте наличие CORS ошибок в консоли

3. Общие проблемы отладки:
   - Попробуйте закрыть все вкладки Chrome и запустить отладку заново
   - Используйте "Очистить кэш" в панели отладки
   - Перезапустите VSCode, если отладчик перестал реагировать 