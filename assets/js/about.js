// Сторінка «Про сервіс»: запитання й відповіді з data.json.
import { el, loadData, showLoadError } from './data.js';

const list = document.querySelector('[data-faq]');

async function start() {
  list.replaceChildren(el('p', 'text-ink-soft dark:text-cream-soft', 'Завантаження запитань…'));
  try {
    const data = await loadData();
    const items = data.faq
      .filter((item) => item.question && item.answer)
      .map((item) => {
        // <details> розгортається мишею й клавіатурою без додаткового коду
        const details = el('details', 'group border-b border-line dark:border-night-line');
        const summary = el('summary', 'flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-serif text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:focus-visible:outline-cream [&::-webkit-details-marker]:hidden');
        const mark = el('span', 'font-mono text-xl text-stamp transition-transform group-open:rotate-45 dark:text-stamp-light', '+');
        mark.setAttribute('aria-hidden', 'true');
        summary.append(el('span', '', item.question), mark);
        details.append(summary, el('p', 'max-w-2xl pb-5 leading-relaxed text-ink-soft dark:text-cream-soft', item.answer));
        return details;
      });
    list.replaceChildren(...items);
  } catch (error) {
    showLoadError(list, start, error);
  }
}

if (list) start();
