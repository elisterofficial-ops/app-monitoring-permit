// Kerangka app: log masuk, penghala (router), navigasi bawah dan pengendalian ralat.
import { I } from './icons.js';
import { hasToken, signIn, signOut, AuthError } from './google.js';
import { state, load, loadCache, hasCache, canEdit } from './store.js';
import { toast, openSheet, busy } from './ui.js';
import { parseSheetId } from './util.js';
import { parseKetua, ketuaTersimpan, simpanKetua, buangKetua, samaKetua, PautanError } from './ketua.js';
import { loginView } from './views/login.js';
import { installCard } from './install.js';
import utama from './views/utama.js';
import cari from './views/cari.js';
import butiran from './views/butiran.js';
import borang from './views/borang.js';
import hasil from './views/hasil.js';
import surat from './views/surat.js';
import profil from './views/profil.js';

// 'ketua' ialah Utama: alamat pautan ketua dikekalkan supaya ikon di skrin utama iPhone membawa pautan itu.
const VIEWS = { utama, ketua: utama, cari, permit: butiran, tambah: borang, ulang: borang, baharui: borang, sunting: borang, hasil, surat, profil };
const EDIT_ONLY = new Set(['tambah', 'ulang', 'baharui', 'sunting']);
let app = document.getElementById('app');

// Bekas baru setiap kali skrin dilukis. Skrin memasang pengendali acara pada bekas ini; tanpa bekas baru,
// pengendali dari skrin lama bertindan (contohnya dua imbasan serentak bila butang Imbas ditekan sekali).
function freshApp() {
  const n = app.cloneNode(false);
  app.replaceWith(n);
  app = n;
  return n;
}
const nav = document.getElementById('nav');
const DEMO = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('demo');

let started = false;
const stack = [];

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const [name, ...rest] = (path || '').split('/');
  return { name: name || 'utama', arg: decodeURIComponent(rest.join('/')), q: new URLSearchParams(qs || '') };
}

function renderNav(active, hidden) {
  if (hidden) { nav.hidden = true; return; }
  nav.hidden = false;
  const item = (r, ic, label) =>
    `<a href="#/${r}" class="nav-i${active === r ? ' on' : ''}"${active === r ? ' aria-current="page"' : ''}>${I[ic]}<span>${label}</span></a>`;
  nav.innerHTML = item('utama', 'home', 'Utama') + item('cari', 'search', 'Cari')
    + (canEdit() ? `<a href="#/tambah" class="nav-fab" aria-label="Tambah permit">${I.plus}</a>` : '')
    + item('hasil', 'chart', 'Hasil') + (state.ketua ? item('profil', 'user', 'Profil') : item('surat', 'mail', 'Surat'));
}

const go = (hash) => { location.hash = hash; };

// Muat semula data. Jika pautan ketua sudah dimatikan, keluar terus dari paparan.
async function muatSemula() {
  try {
    await load();
  } catch (e) {
    if (!(e instanceof PautanError)) throw e;
    keluarKetua(e.message);
    throw Object.assign(new Error(e.message), { cancelled: true });
  }
}

function makeCtx(r) {
  return {
    ...r,
    go,
    rerender: () => route(true),
    withAuth,
    ensureAuth,
    readyNow,
    fail,
    reload: muatSemula,
    logout,
    switchSheet,
    keluarKetua,
  };
}

function route(keepScroll = false) {
  if (!started) return;
  const r = parseHash();
  if (EDIT_ONLY.has(r.name) && !canEdit()) {
    toast('Akaun ini untuk melihat sahaja.', 'err');
    history.replaceState(null, '', '#/utama');
    r.name = 'utama';
  }
  if (state.ketua && r.name === 'surat') {
    history.replaceState(null, '', '#/utama');
    r.name = 'utama';
  }
  const view = VIEWS[r.name] || utama;
  const ctx = makeCtx(r);
  const y = window.scrollY;
  try {
    const html = view.render(ctx);
    freshApp();
    app.innerHTML = html;
    renderNav(state.ketua && r.name === 'profil' ? 'profil' : view.nav || r.name, view.hideNav);
    if (view.bind) view.bind(app, ctx);
  } catch (e) {
    console.error(e);
    freshApp();
    app.innerHTML = `<div class="page"><div class="empty"><div class="empty-t">Skrin ini gagal dipaparkan</div><div class="sub">${String(e.message || e)}</div><a class="btn ghost" href="#/utama">Kembali ke Utama</a></div></div>`;
  }
  window.scrollTo(0, keepScroll ? y : 0);
  document.title = 'APP Monitoring Permit';
}

