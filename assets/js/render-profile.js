// Малює профіль (портфоліо) у вибраному шаблоні та палітрі.
// Використовується на сторінках «Шаблони» і «Приклади», а далі й у конструкторі.
// Увесь текст користувача ставиться через textContent: вставлений HTML чи скрипт не виконається.
import { el } from './data.js';

const TITLES = {
  about: 'Про мене',
  skills: 'Навички',
  projects: 'Проєкти',
  experience: 'Досвід',
  education: 'Освіта',
  achievements: 'Досягнення',
  contacts: 'Контакти',
};

// Email: щось@щось.домен, без пробілів. Той самий вираз перевіряє поле в конструкторі.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Пропускає лише адреси http і https. Усе інше (наприклад javascript:) відкидається.
export function safeLink(value) {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch (error) {
    return null;
  }
}

// Перші літери імені та прізвища замість фото: «Олена Коваль» -> «ОК».
function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

// Обгортає дочірній елемент у тег (наприклад посилання в <li>).
function wrap(tag, classes, child) {
  const node = el(tag, classes);
  node.append(child);
  return node;
}

function link(href, text) {
  const a = el('a', 'break-all text-(--p-accent) underline underline-offset-2', text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

// ---------- вміст одного блока ----------
function blockBody(block) {
  const body = el('div', 'mt-2 space-y-3');

  if (block.type === 'about' && block.text) {
    body.append(el('p', 'leading-relaxed', block.text));
  }

  if ((block.type === 'skills' || block.type === 'achievements') && Array.isArray(block.items)) {
    const tags = block.type === 'skills';
    const list = el('ul', tags ? 'flex flex-wrap gap-2' : 'list-disc space-y-1 pl-5');
    for (const item of block.items) {
      if (item) list.append(el('li', tags ? 'rounded-sm border border-(--p-line) px-2 py-1 text-sm' : 'leading-relaxed', item));
    }
    if (list.children.length) body.append(list);
  }

  if (['projects', 'experience', 'education'].includes(block.type) && Array.isArray(block.items)) {
    for (const item of block.items) {
      if (!item || !item.title) continue;
      const entry = el('div');
      entry.append(el('p', 'font-semibold', item.title));
      const details = [item.place, item.period].filter(Boolean).join(', ');
      if (details) entry.append(el('p', 'text-sm text-(--p-muted)', details));
      if (item.text) entry.append(el('p', 'mt-1 leading-relaxed', item.text));
      const href = item.link ? safeLink(item.link) : null;
      if (href) entry.append(wrap('p', 'mt-1 text-sm', link(href, 'Переглянути проєкт')));
      body.append(entry);
    }
  }

  if (block.type === 'contacts') {
    const list = el('ul', 'space-y-1');
    if (block.email && EMAIL_RE.test(block.email)) {
      const mail = el('a', 'break-all text-(--p-accent) underline underline-offset-2', block.email);
      mail.href = `mailto:${block.email}`;
      list.append(wrap('li', '', mail));
    }
    if (block.phone) list.append(el('li', '', block.phone));
    const href = block.link ? safeLink(block.link) : null;
    if (href) list.append(wrap('li', '', link(href, href.replace(/^https?:\/\//, '').replace(/\/$/, ''))));
    if (list.children.length) body.append(list);
  }

  return body.children.length ? body : null;
}

// Блок із заголовком. Порожній блок не малюється зовсім.
function blockSection(block, level) {
  const body = blockBody(block);
  if (!body) return null;
  const section = el('section');
  section.append(el(`h${level}`, 'font-mono text-xs tracking-wide text-(--p-muted) uppercase', TITLES[block.type] || ''), body);
  return section;
}

// Фото або ініціали. Фото приймається лише як data:image (його готує конструктор із файла користувача).
function photo(profile, classes) {
  const src = typeof profile.photo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(profile.photo) ? profile.photo : '';
  if (src) {
    const img = el('img', `shrink-0 border border-(--p-line) object-cover ${classes}`);
    img.src = src;
    img.alt = profile.person.name ? `Фото: ${profile.person.name}` : 'Фото';
    return img;
  }
  const box = el('div', `flex shrink-0 items-center justify-center border border-(--p-line) font-serif font-bold text-(--p-muted) ${classes}`, initials(profile.person.name) || '?');
  box.setAttribute('aria-hidden', 'true');
  return box;
}

// ---------- чотири шаблони ----------
function layoutCard(profile, level, blocks) {
  const { person } = profile;
  const top = el('div', 'flex items-center justify-between gap-3 border-b border-(--p-line) pb-3 font-mono text-[11px] tracking-wide text-(--p-muted) uppercase');
  top.append(el('span', '', 'Цифровий профіль'), el('span', '', `ОсьЯ № ${profile.number || '000 000'}`));

  const identity = el('div', 'mt-5 flex items-start gap-4');
  const text = el('div', 'min-w-0 flex-1');
  text.append(el(`h${level}`, 'font-serif text-2xl leading-snug font-bold', person.name || 'Ваше ім’я'));
  if (person.role) text.append(el('p', 'mt-1 font-medium', person.role));
  if (person.city) text.append(el('p', 'text-sm text-(--p-muted)', person.city));
  const sticker = el('div', 'holo size-12 shrink-0 rounded-full');
  sticker.setAttribute('aria-hidden', 'true');
  identity.append(photo(profile, 'h-24 w-20 rounded-sm text-2xl'), text, sticker);

  const body = el('div', 'mt-5 space-y-5');
  body.append(...blocks);
  const root = el('div', 'p-5 @md:p-6');
  root.append(top, identity, body);
  return root;
}

function layoutResume(profile, level, blocks) {
  const { person } = profile;
  const head = el('header', 'border-b-2 border-(--p-text) pb-4');
  head.append(el(`h${level}`, 'font-serif text-3xl leading-tight font-bold', person.name || 'Ваше ім’я'));
  const line = [person.role, person.city].filter(Boolean).join(', ');
  if (line) head.append(el('p', 'mt-2 text-(--p-muted)', line));
  const body = el('div', 'mt-5 space-y-5');
  body.append(...blocks);
  const root = el('div', 'p-6 @md:p-8');
  root.append(head, body);
  return root;
}

function layoutDossier(profile, level, sections) {
  const { person } = profile;
  // у бічну колонку йдуть контакти й навички, решта праворуч
  const sideTypes = ['contacts', 'skills'];
  const side = el('div', 'space-y-5 border-b border-(--p-line) p-5 @lg:w-2/5 @lg:border-r @lg:border-b-0');
  side.append(photo(profile, 'size-20 rounded-full text-2xl'));
  const name = el('div');
  name.append(el(`h${level}`, 'font-serif text-2xl leading-snug font-bold', person.name || 'Ваше ім’я'));
  if (person.role) name.append(el('p', 'mt-1 font-medium', person.role));
  if (person.city) name.append(el('p', 'text-sm text-(--p-muted)', person.city));
  side.append(name);
  const main = el('div', 'flex-1 space-y-5 p-5');
  sections.forEach((section) => (sideTypes.includes(section.dataset.type) ? side : main).append(section));
  const root = el('div', '@lg:flex');
  root.append(side, main);
  return root;
}

function layoutVisit(profile, level, sections) {
  const { person } = profile;
  const root = el('div', 'flex flex-col items-center gap-4 p-8 text-center');
  root.append(photo(profile, 'size-24 rounded-full text-3xl'));
  const name = el('div');
  name.append(el(`h${level}`, 'font-serif text-3xl leading-tight font-bold', person.name || 'Ваше ім’я'));
  const line = [person.role, person.city].filter(Boolean).join(', ');
  if (line) name.append(el('p', 'mt-2 text-(--p-muted)', line));
  root.append(name);
  // візитка показує лише головне
  const shown = ['about', 'skills', 'contacts'];
  for (const section of sections) {
    if (!shown.includes(section.dataset.type)) continue;
    section.classList.add('w-full', 'max-w-md');
    section.querySelector('ul.flex')?.classList.add('justify-center');
    root.append(section);
  }
  return root;
}

const LAYOUTS = { card: layoutCard, resume: layoutResume, dossier: layoutDossier, visit: layoutVisit };

// Головна функція. profile — дані, palette — об’єкт палітри з data.json,
// level — рівень заголовка для імені (2 означає <h2>, заголовки блоків тоді <h3>).
export function renderProfile(profile, palette, { template = profile.template, level = 2 } = {}) {
  const sections = [];
  for (const block of Array.isArray(profile.blocks) ? profile.blocks : []) {
    const section = blockSection(block, level + 1);
    if (section) {
      section.dataset.type = block.type;
      sections.push(section);
    }
  }

  const layout = LAYOUTS[template] || layoutCard;
  const root = layout(profile, level, sections);
  root.classList.add('bg-(--p-bg)', 'text-left', 'font-sans', 'text-base', 'text-(--p-text)');
  if (template === 'visit') root.classList.replace('text-left', 'text-center');
  // кольори палітри передаються як CSS-змінні, класи вище беруть їх через var()
  for (const key of ['bg', 'text', 'muted', 'accent', 'line']) root.style.setProperty(`--p-${key}`, palette[key]);
  // обгортка-контейнер: шаблон перебудовується за шириною власної рамки, а не всього вікна
  // (так той самий профіль правильно виглядає і в мініатюрі, і в повному перегляді)
  const box = el('div', '@container min-h-full bg-(--p-bg)');
  box.style.setProperty('--p-bg', palette.bg);
  box.append(root);
  return box;
}
