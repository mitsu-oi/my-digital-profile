// Спільна поведінка всіх сторінок ОсьЯ: перемикач теми, мобільне меню, голограма.
// Код ізольовано у функції, глобальних змінних немає.
(() => {
  const root = document.documentElement;

  // ---------- темна / світла тема ----------
  // Початковий стан ставить короткий скрипт у <head>; тут лише кнопка та збереження вибору.
  const themeButton = document.querySelector('[data-theme-toggle]');
  const themeLabel = document.querySelector('[data-theme-label]');
  const themeColor = document.querySelector('meta[name="theme-color"]');

  function showTheme() {
    const dark = root.classList.contains('dark');
    if (themeButton) themeButton.setAttribute('aria-pressed', String(dark));
    if (themeLabel) themeLabel.textContent = dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему';
    if (themeColor) themeColor.setAttribute('content', dark ? '#13161d' : '#f6f3ec'); // колір панелі браузера на телефоні
  }

  if (themeButton) {
    themeButton.addEventListener('click', () => {
      const dark = root.classList.toggle('dark');
      try {
        localStorage.setItem('osya-theme', dark ? 'dark' : 'light');
      } catch (error) {
        // сховище недоступне (приватний режим): тема працює до закриття вкладки
      }
      showTheme();
    });
  }
  showTheme();

  // ---------- мобільне меню ----------
  const menuButton = document.querySelector('[data-menu-toggle]');
  const menu = document.getElementById('mobile-menu');
  if (menuButton && menu) {
    const setOpen = (open) => {
      menu.hidden = !open;
      menuButton.setAttribute('aria-expanded', String(open));
    };
    menuButton.addEventListener('click', () => setOpen(menu.hidden));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        setOpen(false);
        menuButton.focus();
      }
    });
    // на широкому екрані меню ховається само, щоб не лишилося відкритим після повороту телефона
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  }

  // ---------- голограма реагує на рух миші ----------
  // Позиція курсора записується у CSS-змінні; градієнт у стилях зсувається слідом.
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm) {
    let frame = 0;
    window.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse' || frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          root.style.setProperty('--holo-x', `${Math.round((event.clientX / window.innerWidth) * 100)}%`);
          root.style.setProperty('--holo-y', `${Math.round((event.clientY / window.innerHeight) * 100)}%`);
        });
      },
      { passive: true },
    );
  }
})();
