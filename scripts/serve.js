// Простий локальний сервер для розробки: npm run serve -> http://localhost:4173
// Потрібен, бо fetch до data.json не працює зі сторінки, відкритої подвійним кліком (file://).
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };

http
  .createServer((request, response) => {
    let name = decodeURIComponent(request.url.split('?')[0]);
    if (name.endsWith('/')) name += 'index.html';
    const file = path.join(root, name);
    // не віддаємо нічого поза папкою проєкту
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        // як на Vercel: для сторінок віддаємо 404.html, для файлів (скриптів, картинок) — короткий текст
        const ext = path.extname(file);
        if (ext === '' || ext === '.html') {
          fs.readFile(path.join(root, '404.html'), (pageError, page) => {
            response.writeHead(404, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' }).end(pageError ? 'Не знайдено' : page);
          });
          return;
        }
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Не знайдено');
        return;
      }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
    });
  })
  .listen(port, () => console.log(`http://localhost:${port}`));
