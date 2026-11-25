// Конструктор профілю (етап 3): бланк, палітра, особисті дані, розділи й живий перегляд.
// Принцип: увесь профіль зберігається в одному об’єкті state; форма змінює state, а перегляд щоразу
// малюється з нього заново спільною функцією renderProfile (та сама, що на сторінках «Шаблони» й «Приклади»).
// Безпека: текст користувача потрапляє на сторінку лише через textContent / value, посилання — лише http(s).
import { el, loadData, showLoadError } from './data.js';
import { renderProfile, safeLink, EMAIL_RE } from './render-profile.js';

// ---------- Обмеження (захист від надто довгих даних і переповнення сторінки) ----------
const LIMITS = {
  text: 600, // «Про мене»
  title: 80,
  short: 60, // місце, період
  entryText: 300,
  link: 200,
  skills: 15, // кількість навичок
  skill: 40, // довжина однієї навички
  achievements: 10,
  achievement: 120,
  entries: 8, // проєктів / місць досвіду
  education: 5,
  photoBytes: 5 * 1024 * 1024, // 5 МБ — розмір файла, який ще приймаємо
  photoSide: 480, // фото зменшується до цієї довшої сторони
};

// Розділи: назва, підказка й підписи полів для записів (проєкт, досвід, освіта)
const BLOCKS = {
  about: { title: 'Про мене', hint: '2–3 речення: чим займаєтеся і що вам цікаво.' },
  skills: { title: 'Навички', hint: 'Через кому: Figma, Дослідження, Прототипи.' },
  projects: { title: 'Проєкти', entry: 'Проєкт', max: LIMITS.entries, fields: [['title', 'Назва'], ['text', 'Що зроблено', 'textarea'], ['link', 'Посилання', 'link']] },
  experience: { title: 'Досвід', entry: 'Місце роботи', max: LIMITS.entries, fields: [['title', 'Посада'], ['place', 'Де'], ['period', 'Коли'], ['text', 'Що робили', 'textarea']] },
  education: { title: 'Освіта', entry: 'Навчання', max: LIMITS.education, fields: [['title', 'Спеціальність'], ['place', 'Заклад'], ['period', 'Роки']] },
  achievements: { title: 'Досягнення', hint: 'Кожне з нового рядка.' },
  contacts: { title: 'Контакти', hint: 'Достатньо одного способу зв’язку.' },
};
const ORDER = Object.keys(BLOCKS);

const PHONE_RE = /^\+380 \(\d{2}\) \d{3}-\d{2}-\d{2}$/;

// ---------- Елементи сторінки ----------
const root = document.querySelector('[data-builder]');
const form = root?.querySelector('[data-form]');
const preview = root?.querySelector('[data-preview]');
const templatesBox = root?.querySelector('[data-templates]');
const palettesBox = root?.querySelector('[data-palettes]');
const blocksBox = root?.querySelector('[data-blocks]');
const addType = root?.querySelector('[data-add-type]');
const addRow = root?.querySelector('[data-add-row]');
const allAdded = root?.querySelector('[data-all-added]');
const announcer = root?.querySelector('[data-announce]');
const photoInput = root?.querySelector('[data-photo]');
const photoRemove = root?.querySelector('[data-action="photo-remove"]');

let data = null; // вміст data.json
let state = null; // поточний профіль
let dirty = false; // чи є незбережені зміни (до появи чернетки на етапі 4)
let uid = 0;
const newId = () => `b${Date.now().toString(36)}${(uid++).toString(36)}`;

// ---------- Початковий профіль ----------
function emptyBlock(type) {
  const block = { id: newId(), type };
  if (type === 'about') block.text = '';
  if (type === 'skills' || type === 'achievements') block.items = [];
  if (BLOCKS[type].fields) block.items = [];
  if (type === 'contacts') Object.assign(block, { email: '', phone: '', link: '' });
  return block;
}

