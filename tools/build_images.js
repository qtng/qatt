// Draws the before/after pictures of admin/font/build.html (admin/font/build/*.png): builds QATT Pen several times with one number changed, sets the same
// text in each and takes a picture of every row. Needs Python with the packages of tools/requirements.txt, Node.js with playwright and a chromium
// (PLAYWRIGHT_MODULE and CHROMIUM may point to them) and a Han font (the characters next to the letters; WenQuanYi Zen Hei or any Noto CJK).
// Usage, in the root of the repository:  node tools/build_images.js        (about a minute; the fonts are built in a temporary folder)
// To change a picture, change its list in FIGURES (the number, its values, the label of each panel) and run it again.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'admin', 'font', 'build');

const HAN = '國音新字', TONES = 'tân tán tàn tản tãn tạn', SYLLABLES = 'tân tự';
// each figure: the number (environment variable) and its panels [value, label]; null = the standard (built once)
const FIGURES = [
  { file: 'vs', env: 'QATT_VS', text: HAN + ' ' + SYLLABLES, size: 60, panels: [['1', 'QATT_VS = 1'], [null, 'QATT_VS = 1.4 (standard)'], ['1.8', 'QATT_VS = 1.8']] },
  { file: 'vc', env: 'QATT_VC', text: HAN + ' ' + SYLLABLES, size: 60, panels: [['450', 'QATT_VC = 450'], [null, 'QATT_VC = 577 (standard)'], ['700', 'QATT_VC = 700']] },
  { file: 'hs', env: 'QATT_HS', text: HAN + ' a ê u', size: 60, panels: [['1', 'QATT_HS = 1'], [null, 'QATT_HS = 1.3 (standard)'], ['1.6', 'QATT_HS = 1.6']] },
  { file: 'tv', env: 'QATT_TV', text: TONES, tight: true, size: 60, panels: [['0', 'QATT_TV = 0'], [null, 'QATT_TV = 0.5 (standard)'], ['1', 'QATT_TV = 1']] },
  { file: 'th', env: 'QATT_TH', text: TONES, tight: true, size: 60, panels: [['0.5', 'QATT_TH = 0.5'], ['0', 'QATT_TH = 0'], [null, 'QATT_TH = -0.5 (standard)']] },
  { file: 'tone-side', env: 'QATT_TONE_SIDE', text: TONES, tight: true, size: 60, vertical: true, panels: [['0', 'QATT_TONE_SIDE = 0'], [null, 'QATT_TONE_SIDE = 140 (standard)'], ['250', 'QATT_TONE_SIDE = 250']] },
  { file: 'tone-y', env: 'QATT_TONE_Y', text: TONES, tight: true, size: 60, vertical: true, panels: [[null, 'QATT_TONE_Y = 0 (standard)'], ['40', 'QATT_TONE_Y = 40'], ['80', 'QATT_TONE_Y = 80']] },
  // the weights are fonts of their own, nothing to build
  { file: 'weight', text: SYLLABLES, size: 64, panels: [['qatt-pen-extralight', '--weight 0.6'], ['qatt-pen-light', '--weight 1.0'], ['qatt-pen', '--weight 1.6'], ['qatt-pen-medium', '--weight 2.4']], font: true },
];

const run = (env, out) => new Promise((ok, fail) => {
  const args = ['tools/build_font.py', '--vertical', '--kage', 'fonts/kage.json', '--pen', '--weight', '1.6', 'fonts/glyphs.json', out];
  const p = spawn('python3', args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'ignore' });
  p.on('exit', c => c ? fail(new Error('build failed: ' + out)) : ok());
});

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qatt-build-images-'));
  const jobs = [['std', {}]];
  for (const f of FIGURES) if (f.env) for (const [v] of f.panels) if (v !== null) jobs.push([f.file + '-' + v, { [f.env]: v }]);
  let next = 0;
  await Promise.all([0, 1, 2, 3].map(async () => { while (next < jobs.length) { const [name, env] = jobs[next++]; await run(env, path.join(tmp, name)); console.log('built', name); } }));

  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
  await page.route('https://qatt.org/**', r => {
    const u = new URL(r.request().url()), m = u.pathname.match(/^\/tmpfonts\/(.+)$/);
    r.fulfill({ path: m ? path.join(tmp, m[1]) : path.join(ROOT, u.pathname === '/' ? 'symbols.html' : u.pathname) }).catch(() => r.abort());
  });
  await page.route(/supabase/, r => r.abort());
  await page.goto('https://qatt.org/symbols.html');
  await page.evaluate(async () => {
    for (const u of ['/js/parser.js', '/js/qatt-text.js']) { const s = document.createElement('script'); s.src = u; document.head.append(s); await new Promise(r => s.onload = r); }
  });
  for (const f of FIGURES) {
    const panels = f.panels.map(([v, label]) => ({
      label, family: ('P' + f.file + (v === null ? 'std' : v)).replace(/[^A-Za-z0-9]/g, '_'),
      src: f.font ? '/fonts/' + v : '/tmpfonts/' + (v === null ? 'std' : f.file + '-' + v) }));
    await page.evaluate(async ({ f, panels }) => {
      const parser = new VietnameseParser(), han = /[一-鿿]+/;
      const convert = t => t.split(/(\s+)/).map(w => han.test(w) ? w : /^\s+$/.test(w) && f.tight ? '' : QattText.convert(w, parser)).join('');
      const style = document.createElement('style');
      style.textContent = panels.map(p => `@font-face{font-family:${p.family};src:url(${p.src}.woff2)}`).join('') +
        'body{margin:0;background:#fff}.fig{display:flex;gap:18px;padding:16px;background:#fffdf8;width:max-content;font-family:system-ui,sans-serif}' +
        '.pn{text-align:center;border:1px solid #e4d9c0;border-radius:8px;padding:10px 14px;background:#fff}.pn .t{line-height:1.25;white-space:pre}' +
        '.pn .l{font:13px/1.2 ui-monospace,Menlo,monospace;color:#6a5a48;margin-top:10px}.pn .t.v{writing-mode:vertical-rl;height:' + (f.size * 6.4) + 'px}';
      document.head.append(style);
      document.body.innerHTML = '<div class="fig" id="fig"></div>';
      for (const p of panels) {
        const d = document.createElement('div'); d.className = 'pn';
        const t = document.createElement('div'); t.className = 't' + (f.vertical ? ' v' : '');
        t.style.cssText = `font-size:${f.size}px;font-family:${p.family},"WenQuanYi Zen Hei","Noto Sans CJK TC",serif`;
        t.textContent = convert(f.text);
        const l = document.createElement('div'); l.className = 'l'; l.textContent = p.label;
        d.append(t, l); fig.append(d);
      }
      await Promise.all(panels.map(p => document.fonts.load(`${f.size}px ${p.family}`)));
      await document.fonts.ready;
    }, { f, panels });
    await page.waitForTimeout(300);
    await (await page.$('#fig')).screenshot({ path: path.join(OUT, f.file + '.png') });
    console.log('picture', f.file);
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
