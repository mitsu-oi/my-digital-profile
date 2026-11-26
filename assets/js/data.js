// Спільні помічники для сторінок, що беруть вміст із data/data.json.

// Створює елемент: тег, класи, текст. Текст ставиться через textContent, тому HTML у ньому не виконується.
export function el(tag, classes = '', text = '') {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text) node.textContent = text;
  return node;
}

// Завантажує дані сайту. Кидає помилку, якщо сервер відповів не 200 або файл має не той вигляд.
// Один запит на сторінку: кілька модулів (віяло й стос на головній) отримують той самий результат.
// Після помилки запам’ятоване скидається, тож кнопка «Спробувати ще» справді робить новий запит.
let pending = null;
export function loadData() {
  pending ??= fetchData().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

async function fetchData() {
  const response = await fetch('data/data.json');
  if (!response.ok) throw new Error(`Сервер відповів кодом ${response.status}`);
  const data = await response.json();
  const lists = ['templates', 'palettes', 'examples', 'faq'];
  if (!lists.every((name) => Array.isArray(data[name]))) throw new Error('У файлі даних бракує розділів');
  return data;
}

// Транслітерація (спрощена офіційна таблиця 2010 року): для імені файла й машинозчитуваного рядка «паспорта»
export const LATIN = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia' };

// Елемент списку з таким id, а якщо його немає — перший (бланк чи палітра за замовчуванням).
export const byId = (list, id) => list.find((item) => item.id === id) || list[0];

// Контурна кнопка (другорядна дія): та сама в повідомленні про помилку й на картках прикладів.
export const BTN_OUTLINE = 'inline-flex min-h-12 items-center rounded-md border-2 border-ink px-5 font-semibold text-ink transition-colors hover:bg-ink hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-cream dark:text-cream dark:hover:bg-night-raised dark:hover:text-cream dark:focus-visible:outline-cream';

// Прихована радіокнопка всередині <label>-картки (бланки й палітри): стрілки й Tab працюють самі.
export function radio(name, value, checked) {
  const input = el('input', 'sr-only');
  Object.assign(input, { type: 'radio', name, value, checked });
  return input;
}

// Користувач просив менше руху (системне налаштування)
export const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Викликає callback один раз, коли елемент наближається до екрана (на ~600 px).
// Так важкі зменшені профілі не малюються, поки до них не догорнули (Lighthouse: TBT).
export function whenNear(element, callback, rootMargin = '600px 0px') {
  if (!('IntersectionObserver' in window)) return callback();
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    callback();
  }, { rootMargin });
  observer.observe(element);
}

// Підключає скрипт чи стиль із CDN з перевіркою цілісності (SRI). Проміс завершується після завантаження.
export function loadFile(tag, attrs) {
  return new Promise((resolve, reject) => {
    const node = document.createElement(tag);
    Object.assign(node, attrs, { crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' });
    node.addEventListener('load', resolve, { once: true });
    node.addEventListener('error', () => reject(new Error(`Не завантажено ${attrs.src || attrs.href}`)), { once: true });
    document.head.append(node);
  });
}

// Показує в контейнері повідомлення про помилку з кнопкою «Спробувати ще».
// error (необов’язково) пишеться в консоль, щоб причину було видно розробнику.
export function showLoadError(container, retry, error) {
  if (error) console.warn('Дані не завантажено:', error.message);
  const box = el('div', 'rounded-lg border border-stamp bg-sheet p-6 dark:border-stamp-light dark:bg-night-sheet');
  box.setAttribute('role', 'alert');
  box.append(
    el('p', 'font-serif text-xl font-bold', 'Не вдалося завантажити дані'),
    el('p', 'mt-2 text-ink-soft dark:text-cream-soft', 'Перевірте з’єднання з інтернетом і спробуйте ще раз.'),
  );
  const button = el('button', `mt-4 ${BTN_OUTLINE}`, 'Спробувати ще');
  button.type = 'button';
  button.addEventListener('click', retry);
  box.append(button);
  container.replaceChildren(box);
}

// Кнопка-перемикач для фільтрів і палітр. Натиснута позначається aria-pressed="true".
export function chip(text, pressed, onClick) {
  const button = el('button', 'inline-flex min-h-12 items-center gap-2 rounded-md border border-line bg-sheet px-4 text-[15px] font-medium text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-cream dark:border-night-line dark:bg-night-sheet dark:text-cream dark:hover:border-cream dark:focus-visible:outline-cream dark:aria-pressed:border-stamp-light dark:aria-pressed:bg-night-raised dark:aria-pressed:text-cream', text);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(pressed));
  button.addEventListener('click', onClick);
  return button;
}
