const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    const isDebug = process.env.REACT_APP_DEBUG === 'true';
    const targetUrl = process.env.REACT_APP_API_URL || 'http://localhost:5101';

    // Логирование запросов
    app.use((req, res, next) => {
        if (isDebug) {
            console.log(`[PROXY] ${req.method} ${req.url}`);
        }
        next();
    });

    // Проверка прокси
    app.get('/proxy-status', (req, res) => {
        res.json({
            status: 'ok',
            message: 'Прокси настроен правильно',
            timestamp: new Date().toISOString(),
            debug: isDebug
        });
    });

    // Проверка соединения с API сервера
    app.get('/api-connection-check', (req, res, next) => {
        if (isDebug) {
            console.log('[PROXY] Проверка соединения с API сервера');
        }

        // Просто передаем запрос на сервер через прокси
        next();
    });

    // Настройка прокси для API
    app.use(
        ['/api', '/socket.io'],
        createProxyMiddleware({
            target: targetUrl,
            changeOrigin: true,
            ws: true,
            logLevel: isDebug ? 'debug' : 'error',
            onError: (err, req, res) => {
                console.error('[PROXY ERROR]', err);
                res.writeHead(500, {
                    'Content-Type': 'application/json'
                });
                res.end(JSON.stringify({
                    status: 'error',
                    message: 'Ошибка прокси соединения с сервером',
                    error: err.message
                }));
            }
        })
    );
}; 