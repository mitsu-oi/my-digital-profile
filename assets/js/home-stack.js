// Головна, секція «Як оформили профілі інші»: стос справжніх профілів із data.json, який гортають.
// Гортання робить бібліотека Swiper (ефект «cards» — картки лежать стосом, як документи на столі).
// Swiper вантажиться з CDN лише тоді, коли секція наближається до екрана, з фіксованою версією та SRI.
// Поки бібліотеки немає (або CDN недоступний), той самий список гортається звичайною прокруткою,
// а кнопки «назад / уперед» і відомості про профіль працюють однаково в обох режимах.
import { el, loadData, showLoadError } from './data.js';
import { renderProfile } from './render-profile.js';

// Файли з CDN: фіксована версія і контрольна сума (SRI). Змінений на CDN файл браузер не виконає.
const SWIPER = {
  css: 'https://cdn.jsdelivr.net/npm/swiper@11.2.10/swiper-bundle.min.css',
  cssIntegrity: 'sha384-gAPqlBuTCdtVcYt9ocMOYWrnBZ4XSL6q+4eXqwNycOr4iFczhNKtnYhF3NEXJM51',
  js: 'https://cdn.jsdelivr.net/npm/swiper@11.2.10/swiper-bundle.min.js',
  jsIntegrity: 'sha384-2UI1PfnXFjVMQ7/ZDEF70CR943oH3v6uZrFQGGqJYlvhh4g6z6uVktxYbOlAczav',
};

// Класи «запасного» режиму: горизонтальна прокрутка з прилипанням до картки. Після запуску Swiper їх прибираємо.
const FALLBACK = ['gap-4', 'overflow-x-auto', 'snap-x', 'snap-mandatory', 'pb-3'];

const section = document.querySelector('[data-stack]');
const q = (name) => section?.querySelector(`[data-stack-${name}]`);
const parts = {
  slider: q('slider'),
  list: q('list'),
  dots: q('dots'),
  prev: q('prev'),
  next: q('next'),
  use: q('use'),
  count: q('count'),
  name: q('name'),
  role: q('role'),
  about: q('about'),
  sphere: q('sphere'),
  template: q('template'),
  palette: q('palette'),
  swatch: q('swatch'),
};

let data = null;
let swiper = null; // екземпляр Swiper, коли бібліотека завантажилась
let current = 0;

const byId = (list, id) => list.find((item) => item.id === id) || list[0];
const pad = (number) => String(number).padStart(2, '0');

// Показує відомості про профіль, що лежить зверху стосу. Лише textContent: дані не виконуються як HTML.
function show(index) {
  current = index;
  const example = data.examples[index];
  const { profile } = example;
  const palette = byId(data.palettes, profile.palette);
  const about = profile.blocks.find((block) => block.type === 'about');

  parts.count.textContent = `Приклад ${pad(index + 1)} з ${pad(data.examples.length)}`;
  parts.name.textContent = profile.person.name;
  parts.role.textContent = [profile.person.role, profile.person.city].filter(Boolean).join(', ');
  parts.about.textContent = about ? about.text : '';
  parts.sphere.textContent = (data.spheres.find((item) => item.id === example.sphere) || {}).name || '—';
  parts.template.textContent = byId(data.templates, profile.template).name;
  parts.palette.textContent = palette.name;
  parts.swatch.style.background = `linear-gradient(135deg, ${palette.bg} 50%, ${palette.accent} 50%)`;
  parts.use.href = `builder.html?example=${encodeURIComponent(example.id)}`;
  parts.use.setAttribute('aria-label', `Взяти за основу профіль: ${profile.person.name}`);

  [...parts.dots.children].forEach((dot, i) => dot.classList.toggle('is-current', i === index));
}

// Малює картки стосу: справжні зменшені профілі (як на сторінці «Приклади»).
function drawSlides() {
  const slides = data.examples.map((example) => {
    const { profile } = example;
    const slide = el('div', 'swiper-slide relative w-full shrink-0 snap-center');
    // назва для читача екрана; саме зображення профілю — ілюстрація, тому inert
    slide.append(el('span', 'sr-only', `${profile.person.name}, ${profile.person.role}`));
    const frame = el('div', 'doc aspect-[4/5] overflow-hidden rounded-md bg-sheet shadow-[0_18px_40px_-24px_rgba(14,22,40,0.6)] ring-1 ring-line');
    frame.inert = true;
    const preview = renderProfile(profile, byId(data.palettes, profile.palette), { level: 3 });
    preview.classList.add('min-h-full', '[zoom:0.6]');
    frame.append(preview);
    slide.append(frame);
    return slide;
  });
  parts.list.classList.add('swiper-wrapper', ...FALLBACK);
  parts.list.replaceChildren(...slides);
  parts.list.classList.remove('aspect-[4/5]'); // місце, яке тримала порожня рамка, тепер займають картки
}

