// Сторінка «Шаблони»: «пробник» (вибір бланка й палітри + великий перегляд) і таблиця порівняння бланків.
// Вибір зроблено звичайними радіокнопками: стрілки, Tab і читачі екрана працюють без додаткового коду.
import { el, byId, radio, loadData, showLoadError } from './data.js';
import { renderProfile, TITLES } from './render-profile.js';

const picker = document.querySelector('[data-picker]');
const templatesBox = document.querySelector('[data-templates]');
const palettesBox = document.querySelector('[data-palettes]');
const preview = document.querySelector('[data-preview]');
const choose = document.querySelector('[data-choose]');
const status = document.querySelector('[data-status]');
const compare = document.querySelector('[data-compare]');

const params = new URLSearchParams(location.search);
const state = { template: params.get('template') || 'card', palette: params.get('palette') || 'ink' };
let data = null;

// вибрана радіокнопка: рамка чорнилом і крапка-позначка (peer-checked на сусідньому span)
const OPTION = 'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-line bg-sheet px-3 py-2 transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink dark:border-night-line dark:bg-night-sheet dark:hover:border-cream dark:has-[:checked]:border-stamp-light dark:has-[:checked]:ring-stamp-light dark:has-[:focus-visible]:outline-cream';

function drawTemplates() {
  templatesBox.replaceChildren(
    ...data.templates.map((template, index) => {
      const label = el('label', OPTION);
      const number = el('span', 'shrink-0 font-mono text-xs whitespace-nowrap text-ink-soft lg:mt-1 lg:self-start dark:text-cream-soft', `№ ${index + 1}`);
      number.setAttribute('aria-hidden', 'true');
      const text = el('span', 'flex flex-col');
      text.append(el('span', 'font-semibold', template.name));
      // короткий опис видно лише там, де є місце (один стовпець на широкому екрані)
      text.append(el('span', 'hidden text-sm leading-snug text-ink-soft lg:block dark:text-cream-soft', template.description.split('.')[0] + '.'));
      label.append(radio('template', template.id, template.id === state.template), number, text);
      return label;
    }),
  );
}

function drawPalettes() {
  palettesBox.replaceChildren(
    ...data.palettes.map((palette) => {
      const label = el('label', `${OPTION} flex-col items-stretch! gap-2! px-2! text-center`);
      // зразок фарби: фон аркуша, колір тексту й акцент — три смуги
      const swatch = el('span', 'flex h-8 overflow-hidden rounded-sm ring-1 ring-black/10');
      swatch.setAttribute('aria-hidden', 'true');
      for (const [color, grow] of [[palette.bg, 'flex-[2]'], [palette.text, 'flex-1'], [palette.accent, 'flex-1']]) {
        const band = el('span', grow);
        band.style.background = color;
        swatch.append(band);
      }
      label.append(radio('palette', palette.id, palette.id === state.palette), swatch, el('span', 'text-sm font-medium', palette.name));
      return label;
    }),
  );
}

function drawPreview() {
  const template = byId(data.templates, state.template);
  const palette = byId(data.palettes, state.palette);
  state.template = template.id;
  state.palette = palette.id;

  // перегляд — ілюстрація: inert прибирає його з клавіатури й читача екрана, а що саме показано, каже status
  const profile = renderProfile(data.examples[0].profile, palette, { template: template.id, level: 3 });
  profile.classList.add('min-h-full', '[zoom:0.8]', 'sm:[zoom:0.9]');
  preview.inert = true;
  preview.replaceChildren(profile);

  choose.href = `builder.html?template=${encodeURIComponent(template.id)}&palette=${encodeURIComponent(palette.id)}`;
  choose.textContent = `Оформити профіль на бланку «${template.name}»`;
  status.textContent = `Показано бланк «${template.name}», палітра «${palette.name}».`;
}

function drawCompare() {
  compare.replaceChildren(
    ...data.templates.map((template, index) => {
      const row = el('tr');
      const name = el('th', 'py-5 pr-6 align-top font-normal');
      name.scope = 'row';
      name.append(el('span', 'block font-mono text-xs text-ink-soft dark:text-cream-soft', `Бланк № ${index + 1}`), el('span', 'font-serif text-xl font-bold', template.name));

      const fits = el('ul', 'flex flex-col items-start gap-1.5');
      fits.append(...data.fits.filter((fit) => template.fits.includes(fit.id)).map((fit) => el('li', 'rounded-full border border-stamp/40 px-3 py-0.5 text-sm text-stamp dark:border-stamp-light/50 dark:text-stamp-light', fit.name)));
      const sections = el('ul', 'space-y-0.5 text-sm');
      sections.append(...(template.required || []).map((type) => el('li', '', TITLES[type] || type)));

      const cell = (child, extra = '') => {
        const td = el('td', `py-5 pr-6 align-top ${extra}`);
        td.append(child);
        return td;
      };
      row.append(name, cell(el('p', 'max-w-xs leading-relaxed text-ink-soft dark:text-cream-soft', template.description)), cell(fits), cell(sections, 'pr-0!'));
      return row;
    }),
  );
}

async function start() {
  status.textContent = 'Завантаження шаблонів…';
  try {
    data = await loadData();
    drawTemplates();
    drawPalettes();
    drawPreview();
    drawCompare();
  } catch (error) {
    status.textContent = '';
    showLoadError(preview, start, error);
  }
}

picker?.addEventListener('change', (event) => {
  if (event.target.name === 'template' || event.target.name === 'palette') {
    state[event.target.name] = event.target.value;
    drawPreview();
  }
});

if (picker && templatesBox && palettesBox && preview && choose && status && compare) start();