window.addEventListener('hashchange', () => {
  const h = location.hash;
  const k = parseKetua(h);
  if (k && !samaKetua(k, state.ketua)) { location.reload(); return; }
  if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
  else stack.push(h);
  route();
});

// Butang kembali: guna sejarah dalam app jika ada, supaya carian tidak hilang.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-back]');
  if (b && stack.length > 1) {
    e.preventDefault();
    history.back();
    return;
  }
  const ins = e.target.closest('[data-install]');
  if (ins && window.__ampInstall) {
    window.__ampInstall.prompt();
    window.__ampInstall.userChoice.finally(() => { window.__ampInstall = null; refreshInstallCards(); });
    return;
  }
  if (e.target.closest('[data-install-x]')) {
    try { localStorage.setItem('amp-install-x', '1'); } catch {}
    route(true);
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if (cp) copyText(cp.dataset.copy);
});

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Pautan disalin. Tampal di Chrome atau Safari.', 'ok');
  } catch {
    window.prompt('Salin pautan ini:', text);
  }
}

function refreshInstallCards() {
  document.querySelectorAll('.install-card').forEach((el) => {
    const html = installCard();
    if (html) el.outerHTML = html; else el.remove();
  });
  if (started && parseHash().name === 'utama') route(true);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__ampInstall = e;
  refreshInstallCards();
});

window.addEventListener('appinstalled', () => {
  window.__ampInstall = null;
  toast('App dipasang. Buka dari ikon di skrin utama.', 'ok');
  refreshInstallCards();
});

function reconnect() {
  return new Promise((resolve, reject) => {
    let ok = false;
    openSheet(`<h2 class="h2">Sambung semula</h2>
      <p class="sub">Sesi log masuk Google tamat setiap sejam. Tekan butang di bawah untuk sambung semula, kemudian tindakan tadi akan diteruskan.</p>
      <button type="button" class="btn google big" id="re">${I.google}<span>Sambung dengan Google</span></button>
      <p class="err" id="re-err" role="alert"></p>`, (sheet, close) => {
      const b = sheet.querySelector('#re');
      b.addEventListener('click', async () => {
        busy(b, true, 'Menyambung…');
        try {
          await signIn();
          ok = true;
          close();
          resolve();
        } catch (err) {
          busy(b, false);
          sheet.querySelector('#re-err').textContent = err.message;
        }
      });
    }, () => { if (!ok) reject(Object.assign(new Error('Dibatalkan.'), { cancelled: true })); });
  });
}

async function ensureAuth() {
  if (state.demo || state.ketua || hasToken()) return;
  await reconnect();
}

// Untuk butang yang membuka kamera atau galeri: iPhone hanya membuka pemilih gambar jika ia dipanggil terus
// dalam tekanan jari, tanpa menunggu apa-apa dahulu. Pulangkan true jika sesi sah (teruskan serta-merta);
// jika tidak, minta sambung semula dan pengguna tekan butang itu sekali lagi.
function readyNow() {
  if (state.demo || hasToken()) return true;
  reconnect().then(() => toast('Disambung semula. Tekan butang tadi sekali lagi.', 'ok')).catch(() => {});
  return false;
}

async function withAuth(fn) {
  await ensureAuth();
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) {
      await reconnect();
      return fn();
    }
    throw e;
  }
}

function fail(err) {
  if (err && err.cancelled) return;
  console.error(err);
  toast((err && err.message) || 'Ralat tidak diketahui.', 'err');
}

function start() {
  started = true;
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/utama');
  stack.length = 0;
  stack.push(location.hash);
  route();
}

function friendly(e) {
  if (e && (e.status === 403 || e.status === 404)) {
    return 'Akaun Google ini tiada akses ke Sheet permit. Minta admin kongsi Sheet dengan emel awak, atau semak pautan Sheet.';
  }
  return (e && e.message) || 'Ralat tidak diketahui.';
}