// Копія прикладу з data.json: беремо лише відомі поля потрібних типів (дані з файла теж не довіряємо наосліп)
function cleanProfile(source) {
  const str = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
  const person = source.person || {};
  const blocks = (Array.isArray(source.blocks) ? source.blocks : [])
    .filter((block) => block && BLOCKS[block.type])
    .filter((block, index, list) => list.findIndex((other) => other.type === block.type) === index) // кожен тип один раз
    .map((block) => {
      const clean = emptyBlock(block.type);
      if (block.type === 'about') clean.text = str(block.text, LIMITS.text);
      if (block.type === 'skills') clean.items = (block.items || []).map((item) => str(item, LIMITS.skill)).filter(Boolean).slice(0, LIMITS.skills);
      if (block.type === 'achievements') clean.items = (block.items || []).map((item) => str(item, LIMITS.achievement)).filter(Boolean).slice(0, LIMITS.achievements);
      if (BLOCKS[block.type].fields) {
        clean.items = (block.items || []).slice(0, BLOCKS[block.type].max).map((item) => ({
          title: str(item.title, LIMITS.title),
          place: str(item.place, LIMITS.short),
          period: str(item.period, LIMITS.short),
          text: str(item.text, LIMITS.entryText),
          link: str(item.link, LIMITS.link),
        }));
      }
      if (block.type === 'contacts') Object.assign(clean, { email: str(block.email, 80), phone: str(block.phone, 20), link: str(block.link, LIMITS.link) });
      return clean;
    });
  return {
    template: source.template,
    palette: source.palette,
    number: `000 ${String(Math.floor(Math.random() * 900) + 100)}`,
    person: { name: str(person.name, 60), role: str(person.role, 80), city: str(person.city, 40) },
    photo: '',
    blocks,
  };
}

// Читає параметри адреси: ?template=&palette= (зі сторінки «Шаблони»), ?example= (з «Прикладів»), ?name=&role= (з головної)
function initialState() {
  const params = new URLSearchParams(location.search);
  const example = data.examples.find((item) => item.id === params.get('example'));
  const profile = example
    ? cleanProfile(example.profile)
    : cleanProfile({ person: { name: params.get('name') || '', role: params.get('role') || '' }, blocks: [{ type: 'about' }, { type: 'skills' }, { type: 'projects' }, { type: 'contacts' }] });
  const known = (list, id) => (list.some((item) => item.id === id) ? id : null);
  profile.template = known(data.templates, params.get('template')) || known(data.templates, profile.template) || data.templates[0].id;
  profile.palette = known(data.palettes, params.get('palette')) || known(data.palettes, profile.palette) || data.palettes[0].id;
  return profile;
}

// ---------- Перегляд ----------
// Кілька змін за одну подію малюються один раз: перемальовування відкладається до кінця поточного коду
// (мікрозадача). requestAnimationFrame тут не підходить: у фоновій вкладці браузер його не викликає.
let pending = false;
function renderPreview() {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    const palette = data.palettes.find((item) => item.id === state.palette);
    preview.replaceChildren(renderProfile(state, palette, { level: 3 }));
  });
}

function changed() {
  dirty = true;
  renderPreview();
}

function announce(text) {
  announcer.textContent = '';
  // невелика пауза, щоб читач екрана помітив однаковий текст двічі поспіль
  setTimeout(() => (announcer.textContent = text), 50);
}

// ---------- Крок 1–2: бланки й палітри (радіокнопки: працюють з клавіатури стрілками) ----------
const OPTION = 'relative flex min-h-12 cursor-pointer flex-col gap-1 rounded-md border border-line bg-sheet p-3 transition-colors hover:border-ink-soft has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink dark:border-night-line dark:bg-night-sheet dark:hover:border-cream-soft dark:has-[:checked]:border-stamp-light dark:has-[:checked]:ring-stamp-light dark:has-[:focus-visible]:outline-cream';

function radio(name, value, checked) {
  const input = el('input', 'sr-only');
  Object.assign(input, { type: 'radio', name, value, checked });
  return input;
}

