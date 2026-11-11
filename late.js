(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const ACCENT = {'テレビ朝日':'--a-ex','日本テレビ':'--a-nt','TBS':'--a-tb','フジテレビ':'--a-cx','テレビ東京':'--a-tx','TOKYO MX':'--a-mx','テレビ神奈川':'--a-tk'};
  const CLS = s => s === 'TOKYO MX' ? 'MX' : s;
  const SEASON = ['冬', '春', '夏', '秋'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt = s => { if (!s) return '放送中'; const [y,m,d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; };
  let D, cur, density = 'compact';
  try { density = localStorage.getItem('ldensity') || 'compact'; } catch (e) {}
  const setDensity = d => {
    density = d;
    document.body.classList.remove('d-std', 'd-compact');
    document.body.classList.add('d-' + d);
    document.querySelectorAll('#density button').forEach(b => b.setAttribute('aria-checked', b.dataset.d === d));
    try { localStorage.setItem('ldensity', d); } catch (e) {}
  };
  $('#density').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setDensity(b.dataset.d); });
  const v = (document.querySelector('script[src^="late.js"]').src.split('v=')[1] || '');
  fetch('late.json?v=' + v, {cache: 'no-cache'}).then(r => r.json()).then(j => {
    D = j; $('#gen').textContent = D.generated;
    cur = D.charts.find(c => c.id === location.hash.slice(1)) || D.charts.find(c => c.id === 'key-2005') || D.charts[0];
    setDensity(density); render();
  });
  function nav() {
    $('#group').innerHTML = D.groups.map(([k, n]) => `<button role="tab" aria-selected="${k === cur.group}" data-g="${k}">${esc(n)}</button>`).join('');
    const ps = D.charts.filter(c => c.group === cur.group);
    $('#period').innerHTML = ps.map(c => `<button role="tab" aria-selected="${c === cur}" data-c="${c.id}">${c.y1 - c.y0 < 4 ? c.y0 + "年〜" : c.y0 + "〜" + String(c.y1).slice(2) + "年"}</button>`).join('');
    const sel = $('#period [aria-selected="true"]'), bar = $('#period');
    if (sel && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, sel.offsetLeft - bar.offsetLeft - 40);
  }
  $('#group').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    cur = D.charts.find(c => c.group === b.dataset.g && c.y0 === cur.y0) || D.charts.find(c => c.group === b.dataset.g); render();
  });
  $('#period').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cur = D.charts.find(c => c.id === b.dataset.c); render(); });
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
  function render() {
    history.replaceState(null, '', '#' + cur.id);
    nav();
    // 曜日で分けず、1つの表に曜日の順（月〜日）で列を並べる（列は late.json で曜日順に並んでいる）
    $('#summary').innerHTML = `<h2>${esc(cur.gname)}の深夜アニメ放送枠</h2><span class="range">${cur.y0} – ${cur.y1}</span><span class="count">21時〜翌5時・番組 ${cur.count} 本</span>`;
    const g = $('#grid'), nq = (cur.y1 - cur.y0 + 1) * 4;
    const cols = cur.cols, ncol = cols.length, R0 = 3;
    g.style.gridTemplateColumns = `var(--dayw) var(--lqw) repeat(${Math.max(ncol, 1)}, var(--lcolw))`;
    g.style.gridTemplateRows = `auto auto repeat(${nq}, minmax(var(--lrowh), auto))`;
    const H = [`<div class="lc lday" style="grid-row:1;grid-column:1/3"></div><div class="lc lhead" style="grid-row:2;grid-column:1/3"></div>`];
    for (let y = 0; y <= cur.y1 - cur.y0; y++) {
      H.push(`<div class="ly" style="grid-row:${R0 + y * 4}/span 4">${cur.y0 + y}</div>`);
      SEASON.forEach((s, i) => H.push(`<div class="lq" style="grid-row:${R0 + y * 4 + i}">${s}</div>`));
    }
    if (!ncol) H.push(`<div class="mark" style="grid-row:${R0}/span ${nq};grid-column:3;padding:20px 30px">この期間の番組はありません</div>`);
    // 曜日の帯
    for (let i = 0; i < ncol;) {
      let j = i; while (j < ncol && cols[j].day === cols[i].day) j++;
      H.push(`<div class="lday" style="grid-row:1;grid-column:${3 + i}/span ${j - i}">${cols[i].day}曜深夜</div>`);
      i = j;
    }
    cols.forEach(({cells}, ci) => {
      const col = 3 + ci, used = new Set();
      let headDone = false;
      cells.forEach(c => {
        const row = c.r < 0 ? 2 : R0 + c.r;
        if (c.r < 0) headDone = true;
        for (let k = 0; k < c.n; k++) used.add(row + k);
        if (c.k === 'label') {
          const cls = c.r < 0 ? 'lc lhead lab' : 'lc lab';
          H.push(`<div class="${cls}" style="grid-row:${row};grid-column:${col}"><span>${esc(c.t)}<i style="background:var(${ACCENT[c.st]})"></i></span></div>`);
        } else if (c.k === 'p') {
          const p = D.programs[c.p];
          H.push(`<div class="lc" style="grid-row:${row}/span ${c.n};grid-column:${col}"><button class="prog st-${CLS(p.st)}" data-p="${c.p}" title="${esc(p.t)}（${esc(p.st)}）"><span style="-webkit-line-clamp:${c.n > 1 ? c.n * 2 + 1 : 2}">${wb(p.t)}</span><small>（${esc(p.d)}${p.slot ? esc(p.slot) : '深夜'}）</small></button></div>`);
        } else {
          H.push(`<div class="lc mark${c.k === 'gap' ? ' gap' : ''}" style="grid-row:${row}/span ${c.n};grid-column:${col}">${esc(c.t)}</div>`);
        }
      });
      if (!headDone) H.push(`<div class="lc lhead" style="grid-row:2;grid-column:${col}"></div>`);
      for (let r = R0; r < R0 + nq; r++) if (!used.has(r)) H.push(`<div class="lc" style="grid-row:${r};grid-column:${col}"></div>`);
    });
    g.innerHTML = H.join('');
    // 番組の中で放送された短いアニメ（表には入れない）
    const inn = cur.inner || [];
    // 開閉式（ふだんは閉じておく）
    $('#inner').innerHTML = inn.length ? `<details><summary>表に入っていない番組（${inn.length}本：短編アニメ・番組内アニメ・放送期間の短い番組）</summary><ul>` +
      inn.map(p => `<li><b>${esc(p.t)}</b>　${esc(p.st)}（${esc(p.d)}${esc(p.slot || '深夜')}）${fmt(p.s)}〜${p.e ? fmt(p.e) : ''}　${p.why === '番組内' ? `『${esc(p.host)}』内` : p.why === '短編' ? `短編・${esc(p.min)}分` : '放送期間が短い'}</li>`).join('') + '</ul></details>' : '';
    $('#gridWrap').scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (b) open(b.dataset.p);
    if (e.target.closest('[data-close]')) $('#sheet').hidden = true;
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#sheet').hidden = true; });
  function open(id) {
    const p = D.programs[id];
    const st = $('#sheetStation'); st.textContent = p.st; st.style.background = `var(${ACCENT[p.st]})`;
    $('#sheetTitle').textContent = p.t;
    const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
    const wiki = 'https://ja.wikipedia.org/wiki/' + encodeURIComponent(p.src.replace(/ /g, '_'));
    $('#sheetBody').innerHTML = row('放送期間', `${fmt(p.s)} 〜 ${fmt(p.e)}`) + row('時刻', esc(p.act)) + row('備考', esc(p.note)) +
      row('出典', `<a href="${wiki}" target="_blank" rel="noopener">${esc(p.src)}</a>（ウィキペディア）`);
    $('#sheet').hidden = false; $('.sheet-close').focus();
  }
})();
