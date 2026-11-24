import { esc, fmtRM, fmtNum, fmtK, BULAN, BULAN_PENDEK, today, scase, tcase } from '../util.js';
import { years, hasil } from '../store.js';

const PALETTE = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#f472b6', '#a3e635', '#94a3b8'];

const unitName = (u) => tcase(u.replace(/^UNIT\s+/i, ''));
const desc = (a, b) => b[1] - a[1];

// Senarai jenis permit di bawah sesuatu unit.
const jenisRows = (map) => [...map.entries()].filter(([, v]) => v > 0).sort(desc)
  .map(([j, v]) => `<div class="pj"><span>${esc(scase(j))}</span><span class="mono">${esc(fmtRM(v))}</span></div>`).join('');

// Satu bulan: jumlah, kemudian setiap unit dan jenis permitnya.
function bulanRow(h, i, buka) {
  const v = h.months[i];
  if (!v) return `<div class="drow"><span class="dl">${BULAN[i]}</span><span class="dv mono">-</span></div>`;
  const units = [...h.monthUnit[i].entries()].sort((a, b) => b[1].total - a[1].total);
  return `<details class="pb" data-pb="${i}"${buka ? ' open' : ''}>
    <summary><span>${BULAN[i]}</span><span class="mono">${esc(fmtRM(v))}</span></summary>
    ${units.map(([u, x]) => `<div class="pu"><div class="pu-h"><span>${esc(unitName(u))}</span><b class="mono">${esc(fmtRM(x.total))}</b></div>${jenisRows(x.jenis)}</div>`).join('')}
  </details>`;
}

export default {
  nav: 'hasil',
  render(ctx) {
    const ys = years();
    const y = Number(ctx.q.get('tahun')) || ys[0];
    const h = hasil(y);
    const max = Math.max(...h.months, 0);
    const now = today();
    const curMonth = now.getUTCFullYear() === y ? now.getUTCMonth() : -1;
    const top = max ? h.months.indexOf(max) : -1;
    const lastData = h.months.reduce((acc, v, i) => (v ? i : acc), -1);
    const span = lastData + 1;
    const avg = span > 0 ? h.total / span : 0;
    const bars = h.months.map((v, i) => {
      const hgt = max ? Math.max((v / max) * 120, v ? 6 : 3) : 3;
      const cls = v ? (i === top ? 'bar top' : 'bar') : 'bar zero';
      return `<button type="button" class="bcol" data-m="${i}" aria-label="${BULAN[i]}: ${fmtRM(v)}">
        ${i === top ? `<span class="bval">${fmtK(v)}</span>` : ''}
        <span class="${cls}${i === curMonth ? ' now' : ''}" style="height:${hgt.toFixed(0)}px"></span>
      </button>`;
    }).join('');
    const units = [...h.byUnit.entries()].sort(desc);
    const jenis = [...h.byJenis.entries()].filter(([, v]) => v > 0).sort(desc);
    return `<div class="page">
      <div class="top">
        <div><div class="sub">Semua unit Bahagian Penguatkuasa</div><h1 class="h1">Kutipan hasil</h1></div>
        <label class="year"><span class="sr">Tahun</span><select id="tahun">${ys.map((x) => `<option${x === y ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      </div>

      <section class="card neon">
        <div class="sub">Jumlah ${y}</div>
        <div class="hero-amt big">${esc(fmtRM(h.total))}</div>
        <div class="sub" id="mline">${top >= 0 ? `Tertinggi ${BULAN[top]}, ${esc(fmtRM(max))}` : 'Belum ada kutipan direkodkan untuk tahun ini.'}</div>
        <div class="bars" role="group" aria-label="Kutipan bulanan ${y}">${bars}</div>
        <div class="bars-l" aria-hidden="true">${BULAN_PENDEK.map((m, i) => `<span${i === curMonth ? ' class="violet"' : ''}>${m.charAt(0)}</span>`).join('')}</div>
      </section>

      <section class="card">
        <h2 class="h2">Ikut unit</h2>
        <div class="ulist">${units.map(([u, v]) => {
          const bar = `<div class="ubar"><div style="width:${h.total ? ((v / h.total) * 100).toFixed(1) : 0}%"></div></div>`;
          if (!v) return `<div><div class="urow"><span>${esc(unitName(u))}</span><b class="mono muted">${esc(fmtRM(v))}</b></div>${bar}</div>`;
          return `<details class="ud"><summary><div class="urow"><span>${esc(unitName(u))}</span><b class="mono">${esc(fmtRM(v))}</b></div>${bar}</summary>
            <div class="pu">${jenisRows(h.unitJenis.get(u) || new Map())}</div></details>`;
        }).join('')}</div>
      </section>

      <section class="card">
        <h2 class="h2">Ikut jenis permit</h2>
        ${jenis.length ? `<div class="stack" role="img" aria-label="${esc(jenis.map(([j, v]) => `${scase(j)} ${((v / h.total) * 100).toFixed(1)} peratus`).join(', '))}">
          ${jenis.map(([, v], i) => `<div style="width:${((v / h.total) * 100).toFixed(1)}%;background:${PALETTE[i % PALETTE.length]}"></div>`).join('')}
        </div>
        <div class="legend">${jenis.map(([j, v], i) => `<div><div class="lg-l"><span class="sw" style="background:${PALETTE[i % PALETTE.length]}"></span>${esc(scase(j))}</div><div class="mono lg-v">${esc(fmtNum(v))}</div></div>`).join('')}</div>`
        : '<div class="sub">Tiada kutipan.</div>'}
      </section>

      <div class="tiles2">
        <a class="tile2 cyan" href="#/cari"><div class="tile-n">${h.count}</div><div class="sub2">Bayaran diterima ${y}</div></a>
        <div class="tile2 violet"><div class="tile-n">${esc(fmtRM(avg, 0))}</div><div class="sub2">${span > 0 ? `Purata sebulan, ${BULAN_PENDEK[0]} hingga ${BULAN_PENDEK[lastData]}` : 'Purata sebulan'}</div></div>
      </div>

      <section class="card" id="pecahan">
        <div><h2 class="h2">Pecahan setiap bulan</h2><div class="sub">Tekan bulan untuk lihat hasil setiap unit dan jenis permit.</div></div>
        <div>${h.months.map((v, i) => bulanRow(h, i, i === (curMonth >= 0 && h.months[curMonth] ? curMonth : lastData))).join('')}</div>
      </section>
    </div>`;
  },
  bind(el, ctx) {
    el.querySelector('#tahun').addEventListener('change', (e) => ctx.go(`#/hasil?tahun=${e.target.value}`));
    const ys = years();
    const y = Number(ctx.q.get('tahun')) || ys[0];
    const h = hasil(y);
    el.querySelector('.bars').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const i = Number(b.dataset.m);
      el.querySelectorAll('.bcol').forEach((x) => x.classList.toggle('sel', x === b));
      el.querySelector('#mline').textContent = `${BULAN[i]} ${y}: ${fmtRM(h.months[i])}`;
      // Buka pecahan bulan yang ditekan pada carta.
      el.querySelectorAll('[data-pb]').forEach((x) => { x.open = Number(x.dataset.pb) === i; });
    });
  },
};