function drawChoices() {
  templatesBox.replaceChildren(
    ...data.templates.map((template) => {
      const label = el('label', OPTION);
      label.append(
        radio('template', template.id, template.id === state.template),
        el('span', 'font-serif text-lg font-bold', template.name),
        el('span', 'text-sm leading-snug text-ink-soft dark:text-cream-soft', template.description.split('. ')[0] + '.'),
      );
      return label;
    }),
  );
  palettesBox.replaceChildren(
    ...data.palettes.map((palette) => {
      const label = el('label', `${OPTION} flex-row items-center gap-3`);
      const swatch = el('span', 'flex size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-line dark:ring-night-line');
      swatch.setAttribute('aria-hidden', 'true');
      for (const key of ['bg', 'text', 'accent']) {
        const part = el('span', 'h-full flex-1');
        part.style.background = palette[key];
        swatch.append(part);
      }
      label.append(radio('palette', palette.id, palette.id === state.palette), swatch, el('span', 'font-medium', palette.name));
      return label;
    }),
  );
}

// ---------- Крок 4: редактори розділів ----------
const BTN_SMALL = 'inline-flex size-12 items-center justify-center rounded-md border border-line text-ink transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-line dark:text-cream dark:hover:bg-night-raised dark:focus-visible:outline-cream';
const BTN_TEXT = 'inline-flex min-h-12 items-center rounded-md border border-line px-4 font-semibold text-ink transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-line dark:text-cream dark:hover:bg-night-raised dark:focus-visible:outline-cream';

function iconButton(action, label, symbol, disabled) {
  const button = el('button', BTN_SMALL);
  button.type = 'button';
  button.dataset.action = action;
  button.disabled = disabled;
  button.setAttribute('aria-label', label);
  button.append(el('span', 'text-lg leading-none', symbol));
  button.firstChild.setAttribute('aria-hidden', 'true');
  return button;
}

// Одне поле з підписом і місцем для помилки. dataset описує, куди в state писати значення.
function field({ id, label, value, kind = 'text', max, hint, bind }) {
  const wrap = el('div');
  const labelEl = el('label', 'font-semibold', label);
  labelEl.htmlFor = id;
  const input = el(kind === 'textarea' ? 'textarea' : 'input', 'field');
  input.id = id;
  if (kind !== 'textarea') input.type = kind === 'email' ? 'email' : kind === 'link' ? 'url' : kind === 'phone' ? 'tel' : 'text';
  if (kind === 'email') input.autocomplete = 'email';
  if (kind === 'phone') {
    input.autocomplete = 'tel';
    input.placeholder = '+380 (67) 123-45-67';
  }
  if (kind === 'link') input.placeholder = 'https://';
  input.maxLength = max;
  input.value = value || '';
  Object.assign(input.dataset, bind);
  if (['email', 'phone', 'link'].includes(kind)) input.dataset.rule = kind;
  const describedBy = [];
  wrap.append(labelEl, input);
  if (hint) {
    const hintEl = el('p', 'mt-1.5 text-sm text-ink-soft dark:text-cream-soft', hint);
    hintEl.id = `${id}-hint`;
    describedBy.push(hintEl.id);
    wrap.append(hintEl);
  }
  const error = el('p', 'mt-1 text-sm font-medium text-stamp empty:hidden dark:text-stamp-light');
  error.id = `${id}-error`;
  describedBy.push(error.id);
  wrap.append(error);
  input.setAttribute('aria-describedby', describedBy.join(' '));
  return wrap;
}

