// Одноразове завантаження шрифтів (кирилиця й латиниця, формат woff2) у assets/fonts.
// Запуск: node scripts/fetch-fonts.js. Шрифти мають відкриту ліцензію SIL OFL.
// Після запуску скрипт друкує готові правила @font-face для src/input.css.
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'assets', 'fonts');
const FAMILIES = 'family=Lora:wght@500;600;700&family=Golos+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500';
// Google Fonts віддає woff2 лише сучасним браузерам, тому називаємося одним із них
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${FAMILIES}&display=swap`, { headers: { 'User-Agent': UA } })).text();
  const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face\s*{([^}]+)}/g)]
    .map((match) => ({ subset: match[1], body: match[2] }))
    .filter((block) => ['cyrillic', 'latin'].includes(block.subset));

  const saved = new Map(); // адреса файлу -> локальна назва
  const faces = new Map(); // «родина|набір|файл» -> { weights, range }
  for (const block of blocks) {
    const family = block.body.match(/font-family:\s*'([^']+)'/)[1];
    const weight = Number(block.body.match(/font-weight:\s*(\d+)/)[1]);
    const url = block.body.match(/url\(([^)]+)\)/)[1];
    const range = block.body.match(/unicode-range:\s*([^;]+);/)[1];
    if (!saved.has(url)) {
      const sameFile = blocks.filter((other) => other.body.includes(url)).length > 1; // варіативний шрифт: один файл на всі накреслення
      const name = `${family.toLowerCase().replace(/\s+/g, '-')}-${block.subset}${sameFile ? '' : '-' + weight}.woff2`;
      fs.writeFileSync(path.join(OUT, name), Buffer.from(await (await fetch(url)).arrayBuffer()));
      saved.set(url, name);
    }
    const key = `${family}|${block.subset}|${saved.get(url)}`;
    if (!faces.has(key)) faces.set(key, { weights: [], range });
    faces.get(key).weights.push(weight);
  }

  for (const [key, face] of faces) {
    const [family, , file] = key.split('|');
    const min = Math.min(...face.weights);
    const max = Math.max(...face.weights);
    const size = Math.round(fs.statSync(path.join(OUT, file)).size / 1024);
    console.log(`/* ${file}, ${size} КБ */\n@font-face {\n  font-family: "${family}";\n  font-style: normal;\n  font-weight: ${min === max ? min : `${min} ${max}`};\n  font-display: swap;\n  src: url("../assets/fonts/${file}") format("woff2");\n  unicode-range: ${face.range};\n}`);
  }
})().catch((error) => {
  console.error('Не вдалося завантажити шрифти:', error.message);
  process.exit(1);
});
