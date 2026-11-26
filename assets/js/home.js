// Головна: заповнює «віяло» бланків справжніми зменшеними профілями з data.json.
// Якщо дані не завантажились, лишаються порожні аркуші з назвами — сторінка все одно читається.
import { loadData } from './data.js';
import { renderProfile } from './render-profile.js';
import './home-stack.js'; // стос прикладів зі Swiper

const frames = document.querySelectorAll('[data-fan-frame]');

async function start() {
  try {
    const data = await loadData();
    const sample = data.examples[0].profile; // профіль Олени, той самий, що на «паспорті» вгорі
    for (const frame of frames) {
      const palette = data.palettes.find((item) => item.id === frame.dataset.palette) || data.palettes[0];
      const preview = renderProfile(sample, palette, { template: frame.dataset.fanFrame, level: 3 });
      preview.classList.add('[zoom:0.55]');
      frame.inert = true; // ілюстрація: не для клавіатури й читача екрана
      frame.replaceChildren(preview);
    }
  } catch (error) {
    console.warn('Бланки не завантажено:', error.message);
  }
}

if (frames.length) start();

// ---------- Жива демонстрація на першому екрані ----------
// Ім’я та фах із полів одразу з’являються в «паспорті». Лише textContent: введений HTML не виконується.
const demoForm = document.querySelector('[data-demo]');
const out = (name) => document.querySelector(`[data-demo-out="${name}"]`);
const passport = document.querySelector('[data-demo-label]');

// Транслітерація для машинозчитуваного рядка (за спрощеною офіційною таблицею 2010 року)
const LATIN = { а: 'A', б: 'B', в: 'V', г: 'H', ґ: 'G', д: 'D', е: 'E', є: 'IE', ж: 'ZH', з: 'Z', и: 'Y', і: 'I', ї: 'I', й: 'I', к: 'K', л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U', ф: 'F', х: 'KH', ц: 'TS', ч: 'CH', ш: 'SH', щ: 'SHCH', ь: '', ю: 'IU', я: 'IA' };
function toMrz(text) {
  return [...text.toLowerCase()]
    .map((char) => (char in LATIN ? LATIN[char] : /[a-z]/.test(char) ? char.toUpperCase() : /[\s-]/.test(char) ? '<' : ''))
    .join('');
}

const DEFAULTS = { given: 'Олена', surname: 'Коваль', role: 'UX-дизайнерка' };

function updatePassport() {
  const name = demoForm.elements.name.value.trim().replace(/\s+/g, ' ');
  const role = demoForm.elements.role.value.trim();
  // перше слово — ім’я, решта — прізвище (як ми пишемо: «Олена Коваль»)
  const [given = '', ...rest] = name ? name.split(' ') : [];
  const shown = {
    given: name ? given : DEFAULTS.given,
    surname: name ? rest.join(' ') || '—' : DEFAULTS.surname,
    role: role || DEFAULTS.role,
  };
  out('given').textContent = shown.given;
  out('surname').textContent = shown.surname;
  out('role').textContent = shown.role;
  const surnameMrz = shown.surname === '—' ? '' : toMrz(shown.surname);
  out('mrz').textContent = `P<UKR${surnameMrz}<<${toMrz(shown.given)}`.padEnd(44, '<').slice(0, 44);
  passport.setAttribute('aria-label', `Приклад профілю: ${shown.given} ${surnameMrz ? shown.surname : ''}, ${shown.role}`.replace(/\s+,/, ','));
}

if (demoForm && passport && ['given', 'surname', 'role', 'mrz'].every((name) => out(name))) {
  demoForm.addEventListener('input', updatePassport);
}

// ---------- Поле «Фах» у кроці 2: текст стирається й друкується інший фах ----------
// Лише ілюстрація (aria-hidden), тому читач екрана її не озвучує. Анімація йде, тільки коли поле видно на екрані;
// при «зменшити рух» у системі лишається перший фах без змін.
const typing = document.querySelector('[data-typing]');
const caret = document.querySelector('[data-caret]');
const ROLES = ['UX-дизайнер', 'Фотографка', 'Репетитор', 'Маркетологиня', 'Розробник', 'Аналітик даних'];
const TYPE_MS = 85; // пауза між літерами під час набору
const ERASE_MS = 40; // стирання швидше за набір
const HOLD_MS = 1800; // скільки готове слово стоїть у полі

if (typing && caret && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let role = 0;
  let timer = null;
  let visible = false;

  const wait = (ms, next) => {
    timer = setTimeout(next, ms);
  };

  // слово набрано: курсор блимає, потім стирання
  function hold() {
    caret.classList.add('is-idle');
    wait(HOLD_MS, erase);
  }

  function erase() {
    caret.classList.remove('is-idle');
    const text = typing.textContent;
    if (text.length) {
      typing.textContent = text.slice(0, -1);
      wait(ERASE_MS, erase);
    } else {
      role = (role + 1) % ROLES.length;
      wait(400, type);
    }
  }

  function type() {
    const word = ROLES[role];
    const length = typing.textContent.length;
    if (length < word.length) {
      typing.textContent = word.slice(0, length + 1);
      wait(TYPE_MS, type);
    } else {
      hold();
    }
  }

  // поза екраном анімація зупиняється, а після повернення продовжується з того самого місця
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting === visible) return;
    visible = entry.isIntersecting;
    clearTimeout(timer);
    if (visible) (typing.textContent === ROLES[role] ? hold : erase)();
  }).observe(typing.parentElement);
}