function blockEditor(block, index) {
  const info = BLOCKS[block.type];
  const section = el('section', 'rounded-lg border border-line bg-sheet/70 p-4 sm:p-5 dark:border-night-line dark:bg-night-sheet');
  section.dataset.blockId = block.id;
  section.setAttribute('aria-labelledby', `${block.id}-title`);

  // заголовок і кнопки: вгору, вниз, прибрати (альтернатива перетягуванню — вимога WCAG 2.5.7)
  const head = el('div', 'flex items-center justify-between gap-3');
  const title = el('h3', 'font-serif text-xl font-bold', info.title);
  title.id = `${block.id}-title`;
  const tools = el('div', 'flex shrink-0 gap-2');
  tools.append(
    iconButton('up', `Перемістити розділ «${info.title}» вище`, '↑', index === 0),
    iconButton('down', `Перемістити розділ «${info.title}» нижче`, '↓', index === state.blocks.length - 1),
    iconButton('remove', `Прибрати розділ «${info.title}»`, '×', false),
  );
  head.append(title, tools);
  section.append(head);

  const body = el('div', 'mt-4 space-y-4');
  const bind = { block: block.id };

  if (block.type === 'about') {
    body.append(field({ id: `${block.id}-text`, label: 'Текст', value: block.text, kind: 'textarea', max: LIMITS.text, hint: info.hint, bind: { ...bind, field: 'text' } }));
  }
  if (block.type === 'skills') {
    body.append(field({ id: `${block.id}-items`, label: 'Перелік', value: block.items.join(', '), max: LIMITS.skills * (LIMITS.skill + 2), hint: info.hint, bind: { ...bind, field: 'items', list: 'comma' } }));
  }
  if (block.type === 'achievements') {
    body.append(field({ id: `${block.id}-items`, label: 'Досягнення', value: block.items.join('\n'), kind: 'textarea', max: LIMITS.achievements * (LIMITS.achievement + 1), hint: info.hint, bind: { ...bind, field: 'items', list: 'lines' } }));
  }
  if (block.type === 'contacts') {
    body.append(
      field({ id: `${block.id}-email`, label: 'Email', value: block.email, kind: 'email', max: 80, hint: info.hint, bind: { ...bind, field: 'email' } }),
      field({ id: `${block.id}-phone`, label: 'Телефон', value: block.phone, kind: 'phone', max: 20, bind: { ...bind, field: 'phone' } }),
      field({ id: `${block.id}-link`, label: 'Сайт або профіль', value: block.link, kind: 'link', max: LIMITS.link, bind: { ...bind, field: 'link' } }),
    );
  }
  if (info.fields) {
    if (!block.items.length) body.append(el('p', 'text-ink-soft dark:text-cream-soft', `Записів поки немає. Додайте перший: ${info.entry.toLowerCase()}.`));
    block.items.forEach((item, entry) => {
      const group = el('fieldset', 'space-y-4 rounded-md border border-dashed border-line p-4 dark:border-night-line');
      group.append(el('legend', 'px-1 font-mono text-xs text-ink-soft dark:text-cream-soft', `${info.entry} ${entry + 1}`));
      for (const [key, label, kind] of info.fields) {
        const max = key === 'text' ? LIMITS.entryText : key === 'link' ? LIMITS.link : key === 'title' ? LIMITS.title : LIMITS.short;
        group.append(field({ id: `${block.id}-${entry}-${key}`, label, value: item[key], kind: kind || 'text', max, bind: { ...bind, field: key, entry } }));
      }
      const remove = el('button', `${BTN_TEXT} text-sm`, 'Прибрати запис');
      remove.type = 'button';
      remove.dataset.action = 'remove-entry';
      remove.dataset.entry = entry;
      remove.setAttribute('aria-label', `Прибрати: ${info.entry.toLowerCase()} ${entry + 1}`);
      group.append(remove);
      body.append(group);
    });
    const add = el('button', BTN_TEXT, `+ ${info.entry}`);
    add.type = 'button';
    add.dataset.action = 'add-entry';
    add.disabled = block.items.length >= info.max;
    if (add.disabled) add.title = `Не більше ${info.max} записів`;
    body.append(add);
  }
  section.append(body);
  return section;
}

function drawBlocks() {
  if (!state.blocks.length) {
    blocksBox.replaceChildren(el('p', 'rounded-lg border border-dashed border-line p-5 text-ink-soft dark:border-night-line dark:text-cream-soft', 'Розділів поки немає. Почніть із «Про мене»: виберіть його нижче й натисніть «Додати розділ».'));
  } else {
    blocksBox.replaceChildren(...state.blocks.map(blockEditor));
  }
  // у списку «Новий розділ» — лише ті, яких ще немає
  const free = ORDER.filter((type) => !state.blocks.some((block) => block.type === type));
  addType.replaceChildren(...free.map((type) => Object.assign(el('option', '', BLOCKS[type].title), { value: type })));
  addRow.hidden = !free.length;
  allAdded.hidden = Boolean(free.length);
}

