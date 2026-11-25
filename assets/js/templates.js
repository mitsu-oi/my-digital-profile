// Сторінка «Шаблони»: каталог із data.json, фільтр за призначенням і вибір палітри перегляду.
import { el, chip, loadData, showLoadError } from './data.js';
import { renderProfile } from './render-profile.js';

const list = document.querySelector('[data-list]');
const filters = document.querySelector('[data-filters]');
const palettes = document.querySelector('[data-palettes]');
const status = document.querySelector('[data-status]');

// назви розділів для підпису «Обов’язкові розділи» (ті самі, що в конструкторі)
const SECTION_NAMES = { about: 'Про мене', skills: 'Навички', projects: 'Проєкти', experience: 'Досвід', education: 'Освіта', achievements: 'Досягнення', contacts: 'Контакти' };

// стан сторінки: що зараз вибрано
const state = { fit: 'all', palette: 'ink' };
let data = null;

function drawFilters() {
  const options = [{ id: 'all', name: 'Усі' }, ...data.fits];
  filters.replaceChildren(
    ...options.map((option) =>
      chip(option.name, state.fit === option.id, () => {
        state.fit = option.id;
        draw();
      }),
    ),
  );
}

function drawPalettes() {
  palettes.replaceChildren(
    ...data.palettes.map((palette) => {
      const button = chip(palette.name, state.palette === palette.id, () => {
        state.palette = palette.id;
        draw();
      });
      // кружечок із кольорами палітри перед назвою
      const dot = el('span', 'size-4 rounded-full border border-line dark:border-night-line');
      dot.style.background = `linear-gradient(135deg, ${palette.bg} 50%, ${palette.accent} 50%)`;
      dot.setAttribute('aria-hidden', 'true');
      button.prepend(dot);
      return button;
    }),
  );
}

function drawList() {
  const palette = data.palettes.find((item) => item.id === state.palette) || data.palettes[0];
  const sample = data.examples[0].profile; // один і той самий профіль у всіх шаблонах, щоб було легко порівняти
  const shown = data.templates.filter((template) => state.fit === 'all' || template.fits.includes(state.fit));

  const cards = shown.map((template) => {
    const card = el('li', 'flex flex-col');
    const article = el('article', 'flex flex-1 flex-col');

    // зменшений перегляд; inert прибирає його з клавіатури й читача екрана, бо це ілюстрація
    const frame = el('div', 'doc h-80 overflow-hidden rounded-lg border border-line dark:border-night-line');
    frame.inert = true;
    const preview = renderProfile(sample, palette, { template: template.id, level: 3 });
    preview.classList.add('min-h-full', '[zoom:0.6]');
    frame.append(preview);

    const fits = data.fits.filter((fit) => template.fits.includes(fit.id)).map((fit) => fit.name.toLowerCase());
    const choose = el('a', 'mt-4 inline-flex min-h-12 items-center justify-center self-start rounded-md border-2 border-ink px-5 font-semibold text-ink transition-colors hover:bg-ink hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-cream dark:text-cream dark:hover:bg-night-raised dark:hover:text-cream dark:focus-visible:outline-cream', `Обрати «${template.name}»`);
    choose.href = `builder.html?template=${encodeURIComponent(template.id)}&palette=${encodeURIComponent(palette.id)}`;

    const text = el('div', 'flex flex-1 flex-col');
    text.append(
      el('h2', 'mt-4 font-serif text-2xl font-bold', template.name),
      el('p', 'mt-2 leading-relaxed text-ink-soft dark:text-cream-soft', template.description),
      el('p', 'mt-2 text-sm text-ink-soft dark:text-cream-soft', `Пасує: ${fits.join(', ')}.`),
      el('p', 'mt-1 flex-1 text-sm text-ink-soft dark:text-cream-soft', `Обов’язкові розділи: ${(template.required || []).map((type) => SECTION_NAMES[type]).join(', ')}.`),
      choose,
    );
    article.append(frame, text);
    card.append(article);
    return card;
  });

  list.replaceChildren(...cards);
  list.setAttribute('aria-busy', 'false');
  status.textContent = shown.length ? `Показано шаблонів: ${shown.length} з ${data.templates.length}. Палітра: ${palette.name}.` : 'Для цього призначення шаблонів немає. Оберіть інше.';
}

function draw() {
  drawFilters();
  drawPalettes();
  drawList();
}

async function start() {
  status.textContent = 'Завантаження шаблонів…';
  try {
    data = await loadData();
    draw();
  } catch (error) {
    console.warn('Дані не завантажено:', error.message);
    status.textContent = '';
    showLoadError(list, start);
  }
}

if (list && filters && palettes && status) start();
