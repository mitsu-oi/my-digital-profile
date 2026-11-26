// Збирає сторінки сайту: спільні <head>, шапка й підвал + вміст із src/pages/<назва>.html.
// Також генерує robots.txt і sitemap.xml. Запуск: npm run build:pages.
// Готові файли (index.html тощо) лежать у корені й не правляться вручну.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
// Адреса продакшну (Vercel): від неї будуються canonical, Open Graph, robots.txt і sitemap.xml.
const SITE = 'https://my-digital-profile-blond.vercel.app/';
const OG_IMAGE = `${SITE}assets/images/og.png`;

// ---------- сторінки ----------
const pages = require('./pages');

// Структуровані дані для головної: описуємо лише те, що справді є на сторінці (безкоштовний вебзастосунок)
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'ОсьЯ — мій цифровий профіль',
  alternateName: 'Мій цифровий профіль',
  url: SITE,
  description: 'Конструктор портфоліо у вигляді цифрового посвідчення: бланк, палітра, розділи й готовий файл PDF або HTML. Без реєстрації.',
  inLanguage: 'uk',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Будь-який сучасний браузер',
  image: OG_IMAGE,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'UAH' },
};

// ---------- спільні шматки розмітки ----------
const icon = (name, classes = 'size-5') => `<svg class="${classes}" aria-hidden="true" focusable="false"><use href="assets/icons/sprite.svg#${name}"></use></svg>`;

const logo = `<a href="index.html" class="inline-flex min-h-12 flex-col justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink dark:focus-visible:outline-cream">
          <span class="font-serif text-2xl leading-none font-bold text-ink dark:text-cream">Ось<span class="holo-text">Я</span></span>
          <span class="mt-1 font-mono text-[11px] leading-none tracking-wide whitespace-nowrap text-ink-soft dark:text-cream-soft">мій цифровий профіль</span>
        </a>`;

const navLink = (page, current, classes) => `<a href="${page.file}"${page.file === current ? ' aria-current="page"' : ''} class="${classes}">${page.nav}</a>`;
const NAV_DESKTOP = 'inline-flex min-h-12 items-center border-b-2 border-transparent px-1 text-[15px] font-medium text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:border-stamp aria-[current=page]:text-ink dark:text-cream-soft dark:hover:text-cream dark:focus-visible:outline-cream dark:aria-[current=page]:border-stamp-light dark:aria-[current=page]:text-cream';
const NAV_MOBILE = 'flex min-h-12 items-center border-b border-line px-1 text-base font-medium text-ink aria-[current=page]:text-stamp dark:border-night-line dark:text-cream dark:aria-[current=page]:text-stamp-light';
const BTN_PRIMARY = 'btn-primary min-h-12 items-center justify-center gap-2 rounded-md px-6 text-base font-semibold text-cream transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 active:scale-[0.97] dark:focus-visible:outline-cream';

// повна адреса сторінки: головна — просто адреса сайту
const url = (page) => `${SITE}${page.file === 'index.html' ? '' : page.file}`;

const head = (page) => `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.title}</title>
    <meta name="description" content="${page.description}">
${page.noindex ? `    <meta name="robots" content="noindex">
` : `    <link rel="canonical" href="${url(page)}">
    <!-- Open Graph і Twitter: картка з картинкою, коли посиланням діляться в месенджерах і соцмережах -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="ОсьЯ — мій цифровий профіль">
    <meta property="og:locale" content="uk_UA">
    <meta property="og:title" content="${page.title}">
    <meta property="og:description" content="${page.description}">
    <meta property="og:url" content="${url(page)}">
    <meta property="og:image" content="${OG_IMAGE}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="ОсьЯ: портфоліо, оформлене як документ, приклад профілю з печаткою «Перевірено»">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${page.title}">
    <meta name="twitter:description" content="${page.description}">
    <meta name="twitter:image" content="${OG_IMAGE}">
`}${page.file === 'index.html' ? `    <script type="application/ld+json">${JSON.stringify(JSON_LD)}</script>
` : ''}    <meta name="theme-color" content="#f6f3ec">
    <!-- Тема ставиться до першого малювання сторінки, щоб не було миготіння: збережений вибір або налаштування системи -->
    <script>
      (function () {
        var saved = null;
        try { saved = localStorage.getItem('osya-theme'); } catch (error) {}
        var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (dark) document.documentElement.classList.add('dark');
      })();
    </script>
    <link rel="preload" href="assets/fonts/golos-text-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="assets/fonts/lora-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="css/site.css">
    <link rel="icon" type="image/svg+xml" href="assets/images/favicon.svg">
    <script src="assets/js/site.js" defer></script>
    <!-- Vercel Web Analytics: рахує анонімні перегляди сторінок без cookies. Профіль і введені дані не передаються.
         Скрипт /_vercel/insights/script.js існує лише на сайті, розгорнутому на Vercel (локально дає 404 — це нормально). -->
    <script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
    <script src="/_vercel/insights/script.js" defer></script>
${page.module ? `    <script type="module" src="assets/js/${page.module}"></script>
` : ''}  </head>
  <body class="site-bg flex min-h-screen flex-col bg-paper font-sans text-ink antialiased dark:bg-night dark:text-cream">
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-cream">Перейти до основного вмісту</a>
`;

