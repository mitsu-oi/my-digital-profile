// Спільні помічники для сторінок, що беруть вміст із data/data.json.

// Створює елемент: тег, класи, текст. Текст ставиться через textContent, тому HTML у ньому не виконується.
export function el(tag, classes = '', text = '') {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text) node.textContent = text;
  return node;
}

// Завантажує дані сайту. Кидає помилку, якщо сервер відповів не 200 або файл має не той вигляд.
export async function loadData() {
  const response = await fetch('data/data.json');
  if (!response.ok) throw new Error(`Сервер відповів кодом ${response.status}`);
  const data = await response.json();
  const lists = ['templates', 'palettes', 'examples', 'faq'];
  if (!lists.every((name) => Array.isArray(data[name]))) throw new Error('У файлі даних бракує розділів');
  return data;
}

// Показує в контейнері повідомлення про помилку з кнопкою «Спробувати ще».
export function showLoadError(container, retry) {
  const box = el('div', 'rounded-lg border border-stamp bg-sheet p-6 dark:border-stamp-light dark:bg-night-sheet');
  box.setAttribute('role', 'alert');
  box.append(
    el('p', 'font-serif text-xl font-bold', 'Не вдалося завантажити дані'),
    el('p', 'mt-2 text-ink-soft dark:text-cream-soft', 'Перевірте з’єднання з інтернетом і спробуйте ще раз.'),
  );
  const button = el('button', 'mt-4 inline-flex min-h-12 items-center rounded-md border-2 border-ink px-5 font-semibold text-ink hover:bg-ink hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-cream dark:text-cream dark:hover:bg-night-raised dark:hover:text-cream dark:focus-visible:outline-cream', 'Спробувати ще');
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
