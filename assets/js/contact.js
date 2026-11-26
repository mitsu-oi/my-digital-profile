// Сторінка «Контакти»: перевірка форми звернення (RegEx), маска телефону, вікно-підтвердження.
// Форма нічого нікуди не надсилає — сервера немає, і сторінка чесно про це каже.
// Перевірка: поле перевіряється після виходу з нього (blur), а виправлене — одразу під час введення;
// при невдалому «Надіслати» зверху з’являється зведення помилок, і фокус переходить до нього.
import { el } from './data.js';
import { EMAIL_RE, PHONE_RE, maskPhone, maskPhoneInput } from './render-profile.js';

// Ім’я: будь-які літери (\p{L} — українські, латинські, з наголосами), пробіл, дефіс, апостроф; 2–60 символів
const NAME_RE = /^[\p{L}'’ʼ -]{2,60}$/u;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 1000;

const form = document.querySelector('[data-contact]');
const summary = form?.querySelector('[data-summary]');
const summaryList = form?.querySelector('[data-summary-list]');
const counter = form?.querySelector('[data-count]');
const submit = form?.querySelector('[data-submit]');
const sending = form?.querySelector('[data-sending]');
const dialog = document.querySelector('[data-done]');
const doneList = dialog?.querySelector('[data-done-list]');

// Маска телефону (maskPhone, maskPhoneInput) спільна з конструктором: render-profile.js

// ---------- Правила для кожного поля ----------
// Кожне правило повертає текст помилки або порожній рядок
const RULES = {
  name(value) {
    const text = value.trim();
    if (!text) return 'Вкажіть, як до вас звертатися.';
    if (!NAME_RE.test(text)) return 'Ім’я може містити лише літери, пробіл, дефіс та апостроф (від 2 символів).';
    return '';
  },
  email(value) {
    const text = value.trim();
    if (!text) return 'Вкажіть email, щоб ми могли відповісти.';
    if (!EMAIL_RE.test(text)) return 'Перевірте email: має бути на кшталт name@example.com.';
    return '';
  },
  phone(value) {
    const text = value.trim();
    if (text && !PHONE_RE.test(text)) return 'Номер неповний: потрібно 9 цифр після +380.';
    return '';
  },
  topic(value) {
    return value ? '' : 'Оберіть тему звернення.';
  },
  message(value) {
    const length = value.trim().length;
    if (!length) return 'Напишіть повідомлення.';
    if (length < MESSAGE_MIN) return `Повідомлення закоротке: щонайменше ${MESSAGE_MIN} символів.`;
    return '';
  },
  consent(value, input) {
    return input.checked ? '' : 'Поставте позначку, що розумієте, як працює ця форма.';
  },
};

const LABELS = { name: 'Ім’я', email: 'Email', phone: 'Телефон', topic: 'Тема', message: 'Повідомлення', consent: 'Згода' };

// Перевіряє одне поле, показує або прибирає помилку. Повертає текст помилки.
function check(input) {
  const rule = RULES[input.name];
  if (!rule) return '';
  const message = rule(input.value, input);
  document.getElementById(`${input.id}-error`).textContent = message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
  return message;
}

function updateCounter() {
  const length = form.elements.message.value.length;
  counter.textContent = `${length} / ${MESSAGE_MAX}`;
}

// ---------- Події ----------
function onInput(event) {
  const input = event.target;
  if (input.name === 'phone') {
    maskPhoneInput(input, event);
  }
  if (input.name === 'message') updateCounter();
  // уже показана помилка зникає, щойно значення виправлене; нову не показуємо посеред набору
  if (input.getAttribute('aria-invalid') === 'true') check(input);
}

function onBlur(event) {
  const input = event.target;
  if (!RULES[input.name]) return;
  // номер, який виправляли посередині, форматуємо при виході з поля
  if (input.name === 'phone' && /\d/.test(input.value)) input.value = maskPhone(input.value);
  // порожнє поле, з якого просто пройшли Tab-ом, не сварить — лише заповнене з помилкою
  if (input.type !== 'checkbox' && !input.value.trim() && input.getAttribute('aria-invalid') !== 'true') return;
  check(input);
}

function showSummary(problems) {
  summaryList.replaceChildren(
    ...problems.map(({ input, message }) => {
      const link = el('a', 'underline underline-offset-2', `${LABELS[input.name]}: ${message}`);
      link.href = `#${input.id}`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        input.focus();
      });
      const item = el('li');
      item.append(link);
      return item;
    }),
  );
  summary.hidden = false;
  summary.focus();
}

async function onSubmit(event) {
  event.preventDefault();
  const problems = [];
  for (const input of form.querySelectorAll('[name]')) {
    const message = check(input);
    if (message) problems.push({ input, message });
  }
  if (problems.length) {
    showSummary(problems);
    return;
  }
  summary.hidden = true;
  // імітація надсилання: короткий стан «Надсилаємо…», щоб було видно реакцію на натискання
  submit.disabled = true;
  sending.textContent = 'Формуємо звернення…';
  await new Promise((resolve) => setTimeout(resolve, 600));
  submit.disabled = false;
  sending.textContent = '';
  showDone();
}

// Вікно-підтвердження з тим, що людина написала (лише textContent)
function showDone() {
  const data = form.elements;
  const rows = [
    ['Ім’я', data.name.value.trim()],
    ['Email', data.email.value.trim()],
    ['Телефон', data.phone.value.trim() || 'не вказано'],
    ['Тема', data.topic.selectedOptions[0].textContent],
    ['Повідомлення', data.message.value.trim()],
  ];
  doneList.replaceChildren(
    ...rows.map(([term, value]) => {
      const wrap = el('div');
      wrap.append(el('dt', 'font-mono text-xs text-ink-soft dark:text-cream-soft', term), el('dd', 'mt-0.5 break-words whitespace-pre-line', value));
      return wrap;
    }),
  );
  dialog.showModal(); // модальний <dialog>: решта сторінки недоступна, Esc закриває
}

// Закриває вікно, очищує форму й повертає фокус на перше поле.
// Робимо це одразу, а не в події close: її браузер може відкласти до наступного кадру.
function closeDone() {
  if (dialog.open) dialog.close();
  form.reset();
  updateCounter();
  for (const input of form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');
  form.elements.name.focus();
}

if (form && summary && summaryList && counter && submit && sending && dialog && doneList) {
  form.addEventListener('input', onInput);
  form.addEventListener('change', (event) => {
    if (event.target.type === 'checkbox' || event.target.tagName === 'SELECT') check(event.target);
  });
  form.addEventListener('focusout', onBlur);
  form.addEventListener('submit', onSubmit);
  dialog.querySelector('[data-done-close]').addEventListener('click', closeDone);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDone(); // клік по затемненому фону
  });
  // Esc: браузер сам закриває модальне вікно, ми лише очищуємо форму
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDone();
  });
  updateCounter();
}
