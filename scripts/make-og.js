// Робить зображення для соцмереж (Open Graph, 1200×630) із макета src/og.html.
// Запуск: npm run build:og. Потрібен встановлений Microsoft Edge або Google Chrome (headless-режим).
// Результат — assets/images/og.png; він лежить у репозиторії, тож у CI цей крок не потрібен.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const source = pathToFileURL(path.join(root, 'src', 'og.html')).href;
const target = path.join(root, 'assets', 'images', 'og.png');

const browsers = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = browsers.find((file) => fs.existsSync(file));
if (!browser) {
  console.error('Не знайдено Edge чи Chrome. Вкажіть шлях у змінній BROWSER.');
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'osya-og-'));
const shot = path.join(profile, 'og.png');
const result = spawnSync(browser, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--allow-file-access-from-files', // шрифти й SVG поруч із макетом
  `--user-data-dir=${profile}`,
  '--virtual-time-budget=3000',
  '--window-size=1200,630',
  `--screenshot=${shot}`, // у тимчасову папку: браузер не завжди пише в шлях із кирилицею
  source,
]);
// Edge на Windows інколи повертає керування раніше, ніж запише файл, — чекаємо до 15 с
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
for (let waited = 0; !fs.existsSync(shot) && waited < 15000; waited += 250) sleep(250);
sleep(300); // дати дописати файл до кінця
const ok = fs.existsSync(shot);
if (ok) fs.copyFileSync(shot, target);
fs.rmSync(profile, { recursive: true, force: true });
if (!ok) {
  console.error('Знімок не вдався:', String(result.stderr || ''));
  process.exit(1);
}
console.log('og.png', `${(fs.statSync(target).size / 1024).toFixed(0)} КБ`);
