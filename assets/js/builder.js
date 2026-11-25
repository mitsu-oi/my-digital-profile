// Конструктор профілю (етап 3): бланк, палітра, особисті дані, розділи й живий перегляд.
// Принцип: увесь профіль зберігається в одному об’єкті state; форма змінює state, а перегляд щоразу
// малюється з нього заново спільною функцією renderProfile (та сама, що на сторінках «Шаблони» й «Приклади»).
// Безпека: текст користувача потрапляє на сторінку лише через textContent / value, посилання — лише http(s).
import { el, loadData, showLoadError } from './data.js';
import { renderProfile, safeLink, EMAIL_RE } from './render-profile.js';
import { buildHtmlFile, download, fileName, readProfileFile } from './export.js';

// SortableJS (перетягування розділів) — з CDN, фіксована версія й перевірка цілісності SRI.
// Якщо бібліотека не завантажиться, розділи й далі переставляються кнопками ↑ ↓.
const SORTABLE = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.6/Sortable.min.js',
  integrity: 'sha384-HZZ/fukV+9G8gwTNjN7zQDG0Sp7MsZy5DDN6VfY3Be7V9dvQpEpR2jF2HlyFUUjU',
};

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
  skills: { title: 'Навички', hint: 'Оберіть зі списку або впишіть свою й натисніть «Додати».' },
  projects: { title: 'Проєкти', entry: 'Проєкт', max: LIMITS.entries, fields: [['title', 'Назва'], ['text', 'Що зроблено', 'textarea'], ['link', 'Посилання', 'link']] },
  experience: { title: 'Досвід', entry: 'Місце роботи', max: LIMITS.entries, fields: [['title', 'Посада'], ['place', 'Де'], ['period', 'Період роботи', 'years'], ['text', 'Що робили', 'textarea']] },
  education: { title: 'Освіта', entry: 'Навчання', max: LIMITS.education, fields: [['title', 'Спеціальність'], ['place', 'Заклад'], ['period', 'Роки навчання', 'years']] },
  achievements: { title: 'Досягнення', hint: 'Кожне з нового рядка.' },
  contacts: { title: 'Контакти', hint: 'Достатньо одного способу зв’язку.' },
};
const ORDER = Object.keys(BLOCKS);

const PHONE_RE = /^\+380 \(\d{2}\) \d{3}-\d{2}-\d{2}$/;

// ---------- Роки для досвіду й освіти: лише вибір зі списку, довільний текст не вводиться ----------
const THIS_YEAR = new Date().getFullYear();
const FIRST_YEAR = 1960;

// «2021», «now» → «2021 — дотепер». Порожні частини пропускаються.
function formatPeriod(from, to) {
  const end = to === 'now' ? 'дотепер' : to;
  if (from && end) return `${from} — ${end}`;
  if (from) return `з ${from}`;
  if (end) return to === 'now' ? 'дотепер' : `до ${end}`;
  return '';
}

// Зворотне перетворення для прикладів із data.json: «2018 — 2022», «2021 — дотепер»
function parsePeriod(period) {
  const match = /(\d{4})(?:\s*[—–-]\s*(\d{4}|дотепер))?/i.exec(String(period || ''));
  if (!match) return { from: '', to: '' };
  return { from: match[1], to: match[2] ? (/\d/.test(match[2]) ? match[2] : 'now') : '' };
}

const periodProblem = (from, to) => (from && to && to !== 'now' && Number(to) < Number(from) ? 'Рік завершення не може бути раніше за рік початку.' : '');

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
        clean.items = (block.items || []).slice(0, BLOCKS[block.type].max).map((item) => {
          const year = (value) => (typeof value === 'string' && (/^\d{4}$/.test(value) || value === 'now') ? value : '');
          const parsed = parsePeriod(item.period);
          const from = year(item.from) || parsed.from;
          const to = year(item.to) || parsed.to;
          return {
            title: str(item.title, LIMITS.title),
            place: str(item.place, LIMITS.short),
            from,
            to,
            period: periodProblem(from, to) ? '' : formatPeriod(from, to),
            text: str(item.text, LIMITS.entryText),
            link: str(item.link, LIMITS.link),
          };
        });
      }
      if (block.type === 'contacts') Object.assign(clean, { email: str(block.email, 80), phone: str(block.phone, 20), link: str(block.link, LIMITS.link) });
      return clean;
    });
  return {
    template: source.template,
    palette: source.palette,
    number: /^000 \d{3}$/.test(source.number) ? source.number : `000 ${String(Math.floor(Math.random() * 900) + 100)}`,
    person: { name: str(person.name, 60), role: str(person.role, 80), city: str(person.city, 40) },
    // фото з чернетки приймаємо лише як data:image і не більше ~1,5 МБ тексту
    photo: typeof source.photo === 'string' && source.photo.length < 1_500_000 && /^data:image\/(png|jpeg|webp);base64,/.test(source.photo) ? source.photo : '',
    blocks,
  };
}

// Читає параметри адреси: ?template=&palette= (зі сторінки «Шаблони»), ?example= (з «Прикладів»), ?name=&role= (з головної)
function initialState(params = new URLSearchParams(location.search)) {
  const example = data.examples.find((item) => item.id === params.get('example'));
  const profile = example
    ? cleanProfile(example.profile)
    : cleanProfile({ person: { name: params.get('name') || '', role: params.get('role') || '' }, blocks: [] });
  const known = (list, id) => (list.some((item) => item.id === id) ? id : null);
  profile.template = known(data.templates, params.get('template')) || known(data.templates, profile.template) || data.templates[0].id;
  profile.palette = known(data.palettes, params.get('palette')) || known(data.palettes, profile.palette) || data.palettes[0].id;
  state = profile;
  ensureRequired();
  return profile;
}

// ---------- Обов’язкові розділи бланку ----------
const currentTemplate = () => data.templates.find((item) => item.id === state.template);
const requiredTypes = () => currentTemplate()?.required || [];

// Додає порожні обов’язкові розділи, яких бракує. Позначка auto — «додано автоматично»:
// такий розділ зникне при зміні бланку, якщо лишився порожнім і новому бланку не потрібен.
function ensureRequired() {
  const added = [];
  const required = requiredTypes();
  required.forEach((type, order) => {
    if (state.blocks.some((block) => block.type === type)) return;
    // ставимо розділ перед першим наявним обов’язковим, який у бланку йде після нього;
    // якщо такого немає — після останнього наявного обов’язкового (а не в самий кінець за додатковими)
    const later = state.blocks.findIndex((block) => required.indexOf(block.type) > order);
    let place = later;
    if (later < 0) {
      const lastRequired = state.blocks.map((block) => required.includes(block.type)).lastIndexOf(true);
      place = lastRequired < 0 ? 0 : lastRequired + 1;
    }
    state.blocks.splice(place, 0, { ...emptyBlock(type), auto: true });
    added.push(BLOCKS[type].title);
  });
  return added;
}

