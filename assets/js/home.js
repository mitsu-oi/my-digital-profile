// Головна: заповнює «віяло» бланків справжніми зменшеними профілями з data.json.
// Якщо дані не завантажились, лишаються порожні аркуші з назвами — сторінка все одно читається.
import { loadData } from './data.js';
import { renderProfile } from './render-profile.js';

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
