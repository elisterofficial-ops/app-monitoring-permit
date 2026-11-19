import { I } from '../icons.js';
import { esc, timeAgo, tcase } from '../util.js';
import { CONFIG } from '../config.js';
import { state } from '../store.js';
import { header, initials, busy } from '../ui.js';

const ROLE = { 'ADMIN': 'Admin', 'FOCAL PERSON': 'Focal person', 'KETUA': 'Ketua jabatan (lihat sahaja)', 'LIHAT': 'Lihat sahaja' };

export default {
  nav: 'utama',
  render() {
    const u = state.user || {};
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const canInstall = !!window.__ampInstall;
    return `<div class="page">
      ${header('Profil', { back: '#/utama' })}
      <section class="card prof">
        <span class="avatar lg">${esc(initials(u.name, u.email))}</span>
        <div><div class="b">${esc(u.name || u.email || '-')}</div><div class="sub">${esc(u.email || '')}</div>
        <span class="pill cyan">${esc(ROLE[state.role] || tcase(state.role))}</span></div>
      </section>
      <section class="card">
        <div class="drow"><span class="dl">Google Sheet</span><span class="dv">${esc(state.sheetTitle || '-')}</span></div>
        <div class="drow"><span class="dl">Data dikemas kini</span><span class="dv">${state.loadedAt ? esc(timeAgo(state.loadedAt)) : '-'}${state.offline ? ' · luar talian' : ''}</span></div>
        <div class="drow"><span class="dl">Rekod</span><span class="dv">${state.records.length}</span></div>
        <div class="row-btns">
          <button type="button" class="btn ghost sm" id="reload">${I.refresh}Muat semula</button>
          ${state.demo ? '' : `<a class="btn ghost sm" href="https://docs.google.com/spreadsheets/d/${esc(state.sheetId)}/edit" target="_blank" rel="noopener">${I.sheet}Buka Sheet</a>`}
        </div>
      </section>
      ${standalone ? '' : `<section class="card">
        <h2 class="h2">Pasang di telefon</h2>
        ${canInstall ? `<button type="button" class="btn primary wide" id="install">${I.install}Pasang APP Monitoring Permit</button>`
          : '<div class="sub2">Dalam Chrome, tekan menu ⋮ kemudian <b>Tambah ke skrin utama</b> atau <b>Pasang app</b>. Di iPhone (Safari), tekan Kongsi kemudian <b>Add to Home Screen</b>.</div>'}
      </section>`}
      <section class="card">
        <div class="row-btns">
          <button type="button" class="btn ghost sm" id="switch">${I.sheet}Tukar Google Sheet</button>
          <button type="button" class="btn ghost sm danger" id="logout">${I.logout}Log keluar</button>
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
    const inst = el.querySelector('#install');
    if (inst) {
      inst.addEventListener('click', async () => {
        const p = window.__ampInstall;
        if (!p) return;
        p.prompt();
        await p.userChoice;
        window.__ampInstall = null;
        ctx.rerender();
      });
    }
    el.querySelector('#logout').addEventListener('click', () => ctx.logout());
    el.querySelector('#switch').addEventListener('click', () => ctx.switchSheet());
  },
};