function showLogin(error = '') {
  started = false;
  nav.hidden = true;
  const needSheet = !state.sheetId;
  freshApp();
  app.innerHTML = loginView({ needSheet, hasCache: !!state.sheetId && hasCache(), error });
  const err = app.querySelector('#login-err');
  const btn = app.querySelector('#btn-login');
  btn.addEventListener('click', async () => {
    err.textContent = '';
    if (needSheet) {
      const teks = app.querySelector('#sheet-url').value;
      const k = parseKetua(teks);
      if (k) { busy(btn, true, 'Memuatkan data…'); mulaKetua(k); return; }
      const id = parseSheetId(teks);
      if (!id) { err.textContent = 'Pautan Google Sheet tidak sah. Salin pautan penuh dari bar alamat Sheet.'; return; }
      state.sheetId = id;
      try { localStorage.setItem('amp-sheet', id); } catch {}
    }
    busy(btn, true, 'Log masuk…');
    try {
      await signIn();
      btn.innerHTML = '<span class="spin" aria-hidden="true"></span>Memuatkan data…';
      await load();
      start();
    } catch (e) {
      busy(btn, false);
      err.textContent = friendly(e);
    }
  });
  const off = app.querySelector('#btn-offline');
  if (off) off.addEventListener('click', () => { if (loadCache()) start(); });
}

function logout() {
  signOut();
  try { localStorage.removeItem(`amp-cache:${state.sheetId}`); } catch {}
  state.user = null;
  state.ownerEmail = '';
  showLogin();
}

function switchSheet() {
  try {
    localStorage.removeItem(`amp-cache:${state.sheetId}`);
    localStorage.removeItem('amp-sheet');
  } catch {}
  state.sheetId = '';
  state.user = null;
  state.ownerEmail = '';
  showLogin();
}

// Keluar dari paparan ketua, kembali ke log masuk admin dan focal person.
function keluarKetua(mesej = '') {
  buangKetua();
  state.ketua = null;
  state.user = null;
  state.sheetTitle = '';
  try { state.sheetId = localStorage.getItem('amp-sheet') || ''; } catch { state.sheetId = ''; }
  history.replaceState(null, '', location.pathname + location.search + '#/utama');
  showLogin(mesej);
}

// Paparan ketua: lihat sahaja, tanpa log masuk Google.
async function mulaKetua(k) {
  simpanKetua(k);
  state.ketua = k;
  state.sheetId = 'ketua';
  // iPhone: tanpa manifest, ikon di skrin utama menyimpan alamat semasa (pautan ketua), bukan start_url biasa.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) document.querySelectorAll('link[rel="manifest"]').forEach((x) => x.remove());
  const had = loadCache();
  if (had) start();
  try {
    await load();
    if (had) route(true); else start();
  } catch (e) {
    if (e instanceof PautanError) { keluarKetua(e.message); return; }
    if (had) toast(e.offline ? 'Luar talian. Memaparkan data simpanan.' : friendly(e), e.offline ? '' : 'err');
    else showKetuaGagal(friendly(e), k);
  }
}

function showKetuaGagal(mesej, k) {
  started = false;
  nav.hidden = true;
  freshApp();
  app.innerHTML = `<div class="page"><div class="empty"><div class="empty-t">Data belum dapat dimuatkan</div><div class="sub">${mesej}</div>
    <button type="button" class="btn primary" id="k-cuba">Cuba lagi</button></div></div>`;
  app.querySelector('#k-cuba').addEventListener('click', (e) => { busy(e.currentTarget, true, 'Memuatkan…'); mulaKetua(k); });
}

async function boot() {
  if ('serviceWorker' in navigator && !DEMO) navigator.serviceWorker.register('sw.js').catch(() => {});
  const params = new URLSearchParams(location.search);
  const sp = params.get('sheet');
  if (sp) {
    const id = parseSheetId(sp);
    if (id) { try { localStorage.setItem('amp-sheet', id); } catch {} }
    params.delete('sheet');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }
  const ketua = parseKetua(location.hash) || ketuaTersimpan();
  if (ketua) { await mulaKetua(ketua); return; }
  state.demo = DEMO;
  if (DEMO) {
    state.sheetId = 'demo';
    try { await load(); start(); } catch (e) { showLogin(e.message); }
    return;
  }
  try { state.sheetId = localStorage.getItem('amp-sheet') || ''; } catch { state.sheetId = ''; }
  if (!state.sheetId || !hasToken()) { showLogin(); return; }
  const had = loadCache();
  if (had) start();
  try {
    await load();
    if (had) route(true); else start();
  } catch (e) {
    if (e instanceof AuthError) { if (!had) showLogin(); return; }
    if (had) toast(e.offline ? 'Luar talian. Memaparkan data simpanan.' : `Data tidak dapat dikemas kini: ${friendly(e)}`, e.offline ? '' : 'err');
    else showLogin(friendly(e));
  }
}

boot();