function dropUnneededAuto() {
  const required = requiredTypes();
  state.blocks = state.blocks.filter((block) => !(block.auto && !required.includes(block.type) && blockStatus(block) === 'empty'));
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
    preview.replaceChildren(renderProfile({ ...state, sections: allowedTypes() }, palette, { level: 3 }));
    updateMeter();
  });
}

function changed() {
  renderPreview();
  scheduleSave();
}

// ---------- Чернетка в localStorage ----------
// Зберігається лише в цьому браузері (на сервер нічого не йде), живе 30 днів від останньої зміни.
// Формат: { version, savedAt, profile }. При читанні все проходить через cleanProfile — білий список полів.
// Чому не cookies: вони вміщують лише ~4 КБ і браузер надсилає їх на сервер із кожним запитом.
const DRAFT_KEY = 'osya-draft';
const DRAFT_VERSION = 1;
const DRAFT_DAYS = 30;
const draftStatus = root?.querySelector('[data-draft-status]');
let saveTimer = 0;

function setDraftStatus(text, problem = false) {
  if (!draftStatus) return;
  draftStatus.textContent = text;
  draftStatus.classList.toggle('text-stamp', problem);
  draftStatus.classList.toggle('dark:text-stamp-light', problem);
  draftStatus.classList.toggle('font-medium', problem);
}

function removeDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    /* сховище недоступне — видаляти нічого */
  }
}

function readDraft() {
  let raw = null;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch (error) {
    setDraftStatus('Браузер заборонив сховище (можливо, приватний режим), тому чернетка не зберігатиметься.', true);
    return null;
  }
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    const age = Date.now() - Date.parse(draft.savedAt);
    // застара, іншої версії чи пошкоджена чернетка не ламає сторінку — просто ігнорується й видаляється
    if (draft.version !== DRAFT_VERSION || !(age >= 0 && age < DRAFT_DAYS * 864e5) || !draft.profile || typeof draft.profile !== 'object') throw new Error('стара або чужа чернетка');
    return draft;
  } catch (error) {
    console.warn('Чернетку не прочитано:', error.message);
    removeDraft();
    return null;
  }
}

const timeText = (date) => date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  const { template, palette, number, person, photo, blocks } = state;
  const write = (profile) => localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: DRAFT_VERSION, savedAt: new Date().toISOString(), profile }));
  try {
    write({ template, palette, number, person, photo, blocks });
    setDraftStatus(`Чернетку збережено о ${timeText(new Date())}. Вона зберігається в цьому браузері 30 днів.`);
  } catch (error) {
    // переповнене сховище (найчастіше через фото): зберігаємо без фото й чесно кажемо про це
    try {
      write({ template, palette, number, person, photo: '', blocks });
      setDraftStatus('Чернетку збережено без фото: у сховищі браузера бракує місця. Фото лишиться, поки сторінка відкрита.', true);
    } catch (again) {
      setDraftStatus('Не вдалося зберегти чернетку: браузер не дозволяє запис. Не закривайте сторінку, поки не збережете файл.', true);
    }
  }
}

// зберігаємо не на кожну літеру, а через пів секунди після останньої зміни
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 500);
}

// профіль із чернетки: білий список полів + перевірка бланку й палітри
function stateFromDraft(draft) {
  const profile = cleanProfile(draft.profile);
  const known = (list, id) => (list.some((item) => item.id === id) ? id : null);
  profile.template = known(data.templates, draft.profile.template) || data.templates[0].id;
  profile.palette = known(data.palettes, draft.profile.palette) || data.palettes[0].id;
  state = profile;
  ensureRequired();
  return profile;
}

// Заповнює форму з поточного state і перемальовує все (після відновлення чернетки чи заміни профілю)
function redrawAll() {
  wasComplete = null;
  for (const input of form.querySelectorAll('[data-person]')) input.value = state.person[input.dataset.person];
  photoRemove.hidden = !state.photo;
  collapsed.clear();
  drawChoices();
  drawBlocks();
  renderPreview();
}

function announce(text) {
  announcer.textContent = '';
  // невелика пауза, щоб читач екрана помітив однаковий текст двічі поспіль
  setTimeout(() => (announcer.textContent = text), 50);
}

// ---------- Крок 1–2: бланки й палітри (радіокнопки: працюють з клавіатури стрілками) ----------
const OPTION = 'relative flex min-h-12 min-w-0 break-words cursor-pointer flex-col gap-1 rounded-md border border-line bg-sheet p-3 transition-colors hover:border-ink-soft has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink dark:border-night-line dark:bg-night-sheet dark:hover:border-cream-soft dark:has-[:checked]:border-stamp-light dark:has-[:checked]:ring-stamp-light dark:has-[:focus-visible]:outline-cream';

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

// Два списки «рік початку / рік завершення». Довільний текст сюди не потрапляє — лише роки зі списку або «дотепер».
function yearsField(idBase, label, item, bind) {
  const group = el('fieldset', 'min-w-0');
  group.append(el('legend', 'font-semibold', label));
  const row = el('div', 'mt-1.5 grid grid-cols-2 gap-3');
  const select = (key, text, withNow) => {
    const wrap = el('div');
    const labelEl = el('label', 'text-sm text-ink-soft dark:text-cream-soft', text);
    labelEl.htmlFor = `${idBase}-${key}`;
    const input = el('select', 'field mt-1');
    input.id = `${idBase}-${key}`;
    Object.assign(input.dataset, bind, { field: key, years: '' });
    const options = [Object.assign(el('option', '', '—'), { value: '' })];
    if (withNow) options.push(Object.assign(el('option', '', 'дотепер'), { value: 'now' }));
    // рік завершення може бути в майбутньому (очікуваний випуск), рік початку — ні
    for (let year = withNow ? THIS_YEAR + 6 : THIS_YEAR; year >= FIRST_YEAR; year--) options.push(Object.assign(el('option', '', String(year)), { value: String(year) }));
    input.append(...options);
    input.value = item[key] || '';
    input.setAttribute('aria-describedby', `${idBase}-years-error`);
    wrap.append(labelEl, input);
    return wrap;
  };
  row.append(select('from', 'Рік початку', false), select('to', 'Рік завершення', true));
  const error = el('p', 'mt-1 text-sm font-medium text-stamp empty:hidden dark:text-stamp-light', periodProblem(item.from, item.to));
  error.id = `${idBase}-years-error`;
  group.append(row, error);
  return group;
}