// ---------- Перевірка полів ----------
function normalisePhone(value) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('380') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  if (local.length !== 9) return value.trim();
  return `+380 (${local.slice(0, 2)}) ${local.slice(2, 5)}-${local.slice(5, 7)}-${local.slice(7)}`;
}

function checkField(input) {
  const value = input.value.trim();
  let message = '';
  if (value && input.dataset.rule === 'email' && !EMAIL_RE.test(value)) message = 'Перевірте email: має бути на кшталт name@example.com.';
  if (value && input.dataset.rule === 'phone' && !PHONE_RE.test(value)) message = 'Телефон у форматі +380 (67) 123-45-67.';
  if (value && input.dataset.rule === 'link' && !safeLink(value)) message = 'Посилання має починатися з https:// або http://. Інші адреси не показуються.';
  const error = document.getElementById(`${input.id}-error`);
  if (error) error.textContent = message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
}

// ---------- Зміни у формі ----------
function onInput(event) {
  const input = event.target;
  if (input.name === 'template' || input.name === 'palette') {
    state[input.name] = input.value;
    return changed();
  }
  if (input.dataset.person) {
    state.person[input.dataset.person] = input.value;
    return changed();
  }
  const block = state.blocks.find((item) => item.id === input.dataset.block);
  if (!block) return;
  const { field: key, entry, list } = input.dataset;
  if (list === 'comma') {
    block.items = input.value.split(',').map((item) => item.trim().slice(0, LIMITS.skill)).filter(Boolean).slice(0, LIMITS.skills);
  } else if (list === 'lines') {
    block.items = input.value.split('\n').map((item) => item.trim().slice(0, LIMITS.achievement)).filter(Boolean).slice(0, LIMITS.achievements);
  } else if (entry !== undefined) {
    block.items[Number(entry)][key] = input.value;
  } else {
    block[key] = input.value;
  }
  // помилку прибираємо одразу, щойно значення виправлене; нову показуємо лише після виходу з поля
  if (input.getAttribute('aria-invalid') === 'true') checkField(input);
  changed();
}

function onBlur(event) {
  const input = event.target;
  if (!input.dataset?.rule) return;
  if (input.dataset.rule === 'phone' && input.value.trim()) {
    input.value = normalisePhone(input.value);
    const block = state.blocks.find((item) => item.id === input.dataset.block);
    if (block) block.phone = input.value;
    changed();
  }
  checkField(input);
}

// Після перемальовування редакторів повертає фокус на потрібну кнопку (DOM уже оновлено синхронно)
function focusLater(selector) {
  blocksBox.querySelector(selector)?.focus();
}

function onClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button || !form.contains(button)) return;
  const section = button.closest('[data-block-id]');
  const index = section ? state.blocks.findIndex((block) => block.id === section.dataset.blockId) : -1;
  const block = state.blocks[index];
  const action = button.dataset.action;

  if (action === 'add-block' && addType.value) {
    const created = emptyBlock(addType.value);
    state.blocks.push(created);
    drawBlocks();
    announce(`Додано розділ «${BLOCKS[created.type].title}».`);
    blocksBox.querySelector(`[data-block-id="${created.id}"] input, [data-block-id="${created.id}"] textarea, [data-block-id="${created.id}"] [data-action="add-entry"]`)?.focus();
  }
  if ((action === 'up' || action === 'down') && block) {
    const target = action === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= state.blocks.length) return;
    [state.blocks[index], state.blocks[target]] = [state.blocks[target], state.blocks[index]];
    drawBlocks();
    announce(`Розділ «${BLOCKS[block.type].title}» тепер ${target + 1}-й із ${state.blocks.length}.`);
    // фокус лишається на тій самій кнопці; якщо розділ дійшов до краю — на протилежній
    const edge = target === 0 || target === state.blocks.length - 1;
    focusLater(`[data-block-id="${block.id}"] [data-action="${edge ? (action === 'up' ? 'down' : 'up') : action}"]`);
  }
  if (action === 'remove' && block) {
    state.blocks.splice(index, 1);
    drawBlocks();
    announce(`Розділ «${BLOCKS[block.type].title}» прибрано. Його можна додати знову.`);
    const next = state.blocks[Math.min(index, state.blocks.length - 1)];
    // фокус переходить на сусідній розділ (його першу доступну кнопку), а якщо розділів не лишилось — на вибір нового
    (next ? blocksBox.querySelector(`[data-block-id="${next.id}"] button:not(:disabled)`) : addType)?.focus();
  }
  if (action === 'add-entry' && block && block.items.length < BLOCKS[block.type].max) {
    block.items.push({ title: '', place: '', period: '', text: '', link: '' });
    drawBlocks();
    focusLater(`#${block.id}-${block.items.length - 1}-title`);
  }
  if (action === 'remove-entry' && block) {
    block.items.splice(Number(button.dataset.entry), 1);
    drawBlocks();
    announce('Запис прибрано.');
    focusLater(`[data-block-id="${block.id}"] [data-action="add-entry"]`);
  }
  if (action === 'photo-remove') {
    state.photo = '';
    photoInput.value = '';
    photoRemove.hidden = true;
    announce('Фото прибрано.');
    photoInput.focus();
  }
  changed();
}

// ---------- Фото: перевірка й зменшення в браузері ----------
async function onPhoto() {
  const file = photoInput.files[0];
  const error = document.getElementById('photo-error');
  error.textContent = '';
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    error.textContent = 'Цей формат не підходить. Оберіть PNG, JPEG або WebP.';
    photoInput.value = '';
    return;
  }
  if (file.size > LIMITS.photoBytes) {
    error.textContent = `Файл завеликий (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум — 5 МБ.`;
    photoInput.value = '';
    return;
  }
  try {
    // зменшуємо до 480 px по довшій стороні: менший файл, швидший перегляд, а згодом і менша чернетка
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, LIMITS.photoSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    state.photo = canvas.toDataURL('image/jpeg', 0.85);
    photoRemove.hidden = false;
    announce('Фото додано.');
    changed();
  } catch (problem) {
    console.warn('Фото не прочитано:', problem);
    error.textContent = 'Не вдалося прочитати зображення. Можливо, файл пошкоджений — спробуйте інший.';
    photoInput.value = '';
  }
}

// ---------- Перемикач «Заповнення / Перегляд» на телефоні ----------
function setView(view) {
  root.dataset.view = view;
  for (const button of root.querySelectorAll('[data-view-btn]')) button.setAttribute('aria-pressed', String(button.dataset.viewBtn === view));
}

// ---------- Запуск ----------
async function start() {
  const loading = form.querySelector('[data-loading]');
  loading.hidden = false;
  try {
    data = await loadData();
  } catch (problem) {
    console.warn('Дані не завантажено:', problem.message);
    loading.hidden = true;
    showLoadError(templatesBox, () => location.reload());
    return;
  }
  loading.hidden = true;
  state = initialState();
  for (const input of form.querySelectorAll('[data-person]')) input.value = state.person[input.dataset.person];
  drawChoices();
  drawBlocks();
  renderPreview();

  form.addEventListener('input', onInput);
  form.addEventListener('focusout', onBlur);
  form.addEventListener('click', onClick);
  form.addEventListener('submit', (event) => event.preventDefault()); // Enter у полі не перезавантажує сторінку
  photoInput.addEventListener('change', onPhoto);
  for (const button of root.querySelectorAll('[data-view-btn]')) button.addEventListener('click', () => setView(button.dataset.viewBtn));
  // поки немає чернетки (етап 4), попереджаємо перед закриттям сторінки зі змінами
  window.addEventListener('beforeunload', (event) => {
    if (dirty) event.preventDefault();
  });
}

if (root && form && preview && templatesBox && palettesBox && blocksBox && addType && addRow && allAdded && announcer && photoInput && photoRemove) start();
