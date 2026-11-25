import { I } from '../icons.js';
import { esc, timeAgo, tcase } from '../util.js';
import { CONFIG } from '../config.js';
import { state, tetapanKetua, tetapKunciKetua } from '../store.js';
import { header, initials, busy, toast, openSheet } from '../ui.js';
import { installCard } from '../install.js';
import { kunciBaharu, pautanKetua } from '../ketua.js';

const ROLE = { 'ADMIN': 'Admin', 'FOCAL PERSON': 'Focal person', 'KETUA': 'Ketua (lihat sahaja)', 'LIHAT': 'Lihat sahaja' };

// Kawalan pautan lihat sahaja (untuk ketua dan anggota ronda), untuk admin sahaja (TETAPAN dikunci kepada pemilik Sheet).
function kadKetua() {
  const k = tetapanKetua();
  let isi;
  if (!k.ada || !k.skrip) isi = '<p class="sub2">Skrip pautan belum dipasang dalam TETAPAN.</p>';
  else if (!k.kunci) {
    isi = `<p class="sub2">Pautan dimatikan. Hidupkan supaya anggota dan ketua boleh melihat app tanpa log masuk.</p>
      <div class="row-btns"><button type="button" class="btn primary sm" data-k="baharu">${I.plus}Hidupkan pautan</button></div>`;
  } else {
    isi = `<p class="sub2">Sesiapa yang ada pautan ini boleh melihat sahaja, tanpa log masuk. Alamat, telefon, nama pengurus, no. resit dan gambar tidak dipaparkan.</p>
      <div class="row-btns">
        <button type="button" class="btn primary sm" data-k="kongsi">${I.share}Kongsi pautan</button>
        <button type="button" class="btn ghost sm" data-k="salin">${I.copy}Salin</button>
      </div>
      <div class="row-btns">
        <button type="button" class="btn ghost sm" data-k="tukar">${I.refresh}Tukar pautan</button>
        <button type="button" class="btn ghost sm danger" data-k="mati">${I.x}Matikan</button>
      </div>`;
  }
  return `<section class="card" id="kad-ketua"><h2 class="h2">Pautan lihat sahaja</h2>${isi}</section>`;
}

function sahkan(tajuk, teks, butang) {
  return new Promise((resolve) => {
    let ok = false;
    const close = openSheet(`<h2 class="h2">${tajuk}</h2><p class="sub">${teks}</p>
      <button type="button" class="btn primary big" id="s-ok">${butang}</button>
      <button type="button" class="btn ghost wide" data-close>Batal</button>`, (sheet) => {
      sheet.querySelector('#s-ok').addEventListener('click', () => { ok = true; close(); });
    }, () => resolve(ok));
  });
}

async function salin(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    toast('Pautan disalin.', 'ok');
  } catch { window.prompt('Salin pautan ini:', teks); }
}

async function urusKetua(b, ctx) {
  const k = tetapanKetua();
  const act = b.dataset.k;
  const link = pautanKetua(k);
  if (act === 'salin') return salin(link);
  if (act === 'kongsi') {
    if (navigator.share) {
      try { await navigator.share({ title: 'APP Monitoring Permit', text: 'APP Monitoring Permit (lihat sahaja, tanpa log masuk):', url: link }); } catch {}
      return undefined;
    }
    return salin(link);
  }
  if (act === 'tukar' && !(await sahkan('Tukar pautan?', 'Pautan lama terus berhenti berfungsi. Hantar pautan baharu kepada semua yang menggunakannya.', 'Tukar pautan'))) return undefined;
  if (act === 'mati' && !(await sahkan('Matikan pautan?', 'Sesiapa yang guna pautan ini tidak lagi dapat melihat data.', 'Matikan'))) return undefined;
  busy(b, true, 'Menyimpan…');
  try {
    await ctx.withAuth(() => tetapKunciKetua(act === 'mati' ? '' : kunciBaharu()));
    toast(act === 'mati' ? 'Pautan dimatikan.' : 'Pautan sedia untuk dikongsi.', 'ok');
    ctx.rerender();
  } catch (err) { busy(b, false); ctx.fail(err); }
  return undefined;
}

export default {
  nav: 'utama',
  render() {
    const u = state.user || {};
    return `<div class="page">
      ${header('Profil', { back: '#/utama' })}
      <section class="card prof">
        ${state.ketua ? `<img class="who-logo" src="icons/icon-192.png" alt="" width="56" height="56">
        <div><div class="b">APP Monitoring Permit</div><div class="sub">Tanpa log masuk</div>
        <span class="pill cyan">Lihat sahaja</span></div>`
    : `<span class="avatar lg">${esc(initials(u.name, u.email))}</span>
        <div><div class="b">${esc(u.name || u.email || '-')}</div><div class="sub">${esc(u.email || '')}</div>
        <span class="pill cyan">${esc(ROLE[state.role] || tcase(state.role))}</span></div>`}
      </section>
      <section class="card">
        ${state.ketua ? '' : `<div class="drow"><span class="dl">Google Sheet</span><span class="dv">${esc(state.sheetTitle || '-')}</span></div>`}
        <div class="drow"><span class="dl">Data dikemas kini</span><span class="dv">${state.loadedAt ? esc(timeAgo(state.loadedAt)) : '-'}${state.offline ? ' · luar talian' : ''}</span></div>
        <div class="drow"><span class="dl">Rekod</span><span class="dv">${state.records.length}</span></div>
        <div class="row-btns">
          <button type="button" class="btn ghost sm" id="reload">${I.refresh}Muat semula</button>
          ${state.demo || state.ketua ? '' : `<a class="btn ghost sm" href="https://docs.google.com/spreadsheets/d/${esc(state.sheetId)}/edit" target="_blank" rel="noopener">${I.sheet}Buka Sheet</a>`}
        </div>
      </section>
      ${state.role === 'ADMIN' ? kadKetua() : ''}
      ${installCard()}
      <section class="card">
        <div class="row-btns">
          ${state.ketua ? `<button type="button" class="btn ghost sm" id="keluar-ketua">${I.logout}Log masuk admin / focal person</button>`
    : `<button type="button" class="btn ghost sm" id="switch">${I.sheet}Tukar Google Sheet</button>
          <button type="button" class="btn ghost sm danger" id="logout">${I.logout}Log keluar</button>`}
        </div>
      </section>
      <div class="sub center">APP Monitoring Permit versi ${esc(CONFIG.version)}${state.demo ? ' · mod demo' : ''}</div>
    </div>`;
  },
  bind(el, ctx) {
    el.querySelector('#reload').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      busy(b, true, 'Memuat…');
      try { await ctx.withAuth(() => ctx.reload()); ctx.rerender(); } catch (err) { busy(b, false); ctx.fail(err); }
    });
    if (state.ketua) {
      el.querySelector('#keluar-ketua').addEventListener('click', () => ctx.keluarKetua());
      return;
    }
    el.querySelector('#logout').addEventListener('click', () => ctx.logout());
    el.querySelector('#switch').addEventListener('click', () => ctx.switchSheet());
    const kad = el.querySelector('#kad-ketua');
    if (kad) kad.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) urusKetua(b, ctx); });
  },
};
