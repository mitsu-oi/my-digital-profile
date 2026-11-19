// Малює кодом ілюстрації сайту в стилі захищеного документа (без фотостоків і генераторів).
// Запуск: npm run build:art. Результат — SVG-файли в assets/images/.
//   guilloche-waves.svg — гільйош: переплетені хвилі, як на сторінках паспорта (плитка для фону)
//   guilloche-rosette.svg — гільйошна розетка (кругла захисна сітка)
//   portrait.svg — «гравірований» портрет: силует, заповнений тонкими хвилястими лініями
const fs = require('fs');
const path = require('path');

const out = path.resolve(__dirname, '..', 'assets', 'images');
const r1 = (n) => Math.round(n * 2) / 2; // округлення до 0,5, щоб файли були малі

// Перетворює масив точок на атрибут d для <path>
function line(points) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('');
}

// ---------- 1. Гільйош-хвилі ----------
// Плитка 240×48: кілька синусоїд із різними фазами. Період ділить ширину, тож плитка стикується без шва.
// Колір не задаємо (stroke="#000"): на сайті файл працює як маска, а колір дає CSS.
function waves() {
  const width = 240;
  const height = 48;
  const curves = [];
  for (let k = 0; k < 8; k++) {
    const phase = (k / 8) * Math.PI * 2;
    const points = [];
    for (let x = 0; x <= width; x += 4) {
      const t = (x / width) * Math.PI * 2;
      // дві хвилі різної частоти дають «плетений» візерунок
      const y = height / 2 + Math.sin(t * 2 + phase) * 14 + Math.sin(t * 6 - phase) * 4;
      points.push([x, y]);
    }
    curves.push(`<path d="${line(points)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><g fill="none" stroke="#000" stroke-width="0.6">${curves.join('')}</g></svg>\n`;
}

// ---------- 2. Гільйошна розетка ----------
// Кожна крива — коло з радіусом, що коливається: r(θ) = R + a·sin(kθ + φ). Багато кривих зі зсувом φ дають сітку.
function rosette() {
  const size = 400;
  const c = size / 2;
  const curves = [];
  const rings = [
    { R: 150, a: 30, k: 12, count: 9 },
    { R: 92, a: 16, k: 8, count: 7 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const phase = (i / ring.count) * Math.PI * 2;
      const points = [];
      for (let step = 0; step <= 144; step++) {
        const angle = (step / 144) * Math.PI * 2;
        const r = ring.R + ring.a * Math.sin(ring.k * angle + phase);
        points.push([c + r * Math.cos(angle), c + r * Math.sin(angle)]);
      }
      curves.push(`<path d="${line(points)}Z"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><g fill="none" stroke="#000" stroke-width="0.5">${curves.join('')}</g></svg>\n`;
}

// ---------- 3. Гравірований портрет ----------
// Силует (голова, шия, плечі, зачіска) задано фігурами в clipPath; усередині — горизонтальні хвилясті лінії.
// Волосся заповнене вдвічі густіше, тому виглядає темнішим, як на гравюрі в документі.
function portrait() {
  const w = 200;
  const h = 250;
  const ink = '#14213d';
  const rows = (step, amp, from = 0, to = h) => {
    const paths = [];
    for (let y = from; y <= to; y += step) {
      const points = [];
      for (let x = 0; x <= w; x += 8) points.push([x, y + Math.sin(x / 9 + y / 7) * amp]);
      paths.push(`<path d="${line(points)}"/>`);
    }
    return paths.join('');
  };
  const head = '<ellipse cx="100" cy="98" rx="40" ry="50"/>';
  const neck = '<path d="M80 135h40v40H80z"/>';
  const shoulders = '<path d="M14 250C18 205 44 182 82 172h36c38 10 64 33 68 78z"/>';
  const hair = '<path d="M58 104C52 58 74 36 102 36c30 0 48 22 42 66-6-20-18-34-40-38-20 6-36 18-46 40z"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<clipPath id="bust">${head}${neck}${shoulders}</clipPath>
<clipPath id="hair">${hair}</clipPath>
</defs>
<rect width="${w}" height="${h}" fill="#eceae1"/>
<g fill="none" stroke="${ink}" stroke-opacity="0.12" stroke-width="0.6">${rows(6, 1.2)}</g>
<g clip-path="url(#bust)" fill="none" stroke="${ink}" stroke-width="1.1">${rows(3.2, 1.4)}</g>
<g clip-path="url(#hair)" fill="none" stroke="${ink}" stroke-width="1.3">${rows(1.8, 1.6, 30, 110)}</g>
<g fill="none" stroke="${ink}" stroke-width="1.2" stroke-linecap="round">${head}${shoulders}<path d="M86 116q14 8 28 0"/></g>
</svg>
`;
}

fs.mkdirSync(out, { recursive: true });
const files = { 'guilloche-waves.svg': waves(), 'guilloche-rosette.svg': rosette(), 'portrait.svg': portrait() };
for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(out, name), svg);
  console.log(name, `${(svg.length / 1024).toFixed(1)} КБ`);
}
