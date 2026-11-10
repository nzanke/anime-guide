(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const ACCENT = {'テレビ朝日':'--a-ex','日本テレビ':'--a-nt','TBS':'--a-tb','フジテレビ':'--a-cx','テレビ東京':'--a-tx','NHK':'--a-nh'};
  const KIND_NOTE = {'ゴールデン':'19時以降の枠（1994年までは深夜も）', '朝・昼':'朝〜昼（15時より前）の枠', '夕方':'夕方（15時〜19時前）の枠'};
  let D, cur, hidden = new Set();
  let density = 'compact';
  // 再放送（番組名に「（再）」）の表示。標準はオフ
  let showRe = false;
  try { showRe = localStorage.getItem('rerun') === '1'; } catch (e) {}
  const isRe = id => D.programs[id].t.includes('（再）');
  const visible = id => showRe || !isRe(id);
  // スマホでは10年の表を前半（1〜5年目）・後半（6〜10年目）に分けて出す
  const narrow = window.matchMedia('(max-width:720px)');
  let half = 1;
  try { half = Number(localStorage.getItem('half')) || 1; } catch (e) {}
  narrow.addEventListener('change', () => cur && render());
  const view = () => {
    const n = cur.y1 - cur.y0 + 1;
    if (!narrow.matches || n <= 5) return {a: cur.y0, b: cur.y1, split: false};
    return half === 2 ? {a: cur.y0 + 5, b: cur.y1, split: true} : {a: cur.y0, b: cur.y0 + 4, split: true};
  };
  try { density = localStorage.getItem('density') || 'compact'; } catch (e) {}
  const setDensity = d => {
    density = d;
    document.body.classList.remove('d-std', 'd-compact', 'd-fit');
    document.body.classList.add('d-' + d);
    document.querySelectorAll('#density button').forEach(b => b.setAttribute('aria-checked', b.dataset.d === d));
    try { localStorage.setItem('density', d); } catch (e) {}
    fit();
  };
  function fit() {
    const g = $('#grid'); if (!cur) return;
    if (density !== 'fit') { g.style.removeProperty('--colw'); return; }
    const cs = getComputedStyle(document.body);
    const fixed = parseFloat(cs.getPropertyValue('--dayw')) + parseFloat(cs.getPropertyValue('--timew'));
    const v = view(), ncol = (v.b - v.a + 1) * 2;
    const w = Math.max(30, Math.floor(($('#gridWrap').clientWidth - fixed - 2) / ncol));
    g.style.setProperty('--colw', w + 'px');
  }
  window.addEventListener('resize', fit);

  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt = s => { if (!s) return '放送中'; const [y,m,d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; };
  const tableOf = id => D.tables.find(t => t.id === id);

  fetch('data.json?v=' + (document.querySelector('script[src^="app.js"]').src.split('v=')[1] || ''), {cache: 'no-cache'}).then(r => r.json()).then(json => {
    D = json;
    $('#gen').textContent = D.generated;
    const id = location.hash.slice(1);
    cur = tableOf(id) || D.tables[0];
    buildLegend();
    setRe(showRe);
    render();
    setDensity(density);
  });

  function buildNav() {
    const kinds = [...new Set(D.tables.map(t => t.kind))];
    $('#kind').innerHTML = kinds.map(k => `<button role="tab" aria-selected="${k === cur.kind}" data-k="${esc(k)}">${esc(k)}</button>`).join('') + '<a href="late.html">深夜</a>';
    const ts = D.tables.filter(t => t.kind === cur.kind);
    $('#decade').innerHTML = ts.map(t => `<button role="tab" aria-selected="${t === cur}" data-t="${t.id}">${esc(t.label)}</button>`).join('');
    // 年代のタブが画面からはみ出すとき（スマホ）は、選んでいるタブが見える位置まで横に送る
    const sel = $('#decade [aria-selected="true"]'), bar = $('#decade');
    if (sel && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, sel.offsetLeft - bar.offsetLeft - 40);
  }
  const reBtn = $('#rerun');
  const setRe = v => { showRe = v; reBtn.setAttribute('aria-pressed', v); reBtn.querySelector('b').textContent = v ? 'オン' : 'オフ'; try { localStorage.setItem('rerun', v ? '1' : '0'); } catch (e) {} };
  reBtn.addEventListener('click', () => { setRe(!showRe); render(); });
  $('#half').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    half = Number(b.dataset.h); try { localStorage.setItem('half', half); } catch (e) {} render();
  });
  $('#density').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) setDensity(b.dataset.d);
  });
  $('#kind').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k; if (k === cur.kind) return;
    const same = D.tables.filter(t => t.kind === k);
    cur = same.find(t => t.label === cur.label) || same[same.length - 1];
    render();
  });
  $('#decade').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    cur = tableOf(b.dataset.t); render();
  });

  function buildLegend() {
    $('#legend').innerHTML = D.stations.map(s =>
      `<button aria-pressed="true" data-s="${esc(s)}"><i style="background:var(${ACCENT[s]})"></i>${esc(s)}</button>`).join('');
  }
  $('#legend').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const s = b.dataset.s;
    const only = hidden.size === 0;       // 最初の1回は「その局だけ」を表示
    if (only) { D.stations.forEach(x => x !== s && hidden.add(x)); }
    else if (hidden.has(s)) hidden.delete(s); else hidden.add(s);
    if (hidden.size === D.stations.length) hidden.clear();
    [...$('#legend').children].forEach(x => x.setAttribute('aria-pressed', !hidden.has(x.dataset.s)));
    applyFilter();
  });
  function applyFilter() {
    document.querySelectorAll('.prog').forEach(el => {
      el.style.opacity = hidden.has(D.programs[el.dataset.p].st) ? '.15' : '';
    });
  }

  function render() {
    history.replaceState(null, '', '#' + cur.id);
    buildNav();
    const v = view(), years = v.b - v.a + 1, ncol = years * 2;
    const cs = (v.a - cur.y0) * 2, ce = cs + ncol;   // 見せる列（表全体の何列目から何列目まで）
    $('#half').hidden = !v.split;
    if (v.split) {
      const dec = String(cur.y0).slice(2);
      $('#half').innerHTML = [1, 2].map(h => `<button role="radio" data-h="${h}" aria-checked="${h === half}">${dec}年代${h === 1 ? '前半' : '後半'}<small>${h === 1 ? cur.y0 : cur.y0 + 5}–${h === 1 ? String(cur.y0 + 4).slice(2) : String(cur.y1).slice(2)}</small></button>`).join('');
    }
    const placed = cur.rows.reduce((n, r) => n + r.cells.filter(c => c.p).length, 0);
    const uniq = new Set(cur.rows.flatMap(r => r.cells.filter(c => c.p).map(c => c.p))).size;
    $('#summary').innerHTML = `<h2>${esc(cur.kind)}　${esc(cur.label)}</h2><span class="range">${v.a}.4 – ${v.b + 1}.3</span><span class="count">${esc(KIND_NOTE[cur.kind] || '')}・表に入った番組 ${uniq} 本</span>`;
    const g = $('#grid');
    g.style.gridTemplateColumns = `var(--dayw) var(--timew) repeat(${ncol}, var(--colw))`;
    const H = [];
    H.push(`<div class="corner" style="grid-row:1;grid-column:1/3"></div><div class="corner2" style="grid-row:2;grid-column:1/3"></div>`);
    for (let y = 0; y < years; y++) {
      H.push(`<div class="h h-year" style="grid-row:1;grid-column:${3 + y * 2}/span 2">${v.a + y}</div>`);
      H.push(`<div class="h-half y" style="grid-row:2;grid-column:${3 + y * 2}">春</div><div class="h-half" style="grid-row:2;grid-column:${4 + y * 2}">秋</div>`);
    }
    // 曜日・時間帯のまとまり
    // 見せている期間に番組が1本もない行は出さない（スマホの前半・後半など）
    const has = r => { let at = 0; return r.cells.some(c => { const hit = c.p && visible(c.p) && Math.max(at, cs) < Math.min(at + c.n, ce); at += c.n; return hit; }); };
    const rows = cur.rows.filter(has).map((r, i, a) => ({...r, first: i === 0 || a[i - 1].day !== r.day || a[i - 1].time !== r.time}));
    let r0 = 3;
    for (let i = 0; i < rows.length;) {
      let j = i; while (j < rows.length && rows[j].day === rows[i].day) j++;
      const day = rows[i].day;
      H.push(`<div class="day${day === '帯' ? ' obi' : ''}" style="grid-row:${r0 + i}/${r0 + j};grid-column:1">${esc(day)}</div>`);
      for (let k = i; k < j;) {
        let m = k + 1; while (m < j && !rows[m].first) m++;
        H.push(`<div class="time" style="grid-row:${r0 + k}/${r0 + m};grid-column:2">${esc(rows[k].time)}</div>`);
        for (let q = k; q < m; q++) {
          let at = 0;   // 表全体での列の位置。見せる範囲にかかる部分だけを切り出して置く
          rows[q].cells.forEach(c => {
            const a = Math.max(at, cs), b = Math.min(at + c.n, ce);
            if (a < b) {
              const cls = ['slot']; if (a % 2 === 0) cls.push('y'); if (q === m - 1) cls.push('last'); if (b - a === 1) cls.push('one');   // 1マスだけの番組（スマホでは字を半分に）
              const inner = c.p && visible(c.p) ? progBtn(c.p) : '<span class="empty" aria-hidden="true"></span>';
              H.push(`<div class="${cls.join(' ')}" style="grid-row:${r0 + q};grid-column:${3 + a - cs}/span ${b - a}">${inner}</div>`);
            }
            at += c.n;
          });
        }
        k = m;
      }
      i = j;
    }
    g.innerHTML = H.join('');
    fit();
    fitOne();
    $('#gridWrap').scrollTo(0, 0);
    // 入らなかった番組
    $('#outCount').textContent = `（${cur.out.length}本）`;
    $('#outItems').innerHTML = cur.out.map(id => {
      const p = D.programs[id];
      return `<li><button data-p="${id}"><span class="tag" style="background:var(${ACCENT[p.st]})">${esc(p.st)}</span>${esc(p.t)}</button><br><small>${esc(p.d)} ${esc(p.slot)}・${fmt(p.s)}〜${fmt(p.e)}</small></li>`;
    }).join('');
    applyFilter();
  }
  // スマホの1マスだけの番組名：省略（…）が出なければ8px、出るなら6px、それでも出るなら4px
  function fitOne() {
    if (!narrow.matches) return;
    // 使える高さは行の高さ（--rowh）から決める（マスの高さは中身で変わるため）
    const rowh = parseFloat(getComputedStyle(document.body).getPropertyValue('--rowh')) || 30;
    document.querySelectorAll('.slot.one .prog').forEach(b => {
      const sp = b.querySelector('span');
      // まず語の途中で折らずに（切れ目だけで）収まる大きさを 8→6→4px の順に探し、
      // どれでも収まらなければ、語の途中で折ってよいとして省略の出ない大きさを探す
      const tryFit = (fs, strict) => {
        b.style.fontSize = fs + 'px';
        sp.style.overflowWrap = strict ? 'normal' : '';
        sp.style.webkitLineClamp = Math.max(1, Math.floor((rowh - 6) / (fs * 1.2)));
        return sp.scrollHeight <= sp.clientHeight + 1 && sp.scrollWidth <= sp.clientWidth + 1;
      };
      if ([8, 6, 4].some(fs => tryFit(fs, true))) return;
      if ([8, 6, 4].some(fs => tryFit(fs, false))) return;
    });
  }
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => cur && fitOne());
  // 番組名の改行位置：漢字・ひらがな・カタカナ・英数字の切れ目にだけ改行の候補（<wbr>）を入れる。
  // 英数字→カタカナ（「Vガンダム」など）は切らない。記号（！・）など）は前の字に付け、その後ろで切れるようにする。入りきらないときだけ語の途中で折る（CSS の overflow-wrap）
  const kind = ch => /[\u4E00-\u9FFF\u3400-\u4DBF々〆〇ヵヶ]/.test(ch) ? 'k' : /[\u3041-\u309F]/.test(ch) ? 'h' : /[\u30A1-\u30FA\u30FC\u30FD\u30FE\uFF66-\uFF9F]/.test(ch) ? 'c' : /[A-Za-z0-9\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A'.&∀]/.test(ch) ? 'a' : /\s/.test(ch) ? 's' : 'p';
  const wb = t => {
    const ch = [...String(t)]; let out = '', prev = null;
    ch.forEach((c, i) => {
      const k = kind(c);
      const open = /[（(「『〈《【［\[]/.test(c);
      if (prev && ((k !== prev && k !== 'p' && prev !== 's' && !(prev === 'a' && k === 'c')) || (prev === 'p' && !/[（(「『〈《【［\[]/.test(ch[i - 1]) && k !== 'p') || open) && i > 0) out += '<wbr>';
      out += esc(c); prev = k;
    });
    return out;
  };
  function progBtn(id) {
    const p = D.programs[id];
    return `<button class="prog st-${esc(p.st)}" data-p="${id}" title="${esc(p.t)}（${esc(p.st)}）"><span>${wb(p.t)}</span><small>${esc(p.st)}</small></button>`;
  }

  // 詳細
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (b && !b.closest('.results')) openSheet(b.dataset.p);
    if (e.target.closest('[data-close]')) closeSheet();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); hideResults(); } });
  function openSheet(id) {
    const p = D.programs[id];
    const st = $('#sheetStation'); st.textContent = p.st; st.style.background = `var(${ACCENT[p.st]})`;
    $('#sheetTitle').textContent = p.t;
    const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
    const wiki = 'https://ja.wikipedia.org/wiki/' + encodeURIComponent(p.src.replace(/ /g, '_'));
    $('#sheetBody').innerHTML =
      row('放送期間', `${fmt(p.s)} 〜 ${fmt(p.e)}`) +
      row('枠', `${esc(p.d)}曜 ${esc(p.slot)}`.replace('帯曜', '帯')) +
      row('実際の時刻', esc(p.act)) +
      row('備考', esc(p.note)) +
      row('出典', `<a href="${wiki}" target="_blank" rel="noopener">${esc(p.src)}</a>（ウィキペディア）`);
    $('#sheet').hidden = false;
    $('.sheet-close').focus();
  }
  function closeSheet() { $('#sheet').hidden = true; }

  // 検索
  const q = $('#q'), res = $('#results');
  q.addEventListener('input', () => {
    const v = q.value.trim().toLowerCase();
    if (!v) return hideResults();
    const hits = [];
    for (const t of D.tables) {
      const ids = new Set([...t.rows.flatMap(r => r.cells.filter(c => c.p).map(c => c.p)), ...t.out]);
      ids.forEach(id => { const p = D.programs[id]; if (p.t.toLowerCase().includes(v)) hits.push([t, id, p]); });
    }
    hits.sort((a, b) => a[2].s.localeCompare(b[2].s));
    res.innerHTML = hits.length ? hits.slice(0, 60).map(([t, id, p]) =>
      `<button data-t="${t.id}" data-id="${id}"><span class="tag" style="background:var(${ACCENT[p.st]})">${esc(p.st)}</span>${esc(p.t)}<span class="meta">${p.s.slice(0, 4)}・${esc(t.kind)} ${esc(p.d)} ${esc(p.slot)}</span></button>`).join('')
      : '<div class="none">見つかりませんでした</div>';
    res.hidden = false;
  });
  q.addEventListener('focus', () => q.value && (res.hidden = false));
  document.addEventListener('click', e => { if (!e.target.closest('.results,.search')) hideResults(); });
  function hideResults() { res.hidden = true; }
  res.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    hideResults();
    const t = tableOf(b.dataset.t), id = b.dataset.id;
    if (!visible(id)) { setRe(true); if (t === cur) render(); }
    if (t !== cur) { cur = t; render(); }
    hidden.clear(); [...$('#legend').children].forEach(x => x.setAttribute('aria-pressed', 'true')); applyFilter();
    const el = document.querySelector(`.prog[data-p="${id}"]`);
    if (el) {
      el.scrollIntoView({block: 'center', inline: 'center', behavior: 'smooth'});
      el.classList.remove('hl'); void el.offsetWidth; el.classList.add('hl');
    } else openSheet(id);
  });
})();
