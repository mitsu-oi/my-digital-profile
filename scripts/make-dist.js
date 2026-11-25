// Складає готовий сайт у папку dist/ — саме її віддає Vercel (outputDirectory у vercel.json).
// Туди йдуть лише файли для відвідувачів: сторінки, стилі, скрипти, шрифти, зображення, дані, robots і sitemap.
// Вихідні файли (src/, scripts/), node_modules і документація на сайт не потрапляють.
// Запуск: npm run build:dist (входить у npm run build).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

const files = fs.readdirSync(root).filter((name) => name.endsWith('.html') || ['robots.txt', 'sitemap.xml'].includes(name));
for (const name of files) fs.copyFileSync(path.join(root, name), path.join(dist, name));
for (const folder of ['css', 'assets', 'data']) fs.cpSync(path.join(root, folder), path.join(dist, folder), { recursive: true });

console.log(`dist/: ${files.length} файлів у корені + css/, assets/, data/`);