// Навички: обрані — як «бирки» з кнопкою прибрати; нижче поле для своєї навички (воно ж фільтрує підказки)
// і готові підказки з data.json, згруповані за сферами (як на сайтах вакансій).
// ---------- Згортання карток розділів ----------
let reorderOpen = null; // id розділу, в якого відкрите меню «Вище / Нижче»
let justDragged = false; // після перетягування браузер ще надсилає клік по ручці — його ігноруємо
const collapsed = new Set(); // id згорнутих розділів — переживає перемальовування

// Наскільки заповнено розділ: 'full' — усе потрібне є, 'partial' — щось почате, але не дописане, 'empty' — порожньо.
// Для записів (проєкт, досвід, освіта) обов’язкові назва, місце/текст і період; посилання — необов’язкове.
// period порожній, якщо роки йдуть у неправильному порядку, тож він теж перевіряється
const REQUIRED = { projects: ['title', 'text'], experience: ['title', 'place', 'from', 'period', 'text'], education: ['title', 'place', 'from', 'period'] };
function blockStatus(block) {
  const filled = (value) => typeof value === 'string' && value.trim() !== '';
  if (block.type === 'about') return filled(block.text) ? 'full' : 'empty';
  if (block.type === 'skills' || block.type === 'achievements') return block.items.length ? 'full' : 'empty';
  if (block.type === 'contacts') {
    const values = [block.email, block.phone, block.link].filter(filled);
    if (!values.length) return 'empty';
    const valid = (!filled(block.email) || EMAIL_RE.test(block.email.trim())) && (!filled(block.phone) || phoneOk(block.phone)) && (!filled(block.link) || safeLink(block.link));
    return valid ? 'full' : 'partial';
  }
  if (REQUIRED[block.type]) {
    if (!block.items.length) return 'empty';
    const touched = block.items.some((item) => Object.values(item).some(filled));
    if (!touched) return 'empty';
    const complete = block.items.every((item) => REQUIRED[block.type].every((key) => filled(item[key])) && (!filled(item.link) || safeLink(item.link)));
    return complete ? 'full' : 'partial';
  }
  return 'full';
}

const STATUS = {
  full: { text: 'заповнено', mark: '✓', classes: 'text-ink-soft dark:text-cream-soft' },
  partial: { text: 'є незаповнені поля', mark: '!', classes: 'text-stamp dark:text-stamp-light' },
  empty: { text: 'порожньо', mark: '○', classes: 'text-ink-soft dark:text-cream-soft' },
};

const skillFilters = {}; // текст у полі пошуку для кожного розділу — переживає перемальовування
const openGroups = {}; // номери відкритих груп підказок для кожного розділу
const CHIP = 'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:focus-visible:outline-cream';

function skillsEditor(block, info) {
  const wrap = el('div', 'space-y-4');
  const full = block.items.length >= LIMITS.skills;

  const chosen = el('ul', 'flex flex-wrap gap-2');
  chosen.setAttribute('aria-label', 'Обрані навички');
  for (const skill of block.items) {
    const remove = el('button', `${CHIP} border-ink bg-ink text-cream hover:bg-ink/85 dark:border-stamp-light dark:bg-night-raised dark:text-cream`);
    remove.type = 'button';
    remove.dataset.action = 'remove-skill';
    remove.dataset.skill = skill;
    remove.setAttribute('aria-label', `Прибрати навичку «${skill}»`);
    const cross = el('span', 'text-base leading-none', '×');
    cross.setAttribute('aria-hidden', 'true');
    remove.append(el('span', '', skill), cross);
    const item = el('li');
    item.append(remove);
    chosen.append(item);
  }
  wrap.append(block.items.length ? chosen : el('p', 'text-ink-soft dark:text-cream-soft', 'Навичок поки не обрано.'));

  // своя навичка + пошук серед підказок
  const inputId = `${block.id}-skill-input`;
  const row = el('div');
  const label = el('label', 'font-semibold', 'Своя навичка або пошук');
  label.htmlFor = inputId;
  const line = el('div', 'mt-1.5 flex gap-2');
  const input = el('input', 'field mt-0 min-w-0 flex-1');
  Object.assign(input, { id: inputId, type: 'text', maxLength: LIMITS.skill, value: skillFilters[block.id] || '', placeholder: 'Наприклад, Canva', disabled: full });
  input.dataset.skillInput = block.id;
  input.setAttribute('aria-describedby', `${block.id}-skill-hint ${block.id}-skill-error`);
  const add = el('button', BTN_TEXT, 'Додати');
  Object.assign(add, { type: 'button', disabled: full });
  add.dataset.action = 'add-skill';
  line.append(input, add);
  const hint = el('p', 'mt-1.5 text-sm text-ink-soft dark:text-cream-soft', `${info.hint} Обрано ${block.items.length} з ${LIMITS.skills}.`);
  hint.id = `${block.id}-skill-hint`;
  const error = el('p', 'mt-1 text-sm font-medium text-stamp empty:hidden dark:text-stamp-light', full ? 'Обрано максимум навичок. Щоб додати нову, приберіть одну з обраних.' : '');
  error.id = `${block.id}-skill-error`;
  row.append(label, line, hint, error);
  wrap.append(row);

  // готові підказки
  const lower = block.items.map((item) => item.toLowerCase());
  const groups = el('div', 'space-y-3');
  groups.dataset.skillSuggestions = block.id;
  // кожна група — <details>: відкрита лише перша, решта розкривається за потреби або пошуком
  (data.skillSuggestions || []).forEach(({ group, items }, groupIndex) => {
    const box = el('details', 'group/skills');
    box.dataset.skillGroup = '';
    // які групи відкриті, пам’ятаємо між перемальовуваннями, інакше після вибору навички група згорталась би
    const opened = (openGroups[block.id] ??= new Set([0]));
    box.open = opened.has(groupIndex);
    box.addEventListener('toggle', () => (box.open ? opened.add(groupIndex) : opened.delete(groupIndex)));
    const summary = el('summary', 'flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:focus-visible:outline-cream [&::-webkit-details-marker]:hidden');
    const mark = el('span', 'font-mono text-stamp transition-transform group-open/skills:rotate-45 dark:text-stamp-light', '+');
    mark.setAttribute('aria-hidden', 'true');
    summary.append(mark, el('span', '', group), el('span', 'font-normal text-sm text-ink-soft dark:text-cream-soft', `(${items.length})`));
    box.append(summary);
    const list = el('div', 'mt-1.5 flex flex-wrap gap-2');
    for (const skill of items) {
      const on = lower.includes(skill.toLowerCase());
      const toggle = el('button', `${CHIP} border-line bg-sheet text-ink hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-cream disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-line dark:bg-night-sheet dark:text-cream dark:hover:border-cream-soft dark:aria-pressed:border-stamp-light dark:aria-pressed:bg-night-raised`, on ? `✓ ${skill}` : `+ ${skill}`);
      toggle.type = 'button';
      toggle.dataset.action = 'toggle-skill';
      toggle.dataset.skill = skill;
      toggle.setAttribute('aria-pressed', String(on));
      toggle.setAttribute('aria-label', skill);
      toggle.disabled = full && !on;
      list.append(toggle);
    }
    box.append(list);
    groups.append(box);
  });
  wrap.append(groups);
  applySkillFilter(groups, skillFilters[block.id] || '');
  return wrap;
}

