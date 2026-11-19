// Сторінка «Приклади»: готові профілі з data.json, фільтр за сферою, перегляд у повному розмірі в <dialog>.
import { el, chip, loadData, showLoadError } from './data.js';
import { renderProfile } from './render-profile.js';

const list = document.querySelector('[data-list]');
const filters = document.querySelector('[data-filters]');
const status = document.querySelector('[data-status]');
const dialog = document.querySelector('[data-dialog]');
const dialogBody = document.querySelector('[data-dialog-body]');
const dialogTitle = document.querySelector('[data-dialog-title]');
const dialogUse = document.querySelector('[data-dialog-use]');

const state = { sphere: 'all' };
let data = null;
let opener = null; // кнопка, з якої відкрили вікно: після закриття фокус повертається на неї

const paletteOf = (profile) => data.palettes.find((item) => item.id === profile.palette) || data.palettes[0];
const templateName = (profile) => (data.templates.find((item) => item.id === profile.template) || {}).name || '';

// Відкриває приклад у вікні. showModal() сам тримає фокус усередині й закриває вікно клавішею Esc.
function openExample(example, button) {
  opener = button;
  const { profile } = example;
  dialogTitle.textContent = `${profile.person.name}, шаблон «${templateName(profile)}»`;
  dialogBody.replaceChildren(renderProfile(profile, paletteOf(profile), { level: 3 }));
  dialogUse.href = `builder.html?example=${encodeURIComponent(example.id)}`;
  dialog.showModal();
}

function drawFilters() {
  const options = [{ id: 'all', name: 'Усі' }, ...data.spheres];
  filters.replaceChildren(
    ...options.map((option) =>
      chip(option.name, state.sphere === option.id, () => {
        state.sphere = option.id;
        draw();
      }),
    ),
  );
}

function drawList() {
  const shown = data.examples.filter((example) => state.sphere === 'all' || example.sphere === state.sphere);

  const cards = shown.map((example) => {
    const { profile } = example;
    const card = el('li');
    const article = el('article');

    const frame = el('div', 'doc h-72 overflow-hidden rounded-lg border border-line dark:border-night-line');
    frame.inert = true; // ілюстрація: не для клавіатури й читача екрана
    const preview = renderProfile(profile, paletteOf(profile), { level: 3 });
    preview.classList.add('min-h-full', '[zoom:0.6]');
    frame.append(preview);

    const open = el('button', 'mt-3 inline-flex min-h-12 items-center rounded-md border-2 border-ink px-5 font-semibold text-ink transition-colors hover:bg-ink hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-cream dark:text-cream dark:hover:bg-cream dark:hover:text-night dark:focus-visible:outline-cream', 'Переглянути');
    open.type = 'button';
    open.setAttribute('aria-label', `Переглянути профіль: ${profile.person.name}`);
    open.addEventListener('click', () => openExample(example, open));

    article.append(
      frame,
      el('h2', 'mt-4 font-serif text-xl font-bold', profile.person.name),
      el('p', 'mt-1 text-ink-soft dark:text-cream-soft', `${profile.person.role}. Шаблон «${templateName(profile)}», палітра «${paletteOf(profile).name}».`),
      open,
    );
    card.append(article);
    return card;
  });

  list.replaceChildren(...cards);
  list.setAttribute('aria-busy', 'false');
  status.textContent = shown.length ? `Показано прикладів: ${shown.length} з ${data.examples.length}.` : 'У цій сфері прикладів поки немає. Оберіть іншу.';
}

function draw() {
  drawFilters();
  drawList();
}

async function start() {
  status.textContent = 'Завантаження прикладів…';
  try {
    data = await loadData();
    draw();
  } catch (error) {
    console.warn('Дані не завантажено:', error.message);
    status.textContent = '';
    showLoadError(list, start);
  }
}

if (list && filters && status && dialog && dialogBody && dialogTitle && dialogUse) {
  // клацання по затемненому фону (самому <dialog>, а не його вмісту) закриває вікно
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
  dialog.querySelector('[data-dialog-close]')?.addEventListener('click', () => dialog.close());
  start();
}
