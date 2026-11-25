// Експорт профілю в самодостатній HTML-файл і читання такого файла назад (імпорт).
//
// Експорт: файл містить стилі (css/site.css) і шрифти, вбудовані як data:-адреси, тож відкривається
// без інтернету в будь-якому браузері. Реклами й посилань на сервіс у файлі немає.
// Дані профілю вкладено як JSON у <script type="application/json"> — такий блок браузер НЕ виконує,
// це лише текст, який конструктор прочитає при імпорті.
//
// Імпорт: файл читається як текст і розбирається DOMParser-ом — він будує документ, але не запускає
// жодних скриптів і не вантажить зображень. Беремо лише наш JSON-блок; решту файла ігноруємо.

export const FILE_FORMAT = 'osya-profile';
export const FILE_VERSION = 1;
export const IMPORT_MAX_BYTES = 3 * 1024 * 1024; // 3 МБ: з фото файл зазвичай важить 300–600 КБ

// Шрифти, які вбудовуються у файл (ті самі, що на сайті)
const FONTS = ['golos-text-cyrillic', 'golos-text-latin', 'lora-cyrillic', 'lora-latin', 'jetbrains-mono-cyrillic', 'jetbrains-mono-latin'];

// ArrayBuffer -> base64 (частинами, щоб не переповнити стек на великих файлах)
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Стилі сайту з уже вбудованими шрифтами. Кешуємо: вдруге файл збирається миттєво.
let cssCache = null;
async function inlineCss() {
  if (cssCache) return cssCache;
  let css = await (await fetch('css/site.css')).text();
  await Promise.all(
    FONTS.map(async (name) => {
      try {
        const buffer = await (await fetch(`assets/fonts/${name}.woff2`)).arrayBuffer();
        css = css.split(`../assets/fonts/${name}.woff2`).join(`data:font/woff2;base64,${toBase64(buffer)}`);
      } catch (error) {
        console.warn('Шрифт не вбудовано, у файлі буде запасний:', name);
      }
    }),
  );
  // голографічна маска гільйошу у файлі не потрібна (там немає цих елементів), а відносні адреси зламалися б
  css = css.replace(/url\("?\.\.\/assets\/images\/[^)"]+"?\)/g, 'none');
  cssCache = css;
  return css;
}

// Текст для імені файла: «Олена Коваль» -> «olena-koval»
const LATIN = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia' };
export function fileName(name, extension) {
  const slug = [...String(name || '').toLowerCase()]
    .map((char) => (char in LATIN ? LATIN[char] : /[a-z0-9]/.test(char) ? char : ' '))
    .join('')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `${slug || 'portfolio'}.${extension}`;
}

// Екранування тексту для вставки в HTML-рядок (заголовок сторінки)
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Збирає текст HTML-файла. node — уже намальований профіль (renderProfile), profile — дані для імпорту.
export async function buildHtmlFile(node, profile, palette) {
  const css = await inlineCss();
  // JSON усередині <script>: «<» замінюємо на <, щоб текст на кшталт «</script>» не закрив блок
  const json = JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), profile }).replace(/</g, '\\u003c');
  const title = profile.person.name ? `${profile.person.name} — портфоліо` : 'Портфоліо';
  // outerHTML безпечний: увесь текст користувача потрапив у вузли через textContent, тож тут він уже екранований
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${css}
/* сторінка файла: профіль по центру, у друці — без полів і тіней */
body { margin: 0; background: ${palette.bg}; }
.file-page { max-width: 56rem; margin: 2rem auto; padding: 0 1rem; }
@page { margin: 12mm; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .file-page { margin: 0; padding: 0; } }
</style>
</head>
<body>
<main class="file-page">
${node.outerHTML}
</main>
<script type="application/json" id="osya-data">${json}</script>
</body>
</html>
`;
}

// Віддає файл користувачу як завантаження
export function download(text, name, type = 'text/html') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Читає раніше збережений HTML-файл. Повертає «сирий» профіль (його ще треба очистити cleanProfile)
// або кидає помилку зі зрозумілим поясненням.
export async function readProfileFile(file) {
  if (!file) throw new Error('Файл не обрано.');
  if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') throw new Error('Це не HTML-файл. Оберіть файл, збережений кнопкою «Завантажити HTML».');
  if (file.size > IMPORT_MAX_BYTES) throw new Error(`Файл завеликий (${(file.size / 1024 / 1024).toFixed(1)} МБ). Збережений профіль важить до 3 МБ.`);
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'text/html'); // скрипти тут не виконуються
  const block = doc.querySelector('script#osya-data[type="application/json"]');
  if (!block) throw new Error('У файлі немає даних профілю. Підходить лише файл, збережений у цьому конструкторі як HTML.');
  let parsed;
  try {
    parsed = JSON.parse(block.textContent);
  } catch (error) {
    throw new Error('Дані у файлі пошкоджені, прочитати їх не вдалося.');
  }
  if (!parsed || parsed.format !== FILE_FORMAT || typeof parsed.profile !== 'object' || parsed.profile === null) throw new Error('Файл не схожий на збережений профіль ОсьЯ.');
  if (parsed.version > FILE_VERSION) throw new Error('Файл збережено новішою версією конструктора. Оновіть сторінку й спробуйте ще раз.');
  return parsed.profile;
}