const header = (page) => `    <header class="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm dark:border-night-line dark:bg-night/95">
      <div class="mx-auto flex h-20 w-full max-w-page items-center justify-between gap-4 px-5 md:px-8 xl:px-12">
        ${logo}

        <nav aria-label="Головна навігація" class="hidden lg:block">
          <ul class="flex items-center gap-7">
${pages.filter((p) => p.nav).map((p) => `            <li>${navLink(p, page.file, NAV_DESKTOP)}</li>`).join('\n')}
          </ul>
        </nav>

        <div class="flex items-center gap-2">
          <button type="button" data-theme-toggle aria-pressed="false" class="inline-flex size-12 items-center justify-center rounded-md border border-line text-ink transition-colors hover:bg-sheet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-night-line dark:text-cream dark:hover:bg-night-sheet dark:focus-visible:outline-cream">
            <span class="sr-only" data-theme-label>Увімкнути темну тему</span>
            <span class="dark:hidden">${icon('moon')}</span>
            <span class="hidden dark:inline">${icon('sun')}</span>
          </button>
          <a href="builder.html" class="${BTN_PRIMARY} hidden sm:inline-flex">Оформити профіль</a>
          <button type="button" data-menu-toggle aria-expanded="false" aria-controls="mobile-menu" class="inline-flex size-12 items-center justify-center rounded-md border border-line text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden dark:border-night-line dark:text-cream dark:focus-visible:outline-cream">
            <span class="sr-only">Меню</span>
            ${icon('menu')}
          </button>
        </div>
      </div>

      <nav id="mobile-menu" aria-label="Мобільна навігація" hidden class="border-t border-line bg-paper px-5 pb-5 lg:hidden dark:border-night-line dark:bg-night">
        <ul>
${pages.filter((p) => p.nav).map((p) => `          <li>${navLink(p, page.file, NAV_MOBILE)}</li>`).join('\n')}
        </ul>
        <a href="builder.html" class="${BTN_PRIMARY} mt-5 flex w-full">Оформити профіль</a>
      </nav>
    </header>
`;

const FOOT_LINK = 'inline-flex min-h-12 items-center text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:text-cream-soft dark:hover:text-cream dark:focus-visible:outline-cream';
const footer = () => `    <footer class="border-t border-line dark:border-night-line">
      <div class="mx-auto grid w-full max-w-page gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-8 xl:px-12">
        <div>
          ${logo}
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft dark:text-cream-soft">
            Портфоліо у вигляді цифрового посвідчення. Без реєстрації: усе, що ви вводите, лишається у вашому браузері.
          </p>
        </div>
        <nav aria-label="Сторінки сайту">
          <h2 class="font-mono text-xs tracking-wide text-ink-soft uppercase dark:text-cream-soft">Розділи</h2>
          <ul class="mt-2">
${pages.filter((p) => p.nav).map((p) => `            <li><a href="${p.file}" class="${FOOT_LINK}">${p.nav}</a></li>`).join('\n')}
          </ul>
        </nav>
        <div>
          <h2 class="font-mono text-xs tracking-wide text-ink-soft uppercase dark:text-cream-soft">Документ</h2>
          <p class="mt-4 font-mono text-sm text-ink dark:text-cream">ОсьЯ № 000 247</p>
          <p class="mt-2 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">Навчальний проєкт. НУ «Львівська політехніка», 2026.</p>
        </div>
      </div>
    </footer>
  </body>
</html>
`;

// ---------- збірка ----------
const stub = (page) => `      <div class="mx-auto w-full max-w-page px-5 py-24 md:px-8 xl:px-12">
        <p class="font-mono text-sm text-stamp dark:text-stamp-light">Сторінка в роботі</p>
        <h1 class="mt-3 font-serif text-4xl font-bold">${page.nav}</h1>
        <p class="mt-4 max-w-xl text-lg text-ink-soft dark:text-cream-soft">Цей розділ з’явиться на наступному етапі.</p>
      </div>`;

for (const page of pages) {
  const source = path.join(root, 'src', 'pages', page.file);
  const content = fs.existsSync(source) ? fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n').trimEnd() : stub(page);
  let html = `${head(page)}${header(page)}\n    <main id="main" tabindex="-1" class="flex-1">\n${content}\n    </main>\n\n${footer()}`;
  // 404 віддається за будь-якою адресою, навіть вкладеною (/a/b/c), тож відносні адреси робимо абсолютними (від кореня).
  // Тег <base> не підходить: він зламав би посилання-якорі на кшталт #main.
  if (page.noindex) {
    const absolute = (url) => (/^([a-z]+:|\/|#)/.test(url) ? url : `/${url}`);
    html = html
      .replace(/(\s(?:href|src)=")([^"]*)"/g, (match, attr, url) => `${attr}${absolute(url)}"`)
      .replace(/(\ssrcset=")([^"]*)"/g, (match, attr, list) => `${attr}${list.split(',').map((item) => absolute(item.trim())).join(', ')}"`);
  }
  fs.writeFileSync(path.join(root, page.file), html);
}
// ---------- robots.txt і sitemap.xml ----------
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(root, 'robots.txt'), `# Дозволено індексувати весь сайт
User-agent: *
Allow: /

Sitemap: ${SITE}sitemap.xml
`);
const indexed = pages.filter((page) => !page.noindex);
fs.writeFileSync(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexed.map((page) => `  <url>
    <loc>${url(page)}</loc>
    <lastmod>${today}</lastmod>
  </url>`).join('\n')}
</urlset>
`);
console.log('Зібрано сторінок:', pages.length, '+ robots.txt, sitemap.xml');