// Показує лише підказки, що містять введений текст; порожні групи ховає
function applySkillFilter(groups, text) {
  const needle = text.trim().toLowerCase();
  for (const box of groups.querySelectorAll('[data-skill-group]')) {
    let visible = 0;
    for (const button of box.querySelectorAll('button')) {
      const show = !needle || button.dataset.skill.toLowerCase().includes(needle);
      button.hidden = !show;
      if (show) visible++;
    }
    box.hidden = !visible;
    if (needle && visible) box.open = true; // під час пошуку збіги одразу видно
  }
}

function addSkill(block, value) {
  const skill = value.trim().replace(/\s+/g, ' ').slice(0, LIMITS.skill);
  if (!skill) return 'Впишіть назву навички.';
  if (block.items.some((item) => item.toLowerCase() === skill.toLowerCase())) return `«${skill}» уже є серед обраних.`;
  if (block.items.length >= LIMITS.skills) return 'Обрано максимум навичок.';
  block.items.push(skill);
  return '';
}

function blockEditor(block, index, count) {
  const info = BLOCKS[block.type];
  const section = el('section', 'rounded-lg border border-line bg-sheet/70 p-4 sm:p-5 dark:border-night-line dark:bg-night-sheet');
  section.dataset.blockId = block.id;
  section.setAttribute('aria-labelledby', `${block.id}-title`);

  // заголовок і кнопки: вгору, вниз, прибрати (альтернатива перетягуванню — вимога WCAG 2.5.7)
  const head = el('div', 'flex items-center justify-between gap-3');
  const isCollapsed = collapsed.has(block.id);
  const required = requiredTypes().includes(block.type);
  // заголовок — кнопка: натиснули — картка згорнулась або розгорнулась (aria-expanded каже читачу екрана стан)
  const title = el('h3', 'min-w-0 flex-1 font-serif text-xl font-bold');
  title.id = `${block.id}-title`;
  const toggle = el('button', 'group/toggle -mx-2 flex min-h-12 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:hover:bg-night-raised dark:focus-visible:outline-cream');
  toggle.type = 'button';
  toggle.dataset.action = 'collapse';
  toggle.setAttribute('aria-expanded', String(!isCollapsed));
  toggle.setAttribute('aria-controls', `${block.id}-body`);
  const chevron = el('span', 'inline-block font-mono text-base text-ink-soft transition-transform duration-150 ease-smooth-out dark:text-cream-soft', '▾');
  chevron.setAttribute('aria-hidden', 'true');
  if (isCollapsed) chevron.classList.add('-rotate-90');
  toggle.append(chevron, el('span', '', info.title));
  if (required) {
    const tag = el('span', 'rounded-sm border border-line px-1.5 py-0.5 font-mono text-[11px] font-normal text-ink-soft dark:border-night-line dark:text-cream-soft', 'обов’язковий');
    toggle.append(tag);
  }
  // у згорнутій картці поруч із назвою — стан заповнення; «!» означає, що всередині є незаповнені поля
  if (isCollapsed) {
    const status = STATUS[blockStatus(block)];
    const badge = el('span', `ml-1 inline-flex items-center gap-1 font-sans text-sm font-semibold ${status.classes}`);
    const mark = el('span', 'inline-flex size-5 items-center justify-center rounded-full border border-current text-xs leading-none', status.mark);
    mark.setAttribute('aria-hidden', 'true');
    badge.append(mark, el('span', '', status.text));
    toggle.append(badge);
  }
  title.append(toggle);
  const tools = el('div', 'flex shrink-0 gap-2');
  // Ручка ⠿ — одна кнопка на три способи змінити порядок:
  //   мишею чи пальцем — перетягнути (SortableJS); з клавіатури — клавіші ↑ ↓, коли ручка у фокусі;
  //   одним натисканням без перетягування (WCAG 2.5.7) — клік відкриває меню «Вище / Нижче».
  const open = reorderOpen === block.id;
  const grip = el('button', `${BTN_SMALL} cursor-grab touch-none text-xl active:cursor-grabbing aria-expanded:border-ink aria-expanded:bg-paper dark:aria-expanded:border-stamp-light dark:aria-expanded:bg-night-raised`);
  grip.type = 'button';
  grip.dataset.action = 'reorder';
  grip.dataset.drag = '';
  grip.disabled = count < 2;
  grip.title = 'Перетягніть, щоб змінити порядок, або натисніть';
  grip.setAttribute('aria-label', `Змінити порядок розділу «${info.title}»`);
  grip.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown');
  grip.setAttribute('aria-expanded', String(open));
  grip.setAttribute('aria-controls', `${block.id}-reorder`);
  const dots = el('span', '', '⠿');
  dots.setAttribute('aria-hidden', 'true');
  grip.append(dots);
  tools.append(grip, ...(required ? [] : [iconButton('remove', `Прибрати розділ «${info.title}»`, '×', false)]));
  head.append(title, tools);
  section.append(head);
  // меню порядку: з’являється лише після кліку по ручці
  const menu = el('div', 'mt-3 flex flex-wrap items-center justify-end gap-2');
  menu.id = `${block.id}-reorder`;
  menu.hidden = !open;
  const moveButton = (action, text, disabled) => {
    const button = el('button', `${BTN_TEXT} text-sm`, text);
    button.type = 'button';
    button.dataset.action = action;
    button.disabled = disabled;
    button.setAttribute('aria-label', `Перемістити розділ «${info.title}» ${action === 'up' ? 'вище' : 'нижче'}`);
    return button;
  };
  menu.append(el('span', 'text-sm text-ink-soft dark:text-cream-soft', `Місце ${index + 1} з ${count}:`), moveButton('up', '↑ Вище', index === 0), moveButton('down', '↓ Нижче', index === count - 1));
  section.append(menu);

  const body = el('div', 'mt-4 space-y-4');
  body.id = `${block.id}-body`;
  body.hidden = isCollapsed;
  const bind = { block: block.id };

  if (block.type === 'about') {
    body.append(field({ id: `${block.id}-text`, label: 'Текст', value: block.text, kind: 'textarea', max: LIMITS.text, hint: info.hint, bind: { ...bind, field: 'text' } }));
  }
  if (block.type === 'skills') body.append(skillsEditor(block, info));
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
        if (kind === 'years') {
          group.append(yearsField(`${block.id}-${entry}`, label, item, { ...bind, entry }));
          continue;
        }
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

// Які розділи вміє показати поточний бланк (поле sections у data.json; без нього — усі)
function allowedTypes() {
  return data.templates.find((item) => item.id === state.template)?.sections || ORDER;
}
// Розділи, що є в профілі й показуються в поточному бланку — лише їх видно у формі
const visibleBlocks = () => state.blocks.filter((block) => allowedTypes().includes(block.type));

function drawBlocks() {
  const visible = visibleBlocks();
  const hidden = state.blocks.filter((block) => !visible.includes(block));
  const nodes = visible.length
    ? visible.map((block, index) => blockEditor(block, index, visible.length))
    : [el('p', 'rounded-lg border border-dashed border-line p-5 text-ink-soft dark:border-night-line dark:text-cream-soft', 'Розділів поки немає. Почніть із «Про мене»: виберіть його нижче й натисніть «Додати розділ».')];
  // сховані розділи не зникають: дані лишаються в профілі й повертаються з іншим бланком
  if (hidden.length) {
    const template = data.templates.find((item) => item.id === state.template);
    nodes.push(el('p', 'rounded-lg border border-dashed border-line p-4 text-sm leading-relaxed text-ink-soft dark:border-night-line dark:text-cream-soft', `Бланк «${template.name}» не показує: ${hidden.map((block) => BLOCKS[block.type].title).join(', ')}. Ці дані збережено — вони повернуться, якщо обрати інший бланк.`));
  }
  blocksBox.replaceChildren(...nodes);
  // «Додатковий розділ»: лише необов’язкові для бланку, яких ще немає
  const optional = allowedTypes().filter((type) => !requiredTypes().includes(type));
  const free = optional.filter((type) => !state.blocks.some((block) => block.type === type));
  addType.replaceChildren(...free.map((type) => Object.assign(el('option', '', BLOCKS[type].title), { value: type })));
  addRow.hidden = !free.length;
  allAdded.hidden = Boolean(free.length);
  allAdded.textContent = optional.length ? 'Усі додаткові розділи вже додано.' : `Бланк «${currentTemplate().name}» має лише обов’язкові розділи.`;
}

// ---------- Перевірка полів ----------
function normalisePhone(value) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('380') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  if (local.length !== 9) return value.trim();
  return `+380 (${local.slice(0, 2)}) ${local.slice(2, 5)}-${local.slice(5, 7)}-${local.slice(7)}`;
}

