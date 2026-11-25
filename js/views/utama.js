import { I } from '../icons.js';
import { esc, fmtRM, fmtLong, fmtShort, today, greet, scase, tcase, timeAgo, dayName } from '../util.js';
import { state, counts, perhatian, hasil, suratDue, suratTamat, suratUpcoming, canEdit } from '../store.js';
import { initials } from '../ui.js';
import { isStandalone, isIOS, isAndroid } from '../install.js';

function donut(c) {
  const total = c.SAH + c['AKAN TAMAT'] + c.TAMAT;
  const C = 2 * Math.PI * 40;
  let off = 0;
  const seg = (n, color) => {
    if (!n) return '';
    const len = Math.max(C * (n / total) - 4, 2);
    const s = `<circle cx="52" cy="52" r="40" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 52 52)"/>`;
    off += C * (n / total);
    return s;
  };
  return `<svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label="Permit dipantau: ${c.SAH} sah, ${c['AKAN TAMAT']} akan tamat, ${c.TAMAT} tamat">
    <circle cx="52" cy="52" r="40" fill="none" stroke="#1d2a44" stroke-width="10"/>
    ${total ? seg(c.SAH, '#34d399') + seg(c['AKAN TAMAT'], '#fbbf24') + seg(c.TAMAT, '#fb7185') : ''}
    <text x="52" y="51" text-anchor="middle" fill="#e8eeff" font-family="Space Grotesk, sans-serif" font-size="23" font-weight="700">${total}</text>
    <text x="52" y="68" text-anchor="middle" fill="#8b97b5" font-family="Inter, sans-serif" font-size="11">dipantau</text>
  </svg>`;
}

function installBanner() {
  let x = false;
  try { x = !!localStorage.getItem('amp-install-x'); } catch {}
  if (x || isStandalone() || !(window.__ampInstall || isIOS || isAndroid)) return '';
  const action = window.__ampInstall
    ? '<button type="button" class="btn primary sm" data-install>Pasang</button>'
    : '<a class="btn primary sm" href="#/profil">Cara pasang</a>';
  return `<div class="install-b">${I.install}<div class="grow">Pasang app di skrin utama telefon.</div>
    ${action}
    <button type="button" class="icon-x" data-install-x aria-label="Tutup cadangan pasang">${I.x}</button></div>`;
}

function perhatianRow(r) {
  const akan = r.status === 'AKAN TAMAT';
  const sub = [scase(r.jenis), r.kawasan ? tcase(r.kawasan) : '', akan ? `tamat ${fmtShort(r.tamat)}` : `${Math.abs(r.baki)} hari lalu`]
    .filter(Boolean).join(' · ');
  return `<a class="att-row" href="#/permit/${encodeURIComponent(r.id)}">
    <div class="att-main"><div class="att-name">${esc(r.nama)}</div><div class="sub">${esc(sub)}</div></div>
    <span class="pill ${akan ? 'warn' : 'bad'}">${akan ? `${r.baki} hari` : 'Tamat'}</span>
  </a>`;
}

export default {
  nav: 'utama',
  render() {
    const u = state.user || {};
    const first = String(u.name || u.email || '').split(/[\s@]/)[0];
    const y = today().getUTCFullYear();
    const h = hasil(y);
    const c = counts();
    const list = perhatian();
    const jenisAktif = new Set([...h.byJenis.keys()]).size;
    const due = suratDue().length + suratTamat().length;
    const up = suratUpcoming();
    let banner = '';
    if (up.length && !state.ketua) {
      const d0 = up[0].tarikhSurat;
      const group = up.filter((x) => +x.tarikhSurat === +d0);
      const tamat = group[0].r.tamat;
      banner = `<a class="info-banner" href="#/surat?tab=akan">${I.cal}<div>${group.length} permit tahunan tamat ${esc(fmtLong(tamat))}. Surat peringatan dijana ${esc(fmtShort(d0))}.</div></a>`;
    }
    const edit = canEdit();
    return `<div class="page">
      ${state.offline ? `<div class="offline">Luar talian. Data dikemas kini ${esc(timeAgo(state.loadedAt))}.</div>` : ''}
      <div class="top">
        <a class="who" href="#/profil" aria-label="Profil dan tetapan">
          <span class="avatar">${esc(initials(u.name, u.email))}</span>
          <span><span class="sub">${esc(`${dayName(today())}, ${fmtLong(today())}`)}</span>
          <span class="hello">${esc(greet())}${first ? `, ${esc(first)}` : ''}</span></span>
        </a>
        ${state.ketua ? '' : `<a class="icon-btn" href="#/surat" aria-label="Surat perlu dijana: ${due}">${I.bell}${due ? '<span class="dot"></span>' : ''}</a>`}
      </div>

      ${installBanner()}
      <a class="hero" href="#/hasil">
        <div class="hero-l">
          <div class="sub">Kutipan hasil ${y}</div>
          <div class="hero-amt">${esc(fmtRM(h.total))}</div>
          <span class="chip-c">${state.records.length} rekod · ${jenisAktif} jenis permit</span>
        </div>
        ${donut(c)}
      </a>

      <div class="tiles3">
        <a class="tile" href="#/cari?status=SAH"><div class="tile-l"><span class="led ok"></span>Sah</div><div class="tile-n">${c.SAH}</div></a>
        <a class="tile warn" href="#/cari?status=AKAN%20TAMAT"><div class="tile-l"><span class="led warn"></span>Akan tamat</div><div class="tile-n">${c['AKAN TAMAT']}</div></a>
        <a class="tile" href="#/cari?status=TAMAT"><div class="tile-l"><span class="led bad"></span>Tamat</div><div class="tile-n">${c.TAMAT}</div></a>
      </div>

      <div class="quick">
        <a href="#/cari"><span class="q-ic">${I.search}</span>Cari</a>
        ${edit ? `<a href="#/tambah"><span class="q-ic">${I.plus}</span>Tambah</a>
        <a href="#/ulang"><span class="q-ic v">${I.copy}</span>Ulang</a>` : `<a href="#/hasil"><span class="q-ic">${I.chart}</span>Hasil</a>`}
        ${state.ketua ? `<a href="#/cari?status=perhatian"><span class="q-ic v">${I.alert}</span>Perhatian</a>
        <a href="#/profil"><span class="q-ic v">${I.user}</span>Profil</a>`
    : `<a href="#/surat" class="q-badge-wrap"><span class="q-ic v">${I.mail}</span>Surat${due ? `<span class="q-badge">${due}</span>` : ''}</a>`}
      </div>

      <section class="card">
        <div class="card-h"><h2 class="h2">Perlu perhatian</h2>${list.length ? `<a href="#/cari?status=perhatian" class="small">Lihat semua (${list.length})</a>` : ''}</div>
        ${list.length ? `<div class="att">${list.slice(0, 4).map(perhatianRow).join('<div class="sep"></div>')}</div>` : '<div class="sub">Tiada permit yang perlu perhatian. Semua masih sah.</div>'}
      </section>
      ${banner}
    </div>`;
  },
};