// ---------- запасний режим: звичайна прокрутка ----------
const slideWidth = () => parts.list.firstElementChild?.getBoundingClientRect().width || 1;

function scrollToSlide(index) {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  parts.list.scrollTo({ left: index * (slideWidth() + 16), behavior: calm ? 'auto' : 'smooth' }); // 16 px — gap-4
}

function onNativeScroll() {
  if (swiper) return;
  const index = Math.round(parts.list.scrollLeft / (slideWidth() + 16));
  if (index !== current && data.examples[index]) show(index);
}

// Кнопки: у режимі Swiper гортають стос, у запасному — прокручують список. Після останнього йде перший.
function step(direction) {
  const total = data.examples.length;
  const target = (current + direction + total) % total;
  if (swiper) swiper.slideTo(target);
  else scrollToSlide(target);
  show(target);
}

// ---------- завантаження Swiper з CDN ----------
function loadFile(tag, attributes) {
  return new Promise((resolve, reject) => {
    const node = document.createElement(tag);
    Object.assign(node, attributes, { crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' });
    node.addEventListener('load', resolve);
    node.addEventListener('error', () => reject(new Error(`Не завантажено ${attributes.src || attributes.href}`)));
    document.head.append(node);
  });
}

async function startSwiper() {
  try {
    await Promise.all([
      loadFile('link', { rel: 'stylesheet', href: SWIPER.css, integrity: SWIPER.cssIntegrity }),
      loadFile('script', { src: SWIPER.js, integrity: SWIPER.jsIntegrity }),
    ]);
  } catch (error) {
    console.warn('Swiper не завантажився — стос гортається звичайною прокруткою.', error.message);
    return;
  }
  if (!window.Swiper) return;

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  parts.list.classList.remove(...FALLBACK);
  parts.list.scrollLeft = 0;
  parts.slider.classList.add('swiper');

  swiper = new window.Swiper(parts.slider, {
    effect: 'cards',
    initialSlide: current,
    grabCursor: true,
    rewind: true, // після останнього профілю — знову перший
    speed: calm ? 0 : 450,
    cardsEffect: { slideShadows: false, perSlideOffset: 9, perSlideRotate: 3 },
    keyboard: { enabled: true, onlyInViewport: true }, // клавіші ← → , коли стос на екрані
    a11y: {
      containerRoleDescriptionMessage: 'стос профілів',
      itemRoleDescriptionMessage: 'профіль',
      slideLabelMessage: '{{index}} з {{slidesLength}}',
      firstSlideMessage: 'Перший профіль',
      lastSlideMessage: 'Останній профіль',
    },
    on: {
      slideChange: (instance) => show(instance.activeIndex),
    },
  });
  // про зміну профілю вже повідомляє блок відомостей (aria-live), тож власне оголошення Swiper вимикаємо, щоб не дублювати
  swiper.wrapperEl.setAttribute('aria-live', 'off');
}

// ---------- запуск ----------
async function start() {
  try {
    data = await loadData();
  } catch (error) {
    console.warn('Приклади не завантажено:', error.message);
    parts.count.textContent = '';
    showLoadError(parts.list, start);
    return;
  }
  if (!data.examples.length) {
    section.hidden = true;
    return;
  }
  parts.dots.replaceChildren(...data.examples.map(() => el('li', 'stack-dot h-1 flex-1 rounded-full')));
  show(0);
  parts.list.addEventListener('scroll', onNativeScroll, { passive: true });
  parts.prev.addEventListener('click', () => step(-1));
  parts.next.addEventListener('click', () => step(1));

  // Картки й Swiper потрібні лише коли секцію от-от побачать: шість зменшених профілів і бібліотека
  // не гальмують перший показ сторінки (Lighthouse: менше часу на Style & Layout і TBT)
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      drawSlides();
      startSwiper();
    },
    { rootMargin: '600px 0px' },
  );
  observer.observe(section);
}

if (section && Object.values(parts).every(Boolean)) start();