// Телефон правильний, якщо його можна привести до формату +380 (XX) XXX-XX-XX (так само вважає й лічильник)
const phoneOk = (value) => PHONE_RE.test(normalisePhone(value));

function checkField(input) {
  const value = input.value.trim();
  let message = '';
  if (value && input.dataset.rule === 'email' && !EMAIL_RE.test(value)) message = 'Перевірте email: має бути на кшталт name@example.com.';
  if (value && input.dataset.rule === 'phone' && !phoneOk(value)) message = 'Телефон у форматі +380 (67) 123-45-67.';
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
    if (input.name === 'template') {
      // інший бланк — інший набір розділів: прибираємо непотрібні порожні автододані, додаємо обов’язкові
      dropUnneededAuto();
      const added = ensureRequired();
      drawBlocks();
      const hidden = state.blocks.filter((block) => !allowedTypes().includes(block.type));
      const parts = [];
      if (added.length) parts.push(`Додано обов’язкові розділи: ${added.join(', ')}.`);
      if (hidden.length) parts.push(`Сховано: ${hidden.map((block) => BLOCKS[block.type].title).join(', ')}, дані збережено.`);
      if (parts.length) announce(parts.join(' '));
    }
    return changed();
  }
  if (input.dataset.person) {
    state.person[input.dataset.person] = input.value;
    return changed();
  }
  // поле «своя навичка» поки що лише фільтрує підказки; у профіль навичка йде після «Додати» або Enter
  if (input.dataset.skillInput) {
    skillFilters[input.dataset.skillInput] = input.value;
    const groups = blocksBox.querySelector(`[data-skill-suggestions="${input.dataset.skillInput}"]`);
    if (groups) applySkillFilter(groups, input.value);
    document.getElementById(`${input.dataset.skillInput}-skill-error`).textContent = '';
    return;
  }
  const block = state.blocks.find((item) => item.id === input.dataset.block);
  if (!block) return;
  delete block.auto;
  // автозаповнення або вставка телефону (не набір по літері): одразу приводимо до формату,
  // інакше браузерне «+380971108087» вважалося б неправильним, поки людина не клацне в полі
  if (input.dataset.rule === 'phone' && event.inputType !== 'insertText' && event.inputType !== 'deleteContentBackward' && phoneOk(input.value)) {
    input.value = normalisePhone(input.value);
  }
  const { field: key, entry, list } = input.dataset;
  if (input.dataset.years !== undefined) {
    // рік початку / завершення: перераховуємо текст періоду й перевіряємо порядок років
    const item = block.items[Number(entry)];
    item[key] = input.value;
    const problem = periodProblem(item.from, item.to);
    item.period = problem ? '' : formatPeriod(item.from, item.to);
    const idBase = `${block.id}-${entry}`;
    document.getElementById(`${idBase}-years-error`).textContent = problem;
    for (const side of ['from', 'to']) document.getElementById(`${idBase}-${side}`).setAttribute('aria-invalid', String(Boolean(problem)));
    return changed();
  }
  if (list === 'lines') {
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

// Переміщення серед видимих розділів: розділ ставиться безпосередньо перед (або після) видимого сусіда,
// а сховані розділи лишаються там, де були. Повертає false, якщо рухати нікуди.
function moveBlock(block, action) {
  const visible = visibleBlocks();
  const at = visible.indexOf(block);
  const target = action === 'up' ? at - 1 : at + 1;
  if (target < 0 || target >= visible.length) return false;
  const neighbour = visible[target];
  state.blocks.splice(state.blocks.indexOf(block), 1);
  const place = state.blocks.indexOf(neighbour) + (action === 'down' ? 1 : 0);
  state.blocks.splice(place, 0, block);
  drawBlocks();
  announce(`Розділ «${BLOCKS[block.type].title}» тепер ${target + 1}-й із ${visible.length}.`);
  changed();
  return true;
}

// Клавіші ↑ ↓ на ручці ⠿ переставляють розділ (фокус лишається на ручці)
function onGripKey(event) {
  const grip = event.target.closest?.('[data-action="reorder"]');
  if (!grip || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
  event.preventDefault(); // інакше сторінка прокрутиться
  const block = state.blocks.find((item) => item.id === grip.closest('[data-block-id]').dataset.blockId);
  if (block && moveBlock(block, event.key === 'ArrowUp' ? 'up' : 'down')) focusLater(`[data-block-id="${block.id}"] [data-action="reorder"]`);
}

// Додає навичку з поля «своя навичка» (кнопка «Додати» або Enter)
function submitSkill(block) {
  const input = document.getElementById(`${block.id}-skill-input`);
  const problem = addSkill(block, input.value);
  if (problem) {
    document.getElementById(`${block.id}-skill-error`).textContent = problem;
    input.focus();
    return;
  }
  const added = block.items[block.items.length - 1];
  skillFilters[block.id] = '';
  drawBlocks();
  announce(`Навичку «${added}» додано.`);
  focusLater(`#${block.id}-skill-input`);
  changed();
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
  if (action === 'reorder' && block) {
    if (justDragged) return;
    reorderOpen = reorderOpen === block.id ? null : block.id;
    drawBlocks();
    focusLater(`[data-block-id="${block.id}"] [data-action="reorder"]`);
    return;
  }
  if ((action === 'up' || action === 'down') && block) {
    if (!moveBlock(block, action)) return;
    // фокус лишається на тій самій кнопці меню; якщо розділ дійшов до краю — на протилежній
    const visible = visibleBlocks();
    const at = visible.indexOf(block);
    const edge = action === 'up' ? at === 0 : at === visible.length - 1;
    focusLater(`[data-block-id="${block.id}"] [data-action="${edge ? (action === 'up' ? 'down' : 'up') : action}"]`);
  }
  if (action === 'remove' && block && !requiredTypes().includes(block.type)) {
    if (reorderOpen === block.id) reorderOpen = null;
    state.blocks.splice(index, 1);
    drawBlocks();
    announce(`Розділ «${BLOCKS[block.type].title}» прибрано. Його можна додати знову.`);
    const rest = visibleBlocks();
    const next = rest.find((item) => state.blocks.indexOf(item) >= index) || rest[rest.length - 1];
    // фокус переходить на сусідній розділ (його першу доступну кнопку), а якщо розділів не лишилось — на вибір нового
    (next ? blocksBox.querySelector(`[data-block-id="${next.id}"] button:not(:disabled)`) : addType)?.focus();
  }
  if (action === 'collapse' && block) {
    const wasCollapsed = collapsed.has(block.id);
    if (wasCollapsed) collapsed.delete(block.id);
    else collapsed.add(block.id);
    drawBlocks();
    focusLater(`[data-block-id="${block.id}"] [data-action="collapse"]`);
    if (!wasCollapsed) announce(`Розділ «${BLOCKS[block.type].title}» згорнуто: ${STATUS[blockStatus(block)].text}.`);
    return;
  }
  if (action === 'toggle-skill' && block) {
    const skill = button.dataset.skill;
    const at = block.items.findIndex((item) => item.toLowerCase() === skill.toLowerCase());
    if (at >= 0) block.items.splice(at, 1);
    else addSkill(block, skill);
    drawBlocks();
    announce(at >= 0 ? `Навичку «${skill}» прибрано.` : `Навичку «${skill}» додано.`);
    focusLater(`[data-block-id="${block.id}"] [data-action="toggle-skill"][data-skill="${CSS.escape(skill)}"]`);
  }
  if (action === 'remove-skill' && block) {
    const skill = button.dataset.skill;
    block.items = block.items.filter((item) => item !== skill);
    drawBlocks();
    announce(`Навичку «${skill}» прибрано.`);
    // фокус на наступну обрану навичку, а якщо їх не лишилось — на поле введення
    focusLater(`[data-block-id="${block.id}"] [data-action="remove-skill"], #${block.id}-skill-input`);
  }
  if (action === 'add-skill' && block) submitSkill(block);
  if (action === 'add-entry' && block && block.items.length < BLOCKS[block.type].max) {
    block.items.push({ title: '', place: '', from: '', to: '', period: '', text: '', link: '' });
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

// ---------- Лічильник заповненості ----------
// Рахуємо: ім’я, фах, місто й кожен обов’язковий розділ бланку (стан «заповнено» з blockStatus).
// На 100 % на перегляді з’являється печатка «Перевірено».
const meter = {
  label: root?.querySelector('[data-meter-label]'),
  track: root?.querySelector('[data-meter-track]'),
  bar: root?.querySelector('[data-meter-bar]'),
  hints: root?.querySelector('[data-meter-hints]'),
  done: root?.querySelector('[data-meter-done]'),
  stamp: root?.querySelector('[data-stamp]'),
};
let wasComplete = null; // попередній стан, щоб печатка «падала» лише в момент досягнення 100 %

function completeness() {
  const checks = [
    { ok: state.person.name.trim() !== '', hint: 'Впишіть ім’я та прізвище', target: '#person-name' },
    { ok: state.person.role.trim() !== '', hint: 'Додайте фах', target: '#person-role' },
    { ok: state.person.city.trim() !== '', hint: 'Додайте місто', target: '#person-city' },
  ];
  for (const type of requiredTypes()) {
    const block = state.blocks.find((item) => item.type === type);
    const status = block ? blockStatus(block) : 'empty';
    checks.push({ ok: status === 'full', hint: status === 'partial' ? `Допишіть розділ «${BLOCKS[type].title}»` : `Заповніть розділ «${BLOCKS[type].title}»`, block });
  }
  const passed = checks.filter((check) => check.ok).length;
  return { percent: Math.round((passed / checks.length) * 100), missing: checks.filter((check) => !check.ok) };
}

function updateMeter() {
  if (!meter.bar) return;
  const { percent, missing } = completeness();
  meter.label.textContent = `Заповнено ${percent} %`;
  meter.bar.style.width = `${percent}%`;
  meter.track.setAttribute('aria-valuenow', String(percent));
  // наступна підказка, що дописати (кнопка переводить до потрібного поля чи розділу) і скільки ще лишилось
  meter.hints.replaceChildren(
    ...missing.slice(0, 1).map((check) => {
      const button = el('button', 'inline-flex min-h-6 items-center text-left font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink dark:text-cream dark:decoration-night-line dark:hover:decoration-cream', check.hint);
      button.type = 'button';
      button.addEventListener('click', () => goTo(check));
      const item = el('li', 'flex items-center gap-1.5');
      item.append(el('span', 'text-ink-soft dark:text-cream-soft', 'Далі:'), button);
      return item;
    }),
  );
  if (missing.length > 1) meter.hints.append(el('li', 'text-ink-soft dark:text-cream-soft', `і ще ${missing.length - 1}`));
  const complete = percent === 100;
  meter.done.hidden = !complete;
  meter.stamp.hidden = !complete;
  if (complete && wasComplete === false) {
    // печатка «падає» заново: прибираємо й повертаємо клас анімації
    const svg = meter.stamp.querySelector('svg');
    svg.classList.remove('stamp-land');
    void svg.getBoundingClientRect();
    svg.classList.add('stamp-land');
    announce('Профіль заповнено повністю. Поставлено печатку «Перевірено».');
  }
  wasComplete = complete;
}

// Перехід від підказки до поля: на телефоні спершу показуємо форму, згорнутий розділ розгортаємо
function goTo(check) {
  setView('edit');
  if (check.block) {
    if (collapsed.delete(check.block.id)) drawBlocks();
    const section = blocksBox.querySelector(`[data-block-id="${check.block.id}"]`);
    section?.scrollIntoView({ block: 'start' });
    (section?.querySelector('input, textarea, select, [data-action="add-entry"]') || section?.querySelector('[data-action="collapse"]'))?.focus({ preventScroll: true });
  } else {
    form.querySelector(check.target)?.focus();
  }
}

// ---------- Перегляд на пристроях ----------
// Ширина аркуша = ширина пристрою; якщо колонка вужча, аркуш зменшується (zoom), а шаблон усе одно
// перебудовується за своєю шириною, бо в рендері використано контейнерні запити (@container).
let deviceWidth = 0; // 0 — на всю ширину колонки
const deviceFrame = root?.querySelector('[data-device-frame]');

function fitDevice() {
  if (!deviceFrame) return;
  preview.style.width = deviceWidth ? `${deviceWidth}px` : '';
  const style = getComputedStyle(deviceFrame);
  const available = deviceFrame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  // перегляд схований (вкладка «Заповнення» на телефоні) — ширини немає; ResizeObserver перерахує, коли з’явиться
  preview.style.zoom = deviceWidth && available > 0 && available < deviceWidth ? String(available / deviceWidth) : '';
}

function setDevice(width) {
  deviceWidth = width;
  for (const button of root.querySelectorAll('[data-device]')) button.setAttribute('aria-pressed', String(Number(button.dataset.device) === width));
  fitDevice();
}

// ---------- Перетягування розділів (SortableJS з CDN) ----------

function loadSortable() {
  const script = document.createElement('script');
  Object.assign(script, { src: SORTABLE.src, integrity: SORTABLE.integrity, crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' });
  script.addEventListener('load', () => {
    if (!window.Sortable) return;
    window.Sortable.create(blocksBox, {
      handle: '[data-drag]',
      draggable: '[data-block-id]',
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
      ghostClass: 'opacity-40',
      onEnd(event) {
        justDragged = true;
        setTimeout(() => (justDragged = false), 0);
        if (event.oldIndex === event.newIndex) return;
        // новий порядок видимих розділів ставимо на ті самі місця в state.blocks; сховані не зсуваються
        const order = [...blocksBox.querySelectorAll('[data-block-id]')].map((node) => node.dataset.blockId);
        const visible = visibleBlocks();
        const slots = visible.map((block) => state.blocks.indexOf(block)).sort((a, b) => a - b);
        order.forEach((id, i) => (state.blocks[slots[i]] = visible.find((block) => block.id === id)));
        drawBlocks();
        const moved = state.blocks.find((block) => block.id === event.item.dataset.blockId);
        announce(`Розділ «${BLOCKS[moved.type].title}» тепер ${order.indexOf(moved.id) + 1}-й із ${order.length}.`);
        changed();
      },
    });
  });
  script.addEventListener('error', () => console.warn('SortableJS не завантажилась — порядок змінюється кнопками ↑ ↓.'));
  document.head.append(script);
}

// ---------- Експорт: HTML-файл і PDF (через друк того самого файла) ----------
const exportStatus = root?.querySelector('[data-export-status]');

// дані профілю для файла: без службових позначок
function profileForFile() {
  const { template, palette, number, person, photo } = state;
  const blocks = state.blocks.map(({ auto, ...block }) => block);
  return { template, palette, number, person, photo, blocks };
}

async function makeFile() {
  const palette = data.palettes.find((item) => item.id === state.palette);
  // у файлі ім’я — головний заголовок сторінки (h1)
  const node = renderProfile({ ...state, sections: allowedTypes() }, palette, { level: 1 });
  return buildHtmlFile(node, profileForFile(), palette);
}

async function onExport(button) {
  const kind = button.dataset.export;
  button.disabled = true;
  exportStatus.textContent = 'Готуємо файл…';
  try {
    const text = await makeFile();
    if (kind === 'html') {
      const name = fileName(state.person.name, 'html');
      download(text, name);
      exportStatus.textContent = `Файл «${name}» завантажено. Згодом його можна відкрити тут кнопкою «Відкрити збережений файл».`;
      clearStatusLater();
    } else {
      printFile(text);
      exportStatus.textContent = 'Відкрито вікно друку. Оберіть «Зберегти як PDF» у списку принтерів.';
      clearStatusLater();
    }
  } catch (problem) {
    console.warn('Експорт не вдався:', problem);
    exportStatus.textContent = 'Не вдалося підготувати файл. Перевірте з’єднання й спробуйте ще раз.';
  } finally {
    button.disabled = false;
  }
}

// Повідомлення про збереження ховається через 8 с, щоб не забирати висоту в профілю
let statusTimer = 0;
function clearStatusLater() {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (exportStatus.textContent = ''), 8000);
}

// Друк: той самий HTML-файл у прихованому вікні — PDF виглядає так само, як завантажений файл
function printFile(text) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0';
  frame.srcdoc = text;
  frame.addEventListener('load', () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, { once: true });
  document.body.append(frame);
}

// ---------- Імпорт раніше збереженого HTML-файла ----------
const importInput = root?.querySelector('[data-import]');
const importError = root?.querySelector('[data-import-error]');

const hasContent = () => Object.values(state.person).some((value) => value.trim()) || Boolean(state.photo) || state.blocks.some((block) => blockStatus(block) !== 'empty');

async function onImport() {
  const file = importInput.files[0];
  importError.textContent = '';
  if (!file) return;
  try {
    const profile = await readProfileFile(file);
    if (hasContent() && !window.confirm(`Відкрити «${file.name}»? Поточний профіль у конструкторі буде замінено даними з файла.`)) return;
    // дані з файла проходять той самий білий список, що й чернетка (cleanProfile у stateFromDraft)
    stateFromDraft({ profile });
    redrawAll();
    saveDraft();
    setDraftStatus(`Відкрито файл «${file.name}». Зміни знову зберігаються автоматично.`);
    announce('Профіль із файла відкрито.');
    form.querySelector('#person-name').focus();
  } catch (problem) {
    // помилка читання не зачіпає поточну чернетку
    importError.textContent = problem.message;
  } finally {
    importInput.value = '';
  }
}

// ---------- Вибір між чернеткою й посиланням ----------
function offerReplace(params) {
  const box = root.querySelector('[data-draft-choice]');
  const text = root.querySelector('[data-draft-choice-text]');
  const replace = root.querySelector('[data-draft-replace]');
  const example = data.examples.find((item) => item.id === params.get('example'));
  const template = data.templates.find((item) => item.id === params.get('template'));
  let what = 'новий профіль';
  if (example) what = `приклад «${example.profile.person.name}»`;
  else if (template) what = `бланк «${template.name}» для вашої чернетки`;
  text.textContent = `У браузері є ваша чернетка, тому відкрито її. Відкрити натомість ${what}?`;
  if (example) replace.textContent = 'Відкрити приклад замість чернетки';
  else if (template) replace.textContent = `Змінити бланк на «${template.name}»`;
  else replace.textContent = 'Почати з нового';
  box.hidden = false;
  const close = () => {
    box.hidden = true;
    form.querySelector('#person-name').focus();
  };
  root.querySelector('[data-draft-keep]').addEventListener('click', () => {
    close();
    announce('Залишено вашу чернетку.');
  }, { once: true });
  replace.addEventListener('click', () => {
    if (template && !example) {
      // бланк за посиланням: беремо вашу чернетку, лише міняємо бланк (дані не губляться)
      state.template = template.id;
      if (data.palettes.some((item) => item.id === params.get('palette'))) state.palette = params.get('palette');
      dropUnneededAuto();
      ensureRequired();
    } else {
      initialState(params);
    }
    redrawAll();
    saveDraft();
    close();
    announce('Готово, чернетку оновлено.');
  }, { once: true });
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
  // Що показати: чернетку чи те, що прийшло за посиланням (?example, ?template, ?name)
  const params = new URLSearchParams(location.search);
  const fromLink = ['example', 'template', 'palette', 'name', 'role'].some((key) => params.has(key));
  const draft = readDraft();
  if (draft) {
    stateFromDraft(draft);
    setDraftStatus(`Відновлено чернетку від ${new Date(draft.savedAt).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`);
    if (fromLink) offerReplace(params);
  } else {
    initialState(params);
  }
  // параметри адреси прибираємо, щоб оновлення сторінки відкривало чернетку, а не знову приклад
  if (fromLink) history.replaceState(null, '', location.pathname);
  redrawAll();

  form.addEventListener('input', onInput);
  form.addEventListener('focusout', onBlur);
  form.addEventListener('click', onClick);
  form.addEventListener('submit', (event) => event.preventDefault()); // Enter у полі не перезавантажує сторінку
  // Enter у полі «своя навичка» додає її (як кнопка «Додати»)
  form.addEventListener('keydown', onGripKey);
  form.addEventListener('keydown', (event) => {
    const id = event.target.dataset?.skillInput;
    if (event.key !== 'Enter' || !id) return;
    event.preventDefault();
    const block = state.blocks.find((item) => item.id === id);
    if (block) submitSkill(block);
  });
  photoInput.addEventListener('change', onPhoto);
  for (const button of root.querySelectorAll('[data-view-btn]')) button.addEventListener('click', () => setView(button.dataset.viewBtn));
  for (const button of root.querySelectorAll('[data-device]')) button.addEventListener('click', () => setDevice(Number(button.dataset.device)));
  if (deviceFrame && 'ResizeObserver' in window) new ResizeObserver(fitDevice).observe(deviceFrame);
  for (const button of root.querySelectorAll('[data-export]')) button.addEventListener('click', () => onExport(button));
  importInput?.addEventListener('change', onImport);
  loadSortable();

  // «Почати спочатку»: чернетку видалено, профіль порожній (з обов’язковими розділами поточного бланку)
  root.querySelector('[data-reset]').addEventListener('click', () => {
    if (!window.confirm('Очистити все, що ви ввели? Чернетку буде видалено, повернути її не вийде.')) return;
    const { template, palette } = state;
    clearTimeout(saveTimer);
    saveTimer = 0;
    removeDraft();
    initialState(new URLSearchParams({ template, palette }));
    redrawAll();
    photoInput.value = '';
    setDraftStatus('Почато спочатку. Нові зміни знову зберігатимуться автоматично.');
    announce('Профіль очищено.');
    form.querySelector('#person-name').focus();
  });
  // якщо сторінку закривають, поки таймер збереження ще не спрацював, зберігаємо одразу
  window.addEventListener('pagehide', () => {
    if (saveTimer) saveDraft();
  });
}

if (root && form && preview && templatesBox && palettesBox && blocksBox && addType && addRow && allAdded && announcer && photoInput && photoRemove) start();
