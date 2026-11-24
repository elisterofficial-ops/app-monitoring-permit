import { I } from '../icons.js';
import { esc, norm, debounce } from '../util.js';
import { state, frequent, shortName } from '../store.js';
import { recordCard, empty } from '../ui.js';

const FILTERS = [
  ['semua', 'Semua', ''],
  ['perhatian', 'Perhatian', ''],
  ['SAH', 'Sah', 'ok'],
  ['AKAN TAMAT', 'Akan tamat', 'warn'],
  ['TAMAT', 'Tamat', 'bad'],
  ['BERMUSIM', 'Bermusim', ''],
  ['REKOD', 'Rekod', ''],
];

function match(r, f) {
  if (f === 'semua') return true;
  if (f === 'perhatian') return r.status === 'AKAN TAMAT' || r.status === 'TAMAT';
  if (f === 'BERMUSIM') return r.tempoh === 'BERMUSIM';
  return r.status === f;
}

function search(q, f) {
  const n = norm(q);
  let rows = state.records.filter((r) => match(r, f));
  if (n) {
    rows = rows.filter((r) => norm([r.nama, r.noPermit, r.id, r.idLama, r.kawasan, r.pengurus, r.jenis].join('|')).includes(n));
  }
  return rows.sort((a, b) => (b.mula || 0) - (a.mula || 0));
}

export default {
  nav: 'cari',
  render(ctx) {
    const q = ctx.q.get('q') || '';
    const f = ctx.q.get('status') || 'semua';
    return `<div class="page">
      <div class="pt"><h1 class="h1">Cari permit</h1><div class="sub">Nama premis, no. permit, ID rekod atau kawasan</div></div>
      <div class="search">
        <label class="sr" for="q">Cari permit</label>
        ${I.search}
        <input id="q" type="search" value="${esc(q)}" placeholder="Contoh: Eco Shop" autocomplete="off" enterkeyhint="search">
        <button type="button" class="clear" aria-label="Kosongkan carian" ${q ? '' : 'hidden'}>${I.x}</button>
      </div>
      <div class="chips" role="group" aria-label="Tapis status">
        ${FILTERS.map(([k, l, led]) => `<button type="button" class="chip${k === f ? ' on' : ''}" data-f="${esc(k)}" aria-pressed="${k === f}">${led ? `<span class="led ${led}"></span>` : ''}${l}</button>`).join('')}
      </div>
      <div id="results"></div>
    </div>`;
  },
  bind(el, ctx) {
    let q = ctx.q.get('q') || '';
    let f = ctx.q.get('status') || 'semua';
    let limit = 40;
    const input = el.querySelector('#q');
    const clear = el.querySelector('.clear');
    const out = el.querySelector('#results');

    const sync = () => {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (f !== 'semua') p.set('status', f);
      const s = p.toString();
      history.replaceState(null, '', `#/cari${s ? `?${s}` : ''}`);
    };

    const draw = () => {
      const rows = search(q, f);
      let html = `<div class="count">${rows.length} rekod ditemui</div>`;
      html += rows.length
        ? `<div class="list">${rows.slice(0, limit).map((r) => recordCard(r, { renewed: state.renewals.has(r.id) })).join('')}</div>`
        : empty('Tiada rekod ditemui', 'Cuba sebahagian nama sahaja, atau tukar penapis status.');
      if (rows.length > limit) html += `<button type="button" class="btn ghost wide" data-more>Tunjuk lagi (${rows.length - limit})</button>`;
      if (!q && f === 'semua') {
        const fr = frequent(6).filter((x) => x.count > 1);
        if (fr.length) {
          html = `<div class="count">Pemohon kerap</div><div class="chips">${fr.map((x) => `<button type="button" class="chip" data-q="${esc(shortName(x.nama) || x.nama)}">${esc(shortName(x.nama) || x.nama)} <b class="cyan">${x.count}</b></button>`).join('')}</div>` + html;
        }
      }
      out.innerHTML = html;
    };

    input.addEventListener('input', debounce(() => {
      q = input.value.trim();
      clear.hidden = !q;
      limit = 40;
      sync();
      draw();
    }, 120));
    clear.addEventListener('click', () => {
      input.value = '';
      q = '';
      clear.hidden = true;
      sync();
      draw();
      input.focus();
    });
    el.querySelector('.chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      f = b.dataset.f;
      el.querySelectorAll('[data-f]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', x === b);
      });
      limit = 40;
      sync();
      draw();
    });
    out.addEventListener('click', (e) => {
      const m = e.target.closest('[data-more]');
      if (m) { limit += 60; draw(); return; }
      const c = e.target.closest('[data-q]');
      if (c) {
        input.value = c.dataset.q;
        q = c.dataset.q;
        clear.hidden = false;
        sync();
        draw();
      }
    });
    draw();
    if (!q && !ctx.q.get('status')) input.focus({ preventScroll: true });
  },
};
