// Перевірка сайту перед деплоєм (крок CI у GitHub Actions; локально: npm run check).
// 1) синтаксис усіх JS-файлів;
// 2) data.json — правильний JSON з усіма розділами;
// 3) кожен локальний файл, на який посилаються сторінки, існує (і кожна іконка є у спрайті);
// 4) SEO й доступність: lang, title, description, canonical, Open Graph, один <h1>, alt у зображень.
// Якщо щось не так — процес завершується з кодом 1, і GitHub Actions не пускає зміни на сайт.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pages = require('./pages');
const errors = [];
const fail = (message) => errors.push(message);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// ---------- 1. синтаксис JavaScript ----------
// --check лише читає код, не виконуючи його. Тип коду вказуємо явно й передаємо файл через stdin:
// для .js-модулів з помилкою звичайний `node --check файл` у Node 22–24 мовчки повертає «успіх».
const scripts = [
  ...fs.readdirSync(path.join(root, 'assets/js')).map((name) => `assets/js/${name}`),
  ...fs.readdirSync(path.join(root, 'scripts')).map((name) => `scripts/${name}`),
].filter((file) => file.endsWith('.js'));
for (const file of scripts) {
  const code = read(file);
  const type = /^\s*(import|export)\s/m.test(code) ? 'module' : 'commonjs';
  const result = spawnSync(process.execPath, [`--input-type=${type}`, '--check'], { input: code, encoding: 'utf8' });
  if (result.status !== 0) fail(`${file}: синтаксична помилка\n${result.stderr.trim().split('\n').slice(0, 4).join('\n')}`);
}

// ---------- 2. дані ----------
try {
  const data = JSON.parse(read('data/data.json'));
  for (const key of ['templates', 'palettes', 'examples', 'faq', 'skillSuggestions']) {
    if (!Array.isArray(data[key]) || !data[key].length) fail(`data.json: немає розділу «${key}»`);
  }
} catch (error) {
  fail(`data.json: ${error.message}`);
}

// ---------- 3–4. сторінки ----------
const sprite = read('assets/icons/sprite.svg');
for (const { file: page, noindex } of pages) {
  if (!fs.existsSync(path.join(root, page))) {
    fail(`${page}: файл не знайдено (запустіть npm run build)`);
    continue;
  }
  const html = read(page);

  // локальні посилання й ресурси
  const links = [
    ...[...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((match) => match[1]),
    ...[...html.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((match) => match[1].split(',').map((item) => item.trim().split(/\s+/)[0])),
  ];
  for (const link of new Set(links)) {
    if (/^(https?:|mailto:|tel:|data:|#)/.test(link)) continue;
    // сторінку noindex (404) віддають за будь-якою адресою, тож відносна адреса в ній зламається на /a/b/c
    if (noindex && !link.startsWith('/')) fail(`${page}: відносна адреса «${link}» (має починатися з /)`);
    if (link.startsWith('/_vercel/')) continue; // скрипт аналітики додає сам Vercel
    const [target, fragment] = link.replace(/^\//, '').split('#');
    if (!target) continue;
    if (!fs.existsSync(path.join(root, target))) fail(`${page}: немає файлу «${target}»`);
    else if (target.endsWith('sprite.svg') && fragment && !sprite.includes(`id="${fragment}"`)) fail(`${page}: у спрайті немає іконки «${fragment}»`);
  }

  if (!/<html[^>]*\slang="uk"/.test(html)) fail(`${page}: немає lang="uk"`);
  if (!/<title>[^<]{5,}<\/title>/.test(html)) fail(`${page}: немає <title>`);
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) fail(`${page}: немає meta description`);
  if (!/<meta name="viewport"/.test(html)) fail(`${page}: немає meta viewport`);
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(`${page}: заголовків <h1> має бути 1, знайдено ${h1}`);
  const noAlt = (html.match(/<img\b(?![^>]*\salt=)[^>]*>/g) || []).length;
  if (noAlt) fail(`${page}: зображень без alt: ${noAlt}`);

  // сторінка noindex (404) не індексується й не має canonical / Open Graph
  if (noindex) {
    if (!/<meta name="robots" content="noindex">/.test(html)) fail(`${page}: немає noindex`);
    continue;
  }
  if (!/<link rel="canonical" href="https:\/\//.test(html)) fail(`${page}: немає canonical`);
  for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card']) {
    if (!html.includes(`"${tag}"`)) fail(`${page}: немає ${tag}`);
  }
}

// JSON-LD на головній має бути правильним JSON
const ld = read('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
try {
  if (!ld) throw new Error('немає блоку');
  JSON.parse(ld[1]);
} catch (error) {
  fail(`index.html: JSON-LD — ${error.message}`);
}

for (const file of ['css/site.css', 'robots.txt', 'sitemap.xml', 'assets/images/og.png', 'vercel.json']) {
  if (!fs.existsSync(path.join(root, file))) fail(`немає файлу ${file}`);
}

if (errors.length) {
  console.error(`Перевірку не пройдено (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Перевірку пройдено: ${scripts.length} скриптів, ${pages.length} сторінок, data.json, посилання, SEO й Open Graph у порядку.`);
