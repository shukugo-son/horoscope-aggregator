/**
 * ローカル開発サーバー（Netlify 不要）
 * 使い方: node server.js
 * ブラウザで http://localhost:3000 を開く
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const { handler } = require('./netlify/functions/fetch-horoscope');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico':  'image/x-icon',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // ── Netlify Function エンドポイント ──────────────────
    if (url.pathname === '/.netlify/functions/fetch-horoscope') {
        const params = Object.fromEntries(url.searchParams.entries());
        try {
            const result = await handler({ httpMethod: req.method, queryStringParameters: params });
            const headers = { 'Content-Type': 'application/json', ...result.headers };
            res.writeHead(result.statusCode, headers);
            res.end(result.body);
        } catch (err) {
            console.error('Function error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ── 静的ファイル配信 ──────────────────────────────────
    let filePath = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);

    // ディレクトリトラバーサル防止
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain; charset=utf-8' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('  ✅ サーバー起動: http://localhost:' + PORT);
    console.log('  ブラウザでこのURLを開いてください');
    console.log('  停止: Ctrl+C');
    console.log('');
});
