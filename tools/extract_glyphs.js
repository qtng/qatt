// Reads the drawing of every character of the QATT block from the rendered unicode.html (qatt.js) and writes font/glyphs.json:
//   [{o: offset, n: name, t: type, q: qatt code, d: [stroke paths], dm: [paths of the combining form, tones only]}]
// Usage: node tools/extract_glyphs.js http://localhost:8790/unicode.html font/glyphs.json
// (serve the repository with e.g. `python3 -m http.server 8790`; needs playwright and a chromium, PLAYWRIGHT_MODULE and CHROMIUM may point to them)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.route(u => !u.href.startsWith(new URL(url).origin), r => r.abort());
  await page.goto(url);
  await page.waitForSelector('#chart td svg');
  const glyphs = await page.evaluate(() => {
    const D = JSON.parse(document.getElementById('qatt-data').textContent);
    const TONE = { 'SEMICIRCLE UPPER RIGHT': 1, 'CIRCLE LOWER LEFT': 2, 'SEMICIRCLE UPPER LEFT': 3, 'CIRCLE UPPER LEFT': 4, 'CIRCLE UPPER RIGHT': 5, 'SEMICIRCLE LOWER RIGHT': 6, 'CIRCLE LOWER RIGHT': 7, 'SEMICIRCLE LOWER LEFT': 8 };
    const pathOf = id => { const e = document.getElementById(id); return e && e.getAttribute('d'); };
    const cells = [...document.querySelectorAll('#chart td')];
    return D.chars.map(c => {   // the offsets are not contiguous (reserved gaps), td i of the chart is offset i
      const o = c.o, g = { o, n: c.n, t: c.t, q: '', d: [] };
      if (c.t === 'tone') {
        const digit = TONE[c.n.replace(/^TONE /, '')];
        g.q = ',,,' + digit;
        g.dm = [pathOf('qt' + (digit === 8 ? 0 : digit))];   // the combining form is smaller than the standalone one
      } else if (c.t !== 'combiner' && c.t !== 'joiner') {
        const w = c.n.split(' ')[0];
        const onset = w === 'ONG' ? '_' : w === 'DDONG' ? 'd' : w === 'DZONG' ? 'dz' : w.slice(0, -3).toLowerCase();
        g.q = ',' + onset + (c.m || '');
      }
      const svg = cells[o].querySelector('svg');
      if (svg) g.d = [...svg.querySelectorAll('use')].map(u => u.getAttribute('href').slice(1)).filter(id => id !== 'square').map(pathOf);
      return g;
    });
  });
  fs.writeFileSync(out, JSON.stringify(glyphs));
  console.log(glyphs.length, 'glyphs');
  await browser.close();
})();
