// Збирає шість сторінок сайту: спільні <head>, шапка й підвал + вміст із src/pages/<назва>.html.
// Запуск: npm run build:pages. Готові файли (index.html тощо) лежать у корені й не правляться вручну.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SITE = 'https://my-digital-profile.vercel.app/'; // адреса продакшну (уточнити після деплою)

// ---------- сторінки ----------
const pages = [
  { file: 'index.html', nav: null, title: 'ОсьЯ — мій цифровий профіль', description: 'Зберіть портфоліо у вигляді цифрового посвідчення за 10 хвилин: шаблон, палітра, блоки й живий перегляд. Без реєстрації.' },
  { file: 'builder.html', nav: 'Конструктор', title: 'Конструктор портфоліо — ОсьЯ', description: 'Оберіть шаблон і палітру, додайте проєкти та навички й одразу побачте готове портфоліо.' },
  { file: 'templates.html', module: 'templates.js', nav: 'Шаблони', title: 'Шаблони портфоліо — ОсьЯ', description: 'Чотири шаблони цифрового профілю: посвідчення, резюме, досьє та візитка.' },
  { file: 'examples.html', module: 'examples.js', nav: 'Приклади', title: 'Приклади портфоліо — ОсьЯ', description: 'Готові портфоліо різних фахів для натхнення.' },
  { file: 'about.html', module: 'about.js', nav: 'Про сервіс', title: 'Про сервіс — ОсьЯ', description: 'Для кого створено ОсьЯ, як працює сервіс і чому ваші дані не залишають браузер.' },
  { file: 'contact.html', nav: 'Контакти', title: 'Контакти — ОсьЯ', description: 'Напишіть команді сервісу «Мій цифровий профіль».' },
];

// ---------- спільні шматки розмітки ----------
const icon = (name, classes = 'size-5') => `<svg class="${classes}" aria-hidden="true" focusable="false"><use href="assets/icons/sprite.svg#${name}"></use></svg>`;

const logo = `<a href="index.html" class="inline-flex min-h-12 flex-col justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink dark:focus-visible:outline-cream">
          <span class="font-serif text-2xl leading-none font-bold text-ink dark:text-cream">Ось<span class="holo-text">Я</span></span>
          <span class="mt-1 font-mono text-[11px] leading-none tracking-wide whitespace-nowrap text-ink-soft dark:text-cream-soft">мій цифровий профіль</span>
        </a>`;

const navLink = (page, current, classes) => `<a href="${page.file}"${page.file === current ? ' aria-current="page"' : ''} class="${classes}">${page.nav}</a>`;
const NAV_DESKTOP = 'inline-flex min-h-12 items-center border-b-2 border-transparent px-1 text-[15px] font-medium text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:border-stamp aria-[current=page]:text-ink dark:text-cream-soft dark:hover:text-cream dark:focus-visible:outline-cream dark:aria-[current=page]:border-stamp-light dark:aria-[current=page]:text-cream';
const NAV_MOBILE = 'flex min-h-12 items-center border-b border-line px-1 text-base font-medium text-ink aria-[current=page]:text-stamp dark:border-night-line dark:text-cream dark:aria-[current=page]:text-stamp-light';
const BTN_PRIMARY = 'btn-primary min-h-12 items-center justify-center gap-2 rounded-md px-6 text-base font-semibold text-cream transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 dark:focus-visible:outline-cream';

const head = (page) => `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.title}</title>
    <meta name="description" content="${page.description}">
    <link rel="canonical" href="${SITE}${page.file === 'index.html' ? '' : page.file}">
    <meta name="theme-color" content="#f6f3ec">
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
${page.module ? `    <script type="module" src="assets/js/${page.module}"></script>
` : ''}  </head>
  <body class="flex min-h-screen flex-col bg-paper font-sans text-ink antialiased dark:bg-night dark:text-cream">
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-cream">Перейти до основного вмісту</a>
`;

const header = (page) => `    <header class="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm dark:border-night-line dark:bg-night/95">
      <div class="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
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
      <div class="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
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
const stub = (page) => `      <div class="mx-auto w-full max-w-6xl px-5 py-24 md:px-8">
        <p class="font-mono text-sm text-stamp dark:text-stamp-light">Сторінка в роботі</p>
        <h1 class="mt-3 font-serif text-4xl font-bold">${page.nav}</h1>
        <p class="mt-4 max-w-xl text-lg text-ink-soft dark:text-cream-soft">Цей розділ з’явиться на наступному етапі.</p>
      </div>`;

for (const page of pages) {
  const source = path.join(root, 'src', 'pages', page.file);
  const content = fs.existsSync(source) ? fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n').trimEnd() : stub(page);
  const html = `${head(page)}${header(page)}\n    <main id="main" tabindex="-1" class="flex-1">\n${content}\n    </main>\n\n${footer()}`;
  fs.writeFileSync(path.join(root, page.file), html);
}
console.log('Зібрано сторінок:', pages.length);
