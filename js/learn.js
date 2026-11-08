/*
The lessons of learn/ (the course "Learn QATT"): the list of the lessons, the steps above and the pager below a lesson, the progress of the browser,
and the board: rows of two items, a band that moves down row by row every few seconds and reads the row aloud, tabs above it that change the rows.
Every glyph and reading comes from js/parser.js and js/qatt-text.js (the decodings of the site), nothing is kept here.

  Learn.page('rhymes')                    the steps and the pager of that lesson (#learnSteps, #learnPager); a lesson with soon: true is a page that only says "coming soon"
  Learn.board(el, { build, step, decoding, lesson })
        build(parser) -> [{ label, vi, sample, rows: [[item, item], …] }]   (called again when the decoding changes, then onRebuild(parser)); tabRows: the tabs in that many rows
        item = { glyph | parts: [a, b], show, small, smallVi, speak }      (glyph: QATT text; show: the reading, in the middle of the row; small: a line below it)
  Learn.parser, Learn.glyph(shape, mark), Learn.code(shape), Learn.consonant(shape), Learn.cell(word), Learn.syllable(code)
Needs parser.js and qatt-text.js; css/learn.css.
*/
const Learn = (() => {
  const LESSONS = [
    { id: 'consonants', en: 'Consonants', vi: 'Phụ âm', sample: ['h', 0], about: 'The 22 base shapes stand for the initial consonants.', aboutVi: '22 hình cơ bản là các phụ âm đầu.' },
    { id: 'rhymes', en: 'Rhymes', vi: 'Vần', sample: ['ng', 3], about: 'Marking strokes 2 to 6 turn a shape into a rhyme.', aboutVi: 'Nét đánh dấu 2 đến 6 biến hình thành vần.' },
    { id: 'pairs', en: 'Phiên thiết pairs', vi: 'Cặp phiên thiết', sample: 'con', about: 'An initial and a rhyme join into one syllable.', aboutVi: 'Phụ âm đầu và vần ghép thành một âm tiết.' },
    { id: 'tones', en: 'Tones', vi: 'Thanh điệu', sample: 'mán', about: 'Eight tone marks after the syllable.', aboutVi: 'Tám dấu thanh sau âm tiết.' },
    { id: 'hop-thu', en: 'Hợp Thư', vi: 'Hợp Thư', sample: 'không', about: 'ông, ong, ung and uông in their short forms.', aboutVi: 'ông, ong, ung và uông viết gọn.' },
    { id: 'reading', en: 'Reading', vi: 'Đọc', sample: 'đọc', about: 'Read words and short sentences.', aboutVi: 'Đọc từ và câu ngắn.' },
  ];
  const BASE = '/learn/';
  const href = l => BASE + l.id + '.html';
  const PRACTICE = { en: 'Practice: Spell it!', vi: 'Luyện tập: Đánh vần!', href: '/spell.html' };

  const parser = new VietnameseParser('qatt');
  const SHAPES = VietnameseParser.SHAPES;                       // l z ng h g c tr d … the order of the rhyme tables
  const code = s => s === 'z' ? '_' : s;
  const glyph = (shape, mark) => QattText.syllable(code(shape) + (mark || '') + ',,,0');
  const syllable = c => QattText.syllable(c);
  const cell = w => QattText.word(w, parser);

  // a plain shape as an initial: its main spelling (parser.toQuocNgu of the bare consonant), the other spellings (QATT_ONSET_MAP), its name (bờ, cờ, …; ʔ is read ờ)
  const consonant = shape => {
    const main = parser.toQuocNgu({ onset: code(shape), rhyme: '', tone: 0 });
    const alt = Object.entries(VietnameseParser.QATT_ONSET_MAP).filter(([k, v]) => v === shape && k !== main && !/^[fjwz]$/.test(k)).map(([k]) => k);
    return main ? { show: main, small: alt.join(', '), speak: main + 'ờ' } : { show: 'ʔ', small: 'no consonant', smallVi: 'không phụ âm', speak: 'ờ' };
  };

  // progress of this browser: { <lesson id>: true }
  const KEY = 'qattLearn';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const isDone = id => !!load()[id];
  const done = id => { const p = load(); if (p[id]) return; p[id] = true; try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} mark(); };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const tr = (tag, cls, en, vi) => { const e = el(tag, cls, en); if (vi) e.dataset.vi = vi; return e; };
  const sampleOf = l => Array.isArray(l.sample) ? glyph(...l.sample) : cell(l.sample);

  let current = null;
  const mark = () => document.querySelectorAll('[data-lesson]').forEach(li => li.classList.toggle('done', isDone(li.dataset.lesson)));

  // the steps of the course (#learnSteps) and the pager (#learnPager) of a lesson
  const page = id => {
    current = id;
    const at = LESSONS.findIndex(l => l.id === id);
    const steps = document.getElementById('learnSteps');
    if (steps) {
      const ol = el('ol', 'steps');
      const home = el('li', 'home'), back = el('a', 'step-nav'); back.href = BASE;   // the overview first: a grid icon
      back.setAttribute('aria-label', 'Overview'); back.dataset.viAriaLabel = 'Tổng quan';
      const icon = el('span', 'num'); icon.append(el('i', 'bi bi-grid-3x3-gap-fill'));
      back.append(icon, tr('span', 't', 'Overview', 'Tổng quan'));
      home.append(back); ol.append(home);
      LESSONS.forEach((l, i) => {
        const li = el('li', (i === at ? 'now' : '') + (l.soon ? ' soon' : '')); li.dataset.lesson = l.id;
        const a = el('a', 'step-nav'); a.href = href(l);   // "nav" in the class: the themes leave the colour of such links alone
        if (i === at) a.setAttribute('aria-current', 'step');
        a.append(el('span', 'num', i + 1), tr('span', 't', l.en, l.vi));
        li.append(a); ol.append(li);
      });
      steps.replaceChildren(ol);
    }
    const kicker = document.getElementById('lessonNo');
    if (kicker && at >= 0) {
      kicker.replaceChildren(tr('span', '', 'Lesson', 'Bài'), document.createTextNode(` ${at + 1} / ${LESSONS.length}`));
    }
    const pager = document.getElementById('learnPager');
    if (pager && at >= 0) {
      const box = el('div', 'pager');
      const prev = LESSONS[at - 1], next = LESSONS[at + 1];
      const link = (cls, url, icon, en, vi, after) => {
        const a = el('a', 'btn btn-pill ' + cls); a.href = url;
        const i = el('i', 'bi ' + icon), t = tr('span', '', en, vi);
        a.append(...(after ? [t, i] : [i, t]));
        return a;
      };
      box.append(prev ? link('btn-quiet', href(prev), 'bi-arrow-left', prev.en, prev.vi) : link('btn-quiet', BASE, 'bi-grid', 'Overview', 'Tổng quan'));
      box.append(next ? link('btn-cinnabar', href(next), 'bi-arrow-right', next.en, next.vi, true) : link('btn-cinnabar', PRACTICE.href, 'bi-mortarboard', PRACTICE.en, PRACTICE.vi, true));
      pager.replaceChildren(box);
    }
    mark();
  };

  // the overview: a card for every lesson, and the practice at the end
  const overview = container => {
    LESSONS.forEach((l, i) => {
      const a = el('a', 'card-box lesson-card' + (l.soon ? ' soon' : '')); a.href = href(l); a.dataset.lesson = l.id;
      const text = el('div');
      const no = el('div', 'no', `${i + 1}`);
      if (l.soon) no.append(tr('span', 'badge-soon', 'Coming soon', 'Sắp ra mắt'));
      text.append(no, tr('h2', '', l.en, l.vi), tr('p', '', l.about, l.aboutVi));
      const check = el('i', 'bi bi-check-circle-fill check'); check.hidden = !isDone(l.id); check.setAttribute('aria-label', 'done');
      a.append(el('div', 'g', sampleOf(l)), text, check);
      container.append(a);
    });
    // after the course: practice and writing (no lessons of their own)
    const extra = (url, sample, en, vi, about, aboutVi) => {
      const a = el('a', 'card-box lesson-card'); a.href = url;
      const text = el('div'); text.append(el('div', 'no', '→'), tr('h2', '', en, vi), tr('p', '', about, aboutVi));
      a.append(el('div', 'g', cell(sample)), text);
      container.append(a);
    };
    extra(PRACTICE.href, 'vần', 'Spell it!', 'Đánh vần!', 'Practise what you learned: spell words with the symbols.', 'Luyện tập: đánh vần từ bằng các ký hiệu.');
    extra('/editor.html', 'viết', 'Write QATT', 'Viết QATT', 'Type with Telex in the writer of this site or in the Qatt.org Notes app: a word becomes QATT at the space.', 'Gõ Telex trong trình soạn thảo hoặc ứng dụng Qatt.org Notes: từ thành QATT khi gõ dấu cách.');
  };

  // speech of the Chunom site (decks/audiomanager.js: the browser voice, else Google TTS), as in spell.html
  const CHUNOM = 'https://chunom.org/';
  let speaker = null, speakerLoad = null;
  const withSpeaker = fn => {
    const go = () => { speaker = speaker || new AudioManager(new Audio(), {}); fn(speaker); };
    if (typeof AudioManager !== 'undefined') return go();
    if (!speakerLoad) {
      speakerLoad = [];
      const sc = document.createElement('script');
      sc.src = CHUNOM + 'chunom/decks/audiomanager.js';
      sc.onload = () => speakerLoad.forEach(f => f());
      document.head.append(sc);
    }
    speakerLoad.push(go);
  };
  let sound = true;
  try { sound = localStorage.getItem('qattLearnSound') !== '0'; } catch (e) {}
  const speak = text => { if (sound && text) withSpeaker(sp => sp.speak(text, 'auto', 0.8)); };   // read aloud (unless the sound of the board is off)

  // the board
  const board = (root, { build, step = 4000, decoding = true, lesson = current, onRebuild, tabRows = 1 } = {}) => {
    root.style.setProperty('--step', step / 1000 + 's');
    const html = `
      <div class="d-flex justify-content-center align-items-center gap-2 tools mb-3">
        ${decoding ? `<select class="form-select form-select-sm w-auto" data-k="decoding" aria-label="Decoding" data-vi-aria-label="Cách giải mã"><optgroup label="Choose decoding" data-vi-label="Lựa chọn cách giải mã"><option value="qatt" selected>qatt.org</option><option value="omniglot">omniglot.com</option></optgroup></select>` : ''}
        <select data-qatt-fonts data-qatt-default="QATT Pen" class="form-select form-select-sm w-auto" aria-label="Font"></select>
      </div>
      <div class="marks" role="tablist" data-k="marks"><div class="pill" data-k="pill"></div></div>
      <div class="progress-line" aria-hidden="true"><div data-k="progress"></div></div>
      <div class="card-box board mt-3" data-k="board">
        <div class="band" data-k="band" aria-live="polite">
          <i class="bi bi-volume-up-fill speaking"></i>
          <div class="tick" data-k="tick"></div>
        </div>
      </div>
      <div class="d-flex justify-content-center align-items-center gap-3 mt-4">
        <button type="button" class="btn btn-quiet round" data-k="prev" aria-label="Previous row" data-vi-aria-label="Dòng trước"><i class="bi bi-skip-backward-fill"></i></button>
        <button type="button" class="btn btn-cinnabar play" data-k="play" aria-label="Play" data-vi-aria-label="Phát"><i class="bi bi-play-fill"></i></button>
        <button type="button" class="btn btn-quiet round" data-k="next" aria-label="Next row" data-vi-aria-label="Dòng sau"><i class="bi bi-skip-forward-fill"></i></button>
        <button type="button" class="btn btn-quiet round" data-k="sound" aria-label="Sound on or off" data-vi-aria-label="Bật hoặc tắt tiếng"><i class="bi bi-volume-up-fill"></i></button>
      </div>
      <p class="hint text-center mt-3 mb-0"><span data-vi="Nhấn vào một dòng để đến đó. Phím cách: phát / dừng, mũi tên: dòng và thẻ.">Click a row to go there. Space: play / pause, arrows: row and tab.</span></p>`;
    root.innerHTML = html;
    const $ = k => root.querySelector(`[data-k="${k}"]`);
    let tabs = [], tabEls = [], rowEls = [], tab = 0, row = 0, playing = false, timer = null, started = false;   // started: the first click on a row or a tab also starts playing

    const restart = (e, cls) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };
    const placePill = () => {
      const t = tabEls[tab]; if (!t) return;
      const box = $('marks').getBoundingClientRect(), tb = t.getBoundingClientRect();
      $('pill').style.width = tb.width + 'px'; $('pill').style.height = tb.height + 'px';
      $('pill').style.transform = `translate(${tb.left - box.left}px, ${tb.top - box.top}px)`;
    };
    const drawGlyph = (target, item) => {
      if (item.parts) {
        const [a, b] = item.parts;
        target.replaceChildren(el('span', 'part', a), el('span', 'plus', '+'), el('span', 'part', b));
      } else target.textContent = item.glyph;
    };
    // the readings of a row stand in its middle, muted; the row being read shows them fully (the band only leads the eye, every row can be read)
    const reading = item => {
      const r = el('span', 'r'); r.lang = 'vi';
      r.append(el('span', 'big', item.show ?? ''));
      if (item.small) r.append(tr('span', 'small', item.small, item.smallVi));
      return r;
    };
    const drawRows = animate => {
      rowEls.forEach(r => r.div.remove());
      rowEls = tabs[tab].rows.map((pair, r) => {
        const div = el('div', 'row-pair'); div.style.setProperty('--i', r);
        const cells = pair.map(item => { const c = el('div', 'g'); drawGlyph(c, item); return c; });
        const mid = el('div', 'pair'); mid.append(reading(pair[0]), el('span', 'dot', '·'), reading(pair[1]));
        div.append(cells[0], mid, cells[1]);
        div.addEventListener('click', () => { row = r; pick(); });
        $('board').append(div);
        if (animate) restart(div, 'in');
        return { div, mid };
      });
    };
    const setTab = (t, animate) => {
      tab = (t + tabs.length) % tabs.length;
      tabEls.forEach((b, i) => { b.classList.toggle('active', i === tab); b.setAttribute('aria-selected', i === tab); });
      placePill();
      drawRows(animate);
    };
    const drawTabs = () => {
      tabEls.forEach(b => b.remove());
      tabEls = tabs.map((t, i) => {
        const b = el('button'); b.type = 'button'; b.setAttribute('role', 'tab');
        b.append(el('span', 'g', t.sample || ''), tr('span', 'n', t.label, t.vi));
        b.addEventListener('click', () => { setTab(i, true); row = 0; pick(); });
        $('marks').append(b);
        return b;
      });
      // tabRows: the tabs in that many rows (the rhymes: 11 pairs of shapes in two rows)
      if (tabRows > 1) $('marks').style.gridTemplateColumns = `repeat(${Math.ceil(tabs.length / tabRows)}, minmax(0, 1fr))`;
      $('marks').classList.toggle('rows', tabRows > 1);
      $('marks').hidden = tabs.length < 2;
      $('progress').parentElement.hidden = tabs.length < 2;
    };

    const say = text => {
      if (!sound || !text) return;
      $('band').classList.add('voice'); setTimeout(() => $('band').classList.remove('voice'), 1400);
      speak(text);
    };
    const show = speak => {
      const rows = tabs[tab].rows;
      row = Math.min(row, rows.length - 1);
      $('band').style.transform = `translateY(calc(${row} * var(--row)))`;
      rowEls.forEach((r, i) => { r.div.classList.toggle('now', i === row); r.div.classList.toggle('done', i < row); });
      const [a, b] = rows[row];
      restart(rowEls[row].mid, 'in');
      $('progress').style.width = ((row + 1) / rows.length * 100) + '%';
      const tick = $('tick'); tick.classList.remove('run'); void tick.offsetWidth;
      if (playing) { tick.classList.add('run'); rowEls[row].div.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      if (speak) setTimeout(() => say([a.speak, b.speak].filter(Boolean).join(', ')), 350);   // when the band has nearly arrived
      if (lesson && tab === tabs.length - 1 && row === rows.length - 1) done(lesson);
    };
    const schedule = () => {
      clearTimeout(timer);
      if (!playing) return;
      timer = setTimeout(() => {
        if (row < tabs[tab].rows.length - 1) row++;
        else { row = 0; setTab(tab + 1, true); }            // end of the tab: the next one
        show(true); schedule();
      }, step);
    };
    const go = () => { show(playing); schedule(); };
    const pick = () => started ? go() : setPlaying(true);
    const setPlaying = on => {
      playing = on; started = true;
      $('play').firstElementChild.className = 'bi ' + (on ? 'bi-pause-fill' : 'bi-play-fill');
      $('play').setAttribute('aria-label', on ? 'Pause' : 'Play');
      $('play').dataset.viAriaLabel = on ? 'Tạm dừng' : 'Phát';
      go();
    };
    const move = d => {
      row += d;
      if (row >= tabs[tab].rows.length) { row = 0; setTab(tab + 1, true); }
      if (row < 0) { setTab(tab - 1, true); row = tabs[tab].rows.length - 1; }
      go();
    };
    const showSound = () => {
      $('sound').setAttribute('aria-pressed', sound);
      $('sound').firstElementChild.className = 'bi ' + (sound ? 'bi-volume-up-fill' : 'bi-volume-mute-fill');
    };
    const rebuild = animate => {
      tabs = build(parser).filter(t => t.rows.length);
      drawTabs(); setTab(Math.min(tab, tabs.length - 1), animate); show(false);
      if (onRebuild) onRebuild(parser);                   // the rest of the page follows the decoding too
    };

    $('play').addEventListener('click', () => setPlaying(!playing));
    $('prev').addEventListener('click', () => move(-1));
    $('next').addEventListener('click', () => move(1));
    $('sound').addEventListener('click', () => {
      sound = !sound; showSound();
      try { localStorage.setItem('qattLearnSound', sound ? '1' : '0'); } catch (e) {}
    });
    if (decoding) {
      const sel = $('decoding');
      const want = new URLSearchParams(location.search).get('decoding');
      if (want && [...sel.options].some(o => o.value === want)) sel.value = want;
      parser.setDecoding(sel.value);
      sel.addEventListener('change', () => {
        parser.setDecoding(sel.value);
        const u = new URL(location.href); u.searchParams.set('decoding', sel.value); history.replaceState(null, '', u);
        rebuild(true);
      });
    }
    document.addEventListener('keydown', e => {
      if (e.target.closest('select, input, textarea, a, button')) return;   // a focused button gets Space itself
      if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'ArrowRight' && tabs.length > 1) { setTab(tab + 1, true); row = 0; go(); }
      else if (e.key === 'ArrowLeft' && tabs.length > 1) { setTab(tab - 1, true); row = 0; go(); }
    });
    window.addEventListener('resize', placePill);
    if (document.fonts) document.fonts.ready.then(placePill);
    showSound();
    rebuild(true);
    return { rebuild };
  };

  return { LESSONS, page, overview, board, speak, parser, SHAPES, code, glyph, syllable, cell, consonant, isDone, done };
})();
