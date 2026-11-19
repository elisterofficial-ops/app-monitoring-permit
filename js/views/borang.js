// Borang tambah, ulang, baharui dan sunting permit.
import { I } from '../icons.js';
import {
  esc, fmtDate, fmtRM, isoDate, fromIso, today, addDays, diffDays, numOrNull, tcase, scase, norm, debounce, SEKALI, TEMPOH, tempohLabel,
} from '../util.js';
import {
  state, jenisInfo, anggaran, addRecord, updateRecord, frequent, shortName, addMonths, INPUT_KEYS,
  compressImage, uploadPhoto,
} from '../store.js';
import { header, empty, stepper, toast, busy, pickFile, getLocation, openSheet } from '../ui.js';
import { scanPermit, confirmNumber, draft, imbasPermit, imbasResit, askMatch, simpanGambar, tungguGambar } from './scan.js';
import { sameName } from '../imbas.js';
import { AuthError } from '../google.js';

const COPY_KEYS = ['jenis', 'tempoh', 'nama', 'pengurus', 'alamat', 'telefon', 'kawasan', 'kedudukan', 'kuantiti', 'k10', 'k20', 'hiburan', 'kadarKhas', 'koordinat', 'gambarLokasi'];
const NUMS = new Set(['kuantiti', 'k10', 'k20', 'hiburan', 'kadarKhas', 'dibayar']);
const DATES = new Set(['mula', 'tamat', 'tarikhBayar']);
const UPPER = new Set(['nama', 'pengurus', 'noPermit', 'resit']);

function blank() {
  return {
    jenis: '', tempoh: 'TAHUNAN', noPermit: '', idLama: '', nama: '', pengurus: '', alamat: '', telefon: '', kawasan: '', kedudukan: '',
    kuantiti: 1, k10: 0, k20: 0, hiburan: 0, mula: today(), tamat: addDays(addMonths(today(), 12), -1), kadarKhas: null,
    dibayar: null, tarikhBayar: today(), resit: '', koordinat: '', permitAsal: '', gambarLokasi: '', catatan: '',
  };
}

function fromRecord(r, mode) {
  const f = blank();
  for (const k of COPY_KEYS) f[k] = r[k] == null ? (NUMS.has(k) ? null : f[k]) : r[k];
  if (!f.tempoh) f.tempoh = 'TAHUNAN';
  const len = r.mula && r.tamat ? diffDays(r.mula, r.tamat) : 0;
  if (mode === 'baharui') {
    f.idLama = r.id;
    f.mula = r.tamat ? addDays(r.tamat, 1) : today();
    f.tamat = f.tempoh === 'TAHUNAN' ? addDays(addMonths(f.mula, 12), -1) : addDays(f.mula, len);
  } else {
    f.mula = today();
    f.tamat = addDays(f.mula, len);
  }
  if (f.tempoh === SEKALI) f.tamat = null;
  return f;
}

function fromExisting(r) {
  const f = blank();
  for (const k of INPUT_KEYS) if (k !== 'id') f[k] = r[k] == null ? (NUMS.has(k) ? null : DATES.has(k) ? null : '') : r[k];
  return f;
}

const same = (a, b) => {
  if (a instanceof Date || b instanceof Date) return (a ? +a : null) === (b ? +b : null);
  if (typeof a === 'number' || typeof b === 'number') return (a ?? null) === (b ?? null) || (!a && !b);
  return String(a ?? '') === String(b ?? '');
};

function picker() {
  const all = frequent(200);
  return `<div class="page">
    ${header('Ulang permit', { back: '#/utama', sub: 'Pilih pemohon untuk salin butiran permit terakhir' })}
    <div class="search"><label class="sr" for="pq">Cari pemohon</label>${I.search}<input id="pq" type="search" placeholder="Nama pemohon" autocomplete="off"></div>
    <div class="list" id="plist">${all.map((x) => `<a class="rcard" data-n="${esc(norm(x.nama))}" href="#/ulang/${encodeURIComponent(x.latest.id)}">
      <div class="rcard-top"><div class="rcard-name">${esc(x.nama)}</div><span class="pill cyan">${x.count}×</span></div>
      <div class="sub">${esc([scase(x.latest.jenis), tcase(x.latest.kawasan), `terakhir ${fmtDate(x.latest.mula)}`].filter(Boolean).join(' · '))}</div>
    </a>`).join('') || empty('Belum ada rekod', 'Tambah permit pertama dahulu.')}</div>
  </div>`;
}

function opt(list, cur, { blankLabel = 'Pilih…', fmt = (x) => x } = {}) {
  const items = [...list];
  if (cur && !items.includes(cur)) items.push(cur);
  return `<option value="">${esc(blankLabel)}</option>` + items.map((x) => `<option value="${esc(x)}"${x === cur ? ' selected' : ''}>${esc(fmt(x))}</option>`).join('');
}

// Medan yang diisi dari imbasan (SCAN) dan nilai imbasan yang berbeza dengan rekod sedia ada (DIFF).
let SCAN = new Set();
let DIFF = {};
const TAG = '<span class="scan-tag">imbasan</span>';
const mark = (k) => (SCAN.has(k) ? ' scanned' : '');
const tag = (k) => (SCAN.has(k) ? TAG : '');

function showVal(k, v) {
  if (DATES.has(k)) return fmtDate(v);
  if (k === 'dibayar') return fmtRM(v);
  if (k === 'tempoh') return tempohLabel(v);
  if (k === 'jenis') return scase(v);
  if (k === 'kawasan') return tcase(v);
  return String(v ?? '').replace(/\n/g, ', ');
}

function diffHint(k) {
  if (!(k in DIFF)) return '';
  return `<div class="scan-diff" data-diff="${k}"><span>Imbasan: <b>${esc(showVal(k, DIFF[k]))}</b></span><button type="button" class="link" data-use="${k}">Guna</button></div>`;
}

function field(k, label, f, { type = 'text', ph = '', mode = '', cls = '', list = '' } = {}) {
  const v = DATES.has(k) ? isoDate(f[k]) : f[k] == null ? '' : f[k];
  return `<div class="fld ${cls}"><label class="lbl" for="f-${k}">${esc(label)}${tag(k)}</label>
    <input id="f-${k}" class="inp${mark(k)}" data-k="${k}" type="${type}" value="${esc(v)}" placeholder="${esc(ph)}"${mode ? ` inputmode="${mode}"` : ''}${list ? ` list="${list}"` : ''} autocomplete="off">${diffHint(k)}</div>`;
}

// Permit baru dari imbasan: semua medan yang dibaca diisi.
function applyNew(f, d) {
  for (const k of d.keys) { f[k] = d.fields[k]; SCAN.add(k); }
  if (d.fields.mula && !d.fields.tamat && f.tempoh !== SEKALI) f.tamat = addDays(addMonths(f.mula, 12), -1);
  if (f.tempoh === SEKALI) f.tamat = null;
  f.permitAsal = d.permitAsal;
}

// Lengkapkan rekod sedia ada: isi medan yang kosong sahaja; nilai yang berbeza ditunjuk untuk dipilih.
function applyMerge(f, d) {
  for (const k of d.keys) {
    const v = d.fields[k];
    const cur = f[k];
    if (cur == null || cur === '') { f[k] = v; SCAN.add(k); continue; }
    if (k === 'nama' || k === 'pengurus') { if (!sameName(cur, v)) DIFF[k] = v; continue; }
    if (typeof cur === 'string' && typeof v === 'string' && norm(cur) === norm(v)) continue;
    if (!same(cur, v)) DIFF[k] = v;
  }
  if (!f.permitAsal) f.permitAsal = d.permitAsal;
}

function chooser() {
  return `<div class="page">
    ${header('Tambah permit', { back: '#/utama', sub: 'Pilih cara mengisi butiran permit' })}
    <button type="button" class="choice main" data-imbas="kamera">
      <span class="choice-ic">${I.camera}</span>
      <span class="choice-t">Imbas permit</span>
      <span class="sub">Ambil gambar surat kelulusan, permit atau bil MDS yang dicop. Butiran diisi automatik, awak cuma semak dan betulkan.</span>
    </button>
    <button type="button" class="link center" data-imbas="galeri">atau pilih gambar dari galeri</button>
    <button type="button" class="btn ghost wide" id="langkau" hidden>Isi sendiri sementara menunggu</button>
    <a class="choice" href="#/tambah/baru">
      <span class="choice-ic v">${I.edit}</span>
      <span class="choice-t">Isi manual</span>
      <span class="sub">Taip semua butiran sendiri.</span>
    </a>
  </div>`;
}

function bindChooser(el, ctx) {
  const main = el.querySelector('.choice.main');
  const title = main.querySelector('.choice-t');
  const sub = main.querySelector('.sub');
  const subAsal = sub.textContent;
  const langkau = el.querySelector('#langkau');
  let timer = null;
  let skip = null;
  const show = (t) => {
    el.querySelectorAll('[data-imbas]').forEach((x) => { x.disabled = true; });
    title.innerHTML = `<span class="spin" aria-hidden="true"></span> ${esc(t)}`;
  };
  const reset = () => {
    clearInterval(timer);
    main.disabled = false;
    title.textContent = 'Imbas permit';
    sub.textContent = subAsal;
    langkau.hidden = true;
    el.querySelectorAll('[data-imbas]').forEach((b) => { b.disabled = false; });
  };
  langkau.addEventListener('click', () => { if (skip) skip('langkau'); });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-imbas]');
    if (!b || main.disabled) return;
    try {
      await ctx.ensureAuth();
      const d = await imbasPermit({ capture: b.dataset.imbas === 'kamera', step: show });
      if (!d) { reset(); return; }
      // Kiraan saat supaya jelas app masih bekerja; pilihan isi sendiri selepas beberapa saat.
      const tick = () => {
        const s = Math.round((Date.now() - d.t0) / 1000);
        show(`Membaca teks permit… ${s} s`);
        if (s >= 6) {
          langkau.hidden = false;
          sub.textContent = 'Bergantung pada kelajuan internet. Boleh mula isi sendiri; medan akan diisi bila teks siap dibaca.';
        }
      };
      tick();
      timer = setInterval(tick, 1000);
      const hasil = await Promise.race([d.baca, new Promise((r) => { skip = r; })]);
      clearInterval(timer);
      skip = null;
      if (!el.isConnected) return;
      if (hasil === 'langkau') { ctx.go('#/tambah/imbas'); return; }
      if (d.ralat instanceof AuthError) { reset(); ctx.fail(d.ralat); return; }
      if (!d.keys.length) toast('Teks tidak dapat dibaca dari gambar. Gambar permit tetap disimpan, sila isi butiran.', 'err');
      if (d.match) {
        const ans = await askMatch(d.match);
        if (!ans) { reset(); return; }
        if (ans === 'lengkap') { ctx.go(`#/sunting/${encodeURIComponent(d.match.r.id)}?imbas=1`); return; }
      }
      ctx.go('#/tambah/imbas');
    } catch (err) {
      reset();
      ctx.fail(err);
    }
  });
}

const saat = (ms) => `${Math.max(1, Math.round(ms / 1000))} s`;

// Teks kotak imbasan di atas borang.
function scanMsg(d) {
  if (!d.siap) return '<b><span class="spin" aria-hidden="true"></span> Sedang membaca teks permit…</b> <span class="sub">Isi apa yang awak tahu dahulu. Medan yang belum disentuh akan diisi bila teks siap dibaca.</span>';
  const nd = Object.keys(DIFF).length;
  const masa = d.masa.baca ? ` Dibaca dalam ${saat(d.masa.baca)}.` : '';
  if (!SCAN.size && !nd) return `<b>Teks tidak dapat dibaca.</b> <span class="sub">Gambar permit tetap disimpan. Isi butiran sendiri, tekan gambar untuk rujukan.${masa}</span>`;
  return `<b>${SCAN.size ? `${SCAN.size} medan diisi dari imbasan.` : 'Tiada medan kosong untuk diisi.'}</b>${nd ? ` ${nd} berbeza dengan rekod, pilih "Guna" jika imbasan betul.` : ''} <span class="sub">Semak medan bertanda biru sebelum simpan. Tekan gambar untuk lihat besar.${masa}</span>`;
}

// Butang Permit Asal: siap, sedang disimpan, atau gagal.
function permitBtn(f, d) {
  if (f.permitAsal) return `<button type="button" class="fbtn done" data-act="permit">${I.check}<span>Permit asal disimpan</span></button>`;
  if (d && !d.gagal) return `<button type="button" class="fbtn wait" data-act="permit-tunggu" disabled><span class="spin" aria-hidden="true"></span><span>Menyimpan gambar permit…</span></button>`;
  if (d && d.gagal) return `<button type="button" class="fbtn dashed" data-act="permit-ulang">${I.image}<span>Gambar belum disimpan. Tekan untuk cuba lagi</span></button>`;
  return `<button type="button" class="fbtn dashed" data-act="permit">${I.image}<span>Gambar permit asal</span></button>`;
}

export default {
  nav: 'tambah',
  hideNav: true,
  render(ctx) {
    const mode = ctx.name;
    if (mode === 'tambah' && !ctx.arg) return chooser();
    const id = mode === 'tambah' ? '' : String(ctx.arg || '').toUpperCase();
    if (mode === 'ulang' && !id) return picker();
    const src = id ? state.byId.get(id) : null;
    if ((mode !== 'tambah') && !src) return `<div class="page">${header('Permit', { back: '#/utama' })}${empty('Rekod tidak dijumpai')}</div>`;
    SCAN = new Set();
    DIFF = {};
    const d = (mode === 'tambah' && ctx.arg === 'imbas') || (mode === 'sunting' && ctx.q.has('imbas')) ? draft.v : null;
    const f = mode === 'tambah' ? blank() : mode === 'sunting' ? fromExisting(src) : fromRecord(src, mode);
    if (d && d.siap && mode === 'tambah') applyNew(f, d);
    if (d && d.siap && mode === 'sunting') applyMerge(f, d);
    ctx.form = f;
    const title = d && mode === 'sunting' ? 'Lengkapkan rekod' : { tambah: 'Tambah permit', ulang: 'Ulang permit', baharui: 'Baharui permit', sunting: 'Sunting rekod' }[mode];
    let banner = '';
    if (mode === 'ulang') banner = `<div class="vbanner"><div>Disalin dari <b>${esc(src.id)}</b> · ${esc(fmtDate(src.mula))}</div><a href="#/ulang">Tukar</a></div>`;
    if (mode === 'baharui') banner = `<div class="vbanner"><div>Pembaharuan untuk <b>${esc(src.id)}</b> · tamat ${esc(fmtDate(src.tamat))}</div></div>`;
    if (mode === 'sunting') banner = `<div class="vbanner"><div>Menyunting <b>${esc(src.id)}</b>. ID rekod tidak berubah.</div></div>`;
    ctx.scan = d;
    if (d) banner += `<div class="scanbar"><button type="button" class="scan-thumb" data-act="lihat"><img src="${esc(d.thumb)}" alt="Gambar permit yang diimbas"></button><div id="scan-msg">${scanMsg(d)}</div></div>`;
    const jenisList = state.tetapan.jenis.map((j) => j.jenis);
    const names = [...new Set(state.records.map((r) => r.nama))].sort();
    const back = src ? `#/permit/${encodeURIComponent(src.id)}` : mode === 'tambah' ? '#/tambah' : '#/utama';
    return `<div class="page form-page">
      ${header(title, { back })}
      ${banner}
      <div class="seg${mark('tempoh')}" role="radiogroup" aria-label="Jenis tempoh">
        ${Object.entries(TEMPOH).map(([k, label]) => `<button type="button" role="radio" data-tempoh="${k}" aria-checked="${f.tempoh === k}">${label}</button>`).join('')}
      </div>
      ${diffHint('tempoh')}
      <div class="grid2">
        <div class="fld"><label class="lbl" for="f-jenis">Jenis permit${tag('jenis')}</label><select id="f-jenis" class="inp${mark('jenis')}" data-k="jenis">${opt(jenisList, f.jenis, { fmt: scase })}</select>${diffHint('jenis')}</div>
        <div class="fld"><label class="lbl" for="f-kawasan">Kawasan${tag('kawasan')}</label><select id="f-kawasan" class="inp${mark('kawasan')}" data-k="kawasan">${opt(state.tetapan.kawasan, f.kawasan, { fmt: tcase })}</select>${diffHint('kawasan')}</div>
      </div>
      ${field('nama', 'Nama pemohon / syarikat', f, { list: 'names' })}
      <datalist id="names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="grid2">
        ${field('pengurus', 'Nama pengurus premis', f)}
        ${field('telefon', 'No. telefon', f, { type: 'tel', mode: 'tel', ph: '01x-xxxxxxx' })}
      </div>
      <div class="fld"><label class="lbl" for="f-alamat">Alamat premis${tag('alamat')}</label><textarea id="f-alamat" class="inp${mark('alamat')}" data-k="alamat" rows="2" placeholder="Baris 1: no. dan jalan. Baris 2: poskod dan bandar">${esc(f.alamat)}</textarea>${diffHint('alamat')}</div>
      ${field('kedudukan', 'Kedudukan petak / lokasi', f, { ph: 'Contoh: depan kedai, lot 3 dan 4' })}

      <div class="grid2">
        ${field('mula', 'Tarikh mula', f, { type: 'date' })}
        <div class="fld" id="tamat-fld"><label class="lbl" for="f-tamat"><span id="tamat-l">Tarikh tamat</span>${tag('tamat')}</label>
          <input id="f-tamat" class="inp${mark('tamat')}" data-k="tamat" type="date" value="${esc(isoDate(f.tamat))}">${diffHint('tamat')}</div>
      </div>
      <p class="sub" id="sekali-note" hidden>Sekali bayar: tiada tarikh tamat dan tiada surat peringatan.</p>
      <div class="chips" id="per-chips" aria-label="Tempoh cepat">
        <button type="button" class="chip" data-per="1d">1 hari</button>
        <button type="button" class="chip" data-per="7d">1 minggu</button>
        <button type="button" class="chip" data-per="1m">1 bulan</button>
        <button type="button" class="chip" data-per="12m">1 tahun</button>
      </div>

      <div class="grid2 steps">
        <div id="st-qty">${stepper('kuantiti', 'Kuantiti', f.kuantiti)}</div>
        <div class="extra">${stepper('k10', 'Khemah 10x10', f.k10)}</div>
        <div class="extra">${stepper('k20', 'Khemah 20x20', f.k20)}</div>
        <div class="extra">${stepper('hiburan', 'Hiburan', f.hiburan)}</div>
      </div>
      <details class="more"${f.kadarKhas ? ' open' : ''}><summary>Kadar khas (jika berbeza dari kadar standard)</summary>
        ${field('kadarKhas', 'Kadar khas (RM)', f, { type: 'number', mode: 'decimal', ph: 'Kosongkan untuk kadar standard' })}
      </details>

      <section class="card form-card">
        <div class="fld"><label class="lbl" for="f-noPermit">No. permit${tag('noPermit')}</label>
          <div class="inrow"><input id="f-noPermit" class="inp${mark('noPermit')}" data-k="noPermit" value="${esc(f.noPermit)}" placeholder="Taip atau imbas dari gambar permit" autocomplete="off">
          <button type="button" class="btn ghost sm" data-act="imbas">${I.camera}Imbas</button></div>${diffHint('noPermit')}</div>
        <div class="files">
          ${permitBtn(f, d)}
          <button type="button" class="fbtn${f.gambarLokasi ? ' done' : ' dashed'}" data-act="gambar">${f.gambarLokasi ? I.check : I.camera}<span>${f.gambarLokasi ? 'Gambar lokasi disimpan' : 'Gambar lokasi'}</span></button>
        </div>
        <div class="fld"><label class="lbl" for="f-koordinat">Koordinat (lat, long)</label>
          <div class="inrow"><input id="f-koordinat" class="inp" data-k="koordinat" value="${esc(f.koordinat)}" placeholder="1.1666, 110.5666" inputmode="decimal" autocomplete="off">
          <button type="button" class="btn ghost sm" data-act="lokasi">${I.locate}Lokasi saya</button></div></div>
      </section>

      <section class="card form-card">
        <div class="card-h"><h2 class="h2">Bayaran</h2><button type="button" class="btn ghost sm" data-act="resit">${I.camera}Imbas resit</button></div>
        <div class="grid2">
          ${field('dibayar', 'Jumlah dibayar (RM)', f, { type: 'number', mode: 'decimal', ph: '0.00' })}
          ${field('tarikhBayar', 'Tarikh bayar', f, { type: 'date' })}
        </div>
        ${field('resit', 'No. resit', f)}
      </section>
      <div class="fld"><label class="lbl" for="f-catatan">Catatan</label><textarea id="f-catatan" class="inp" data-k="catatan" rows="2">${esc(f.catatan)}</textarea></div>

      <div class="savebar">
        <div class="save-sum">
          <div><div class="sub">Jumlah keseluruhan</div><div class="sub" id="ket"></div></div>
          <div class="save-r"><div class="save-amt" id="amt">-</div><button type="button" class="link" id="use-amt" hidden>Guna sebagai jumlah dibayar</button></div>
        </div>
        <button type="button" class="btn primary big" id="save">${mode === 'sunting' ? 'Simpan perubahan' : 'Simpan permit'}</button>
      </div>
    </div>`;
  },
  bind(el, ctx) {
    const mode = ctx.name;
    if (mode === 'tambah' && !ctx.arg) { bindChooser(el, ctx); return; }
    const id = mode === 'tambah' ? '' : String(ctx.arg || '').toUpperCase();
    if (mode === 'ulang' && !id) {
      const inp = el.querySelector('#pq');
      inp.addEventListener('input', debounce(() => {
        const n = norm(inp.value);
        el.querySelectorAll('#plist [data-n]').forEach((a) => { a.hidden = n && !a.dataset.n.includes(n); });
      }, 100));
      inp.focus({ preventScroll: true });
      return;
    }
    const f = ctx.form;
    if (!f) return;
    const src = id ? state.byId.get(id) : null;
    const orig = mode === 'sunting' && src ? fromExisting(src) : null;

    const $ = (s) => el.querySelector(s);
    const refresh = () => {
      const bermusim = f.tempoh === 'BERMUSIM';
      const sekali = f.tempoh === SEKALI;
      el.querySelectorAll('.extra').forEach((x) => { x.hidden = !bermusim; });
      $('#tamat-fld').hidden = sekali;
      $('#per-chips').hidden = sekali;
      $('#sekali-note').hidden = !sekali;
      el.querySelectorAll('[data-tempoh]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tempoh === f.tempoh)));
      const info = jenisInfo(f.jenis) || {};
      const lbl = el.querySelector('#st-qty .stepper-l');
      const kadar = f.kadarKhas || (bermusim ? info.kadarHarian : info.kadarStandard);
      const asas = bermusim ? 'sehari' : String(info.asasKadar || '').toLowerCase();
      lbl.innerHTML = `${esc(scase(info.unitKuantiti || 'Kuantiti'))}${kadar ? ` <span class="muted">· RM${esc(kadar)}${asas ? ` ${esc(asas)}` : ''}</span>` : ''}${tag('kuantiti')}`;
      const days = f.mula && f.tamat ? diffDays(f.mula, f.tamat) + 1 : 0;
      $('#tamat-l').textContent = days > 0 ? `Tarikh tamat · ${days} hari` : 'Tarikh tamat';
      const a = anggaran(f);
      $('#amt').textContent = a ? fmtRM(a.total) : '-';
      $('#ket').textContent = a ? a.ket : (f.jenis ? `Kadar ${scase(f.jenis)} belum ditetapkan dalam TETAPAN` : 'Pilih jenis permit');
      $('#use-amt').hidden = !a || f.dibayar === a.total;
      $('#use-amt').dataset.v = a ? a.total : '';
    };

    // Medan yang disentuh pengguna tidak lagi bertanda "imbasan".
    const unmark = (k) => {
      if (!SCAN.delete(k)) return;
      const inp = $(`#f-${k}`);
      if (inp) inp.classList.remove('scanned');
      const lbl = el.querySelector(`label[for="f-${k}"] .scan-tag`);
      if (lbl) lbl.remove();
      if (k === 'tempoh') $('.seg').classList.remove('scanned');
    };
    // Isi medan dari imbasan resit atau butang "Guna".
    const setField = (k, v) => {
      f[k] = v;
      if (k === 'tempoh') {
        if (v === SEKALI) f.tamat = null;
      } else {
        const inp = $(`#f-${k}`);
        if (inp) inp.value = DATES.has(k) ? isoDate(v) : v ?? '';
      }
      if (k === 'kuantiti') {
        const box = el.querySelector('[data-stepper="kuantiti"]');
        box.querySelector('.st-v').textContent = v;
        box.classList.toggle('on', v > 0);
      }
      SCAN.add(k);
      const inp = $(`#f-${k}`);
      if (inp) inp.classList.add('scanned');
      const lbl = el.querySelector(`label[for="f-${k}"]`);
      if (lbl && !lbl.querySelector('.scan-tag')) lbl.insertAdjacentHTML('beforeend', TAG);
      if (k === 'tempoh') $('.seg').classList.add('scanned');
      const hint = el.querySelector(`[data-diff="${k}"]`);
      if (hint) hint.remove();
      delete DIFF[k];
    };

    // Imbasan yang masih berjalan: gambar disimpan di belakang, dan teks yang lewat mengisi
    // medan yang belum disentuh pengguna.
    const d = ctx.scan;
    const touched = new Set();
    const setPermitBtn = () => {
      const pb = el.querySelector('[data-act^="permit"]');
      if (pb) pb.outerHTML = permitBtn(f, d);
    };
    const watchUpload = () => {
      if (!d || f.permitAsal) return;
      tungguGambar(d).then((link) => {
        d.gagal = false;
        if (!f.permitAsal) f.permitAsal = link;
        if (el.isConnected) setPermitBtn();
      }).catch(() => {
        d.gagal = true;
        if (el.isConnected) setPermitBtn();
      });
    };
    if (d) {
      watchUpload();
      if (!d.siap) {
        d.baca.then(() => {
          if (!el.isConnected) return;
          if (d.ralat instanceof AuthError) ctx.fail(d.ralat);
          let n = 0;
          for (const k of d.keys) {
            if (touched.has(k)) continue;
            setField(k, d.fields[k]);
            n++;
          }
          refresh();
          $('#scan-msg').innerHTML = scanMsg(d);
          const sama = d.match ? ` Mungkin sama dengan rekod ${d.match.r.id}, semak sebelum simpan.` : '';
          toast(n ? `${n} medan diisi dari imbasan.${sama}` : `Teks tidak dapat dibaca dari gambar.${sama}`, n && !sama ? 'ok' : 'err');
        });
      }
    }

    el.addEventListener('input', (e) => {
      const t = e.target.closest('[data-k]');
      if (!t) return;
      const k = t.dataset.k;
      const v = t.value;
      if (DATES.has(k)) f[k] = fromIso(v);
      else if (NUMS.has(k)) f[k] = numOrNull(v);
      else f[k] = v;
      touched.add(k);
      unmark(k);
      refresh();
    });
    el.addEventListener('change', (e) => {
      const t = e.target.closest('select[data-k]');
      if (t) { f[t.dataset.k] = t.value; touched.add(t.dataset.k); unmark(t.dataset.k); refresh(); }
    });

    el.addEventListener('click', async (e) => {
      const use = e.target.closest('[data-use]');
      if (use) {
        const k = use.dataset.use;
        if (k in DIFF) setField(k, DIFF[k]);
        refresh();
        return;
      }
      const tp = e.target.closest('[data-tempoh]');
      if (tp) {
        unmark('tempoh');
        touched.add('tempoh');
        f.tempoh = tp.dataset.tempoh;
        if (f.tempoh !== SEKALI && !f.tamat) {
          const start = f.mula || today();
          f.tamat = f.tempoh === 'TAHUNAN' ? addDays(addMonths(start, 12), -1) : addDays(addMonths(start, 1), -1);
          $('#f-tamat').value = isoDate(f.tamat);
        }
        refresh();
        return;
      }
      const st = e.target.closest('[data-step]');
      if (st) {
        const box = st.closest('[data-stepper]');
        const k = box.dataset.stepper;
        const min = k === 'kuantiti' ? 1 : 0;
        SCAN.delete(k);
        touched.add(k);
        f[k] = Math.max(min, Number(f[k] || 0) + Number(st.dataset.step));
        box.querySelector('.st-v').textContent = f[k];
        box.classList.toggle('on', f[k] > 0);
        refresh();
        return;
      }
      const per = e.target.closest('[data-per]');
      if (per) {
        const start = f.mula || today();
        const p = per.dataset.per;
        f.tamat = p.endsWith('d') ? addDays(start, Number(p.slice(0, -1)) - 1) : addDays(addMonths(start, Number(p.slice(0, -1))), -1);
        $('#f-tamat').value = isoDate(f.tamat);
        touched.add('tamat');
        unmark('tamat');
        refresh();
        return;
      }
      if (e.target.closest('#use-amt')) {
        f.dibayar = Number($('#use-amt').dataset.v);
        $('#f-dibayar').value = f.dibayar;
        refresh();
        return;
      }
      const b = e.target.closest('[data-act]');
      if (b) {
        const act = b.dataset.act;
        try {
          if (act === 'lokasi') {
            busy(b, true, 'Mengesan…');
            f.koordinat = await getLocation();
            $('#f-koordinat').value = f.koordinat;
            busy(b, false);
            toast('Lokasi semasa diisi.', 'ok');
          } else if (act === 'lihat') {
            const img = draft.v ? draft.v.thumb : '';
            openSheet(`<h2 class="h2">Gambar permit</h2>
              <img class="scan-full" src="${esc(img)}" alt="Gambar permit yang diimbas">
              ${f.permitAsal ? `<a class="btn ghost wide" href="${esc(f.permitAsal)}" target="_blank" rel="noopener">${I.ext}Buka dalam Drive</a>` : ''}
              <button type="button" class="btn ghost wide" data-close>Tutup</button>`);
          } else if (act === 'resit') {
            await ctx.ensureAuth();
            const got = await imbasResit({ step: (t) => busy(b, true, t) });
            busy(b, false);
            if (!got) return;
            const keys = Object.keys(got);
            if (!keys.length) { toast('Resit tidak dapat dibaca. Isi bayaran sendiri.', 'err'); return; }
            keys.forEach((k) => setField(k, got[k]));
            refresh();
            toast(`${keys.length} medan bayaran diisi dari resit. Sila semak.`, 'ok');
          } else if (act === 'imbas') {
            await ctx.ensureAuth();
            const res = await scanPermit(src && mode === 'sunting' ? src.id : f.nama || 'Permit baru');
            if (!res) return;
            f.permitAsal = res.link;
            setPermitBtn();
            const num = await confirmNumber(res.candidates, f.noPermit);
            if (num) { f.noPermit = num; $('#f-noPermit').value = num; }
          } else if (act === 'permit-ulang') {
            await ctx.ensureAuth();
            d.gagal = false;
            setPermitBtn();
            simpanGambar(d);
            watchUpload();
          } else if (act === 'permit' || act === 'gambar') {
            await ctx.ensureAuth();
            const file = await pickFile();
            if (!file) return;
            busy(b, true, 'Memuat naik…');
            const blob = await compressImage(file);
            const label = act === 'permit' ? 'permit asal' : 'gambar lokasi';
            const up = await uploadPhoto(blob, `${(src && mode === 'sunting' ? src.id : f.nama) || 'Permit baru'} - ${label}.jpg`);
            f[act === 'permit' ? 'permitAsal' : 'gambarLokasi'] = up.webViewLink;
            b.disabled = false;
            b.className = 'fbtn done';
            b.innerHTML = `${I.check}<span>${act === 'permit' ? 'Permit asal disimpan' : 'Gambar lokasi disimpan'}</span>`;
          }
        } catch (err) {
          busy(b, false);
          ctx.fail(err);
        }
        return;
      }
      const sv = e.target.closest('#save');
      if (sv) save(sv);
    });

    async function save(btn) {
      const errs = [];
      if (!f.jenis) errs.push(['jenis', 'Pilih jenis permit.']);
      if (!String(f.nama || '').trim()) errs.push(['nama', 'Isi nama pemohon atau syarikat.']);
      const sekali = f.tempoh === SEKALI;
      if (!f.mula) errs.push(['mula', 'Isi tarikh mula.']);
      if (!sekali && !f.tamat) errs.push(['tamat', 'Isi tarikh tamat.']);
      if (!sekali && f.mula && f.tamat && f.tamat < f.mula) errs.push(['tamat', 'Tarikh tamat lebih awal dari tarikh mula.']);
      el.querySelectorAll('.inp.err').forEach((x) => x.classList.remove('err'));
      if (errs.length) {
        errs.forEach(([k]) => { const x = $(`#f-${k}`); if (x) x.classList.add('err'); });
        const first = $(`#f-${errs[0][0]}`);
        if (first) first.focus();
        toast(errs[0][1], 'err');
        return;
      }
      // Gambar imbasan masih dimuat naik: tunggu supaya pautan Permit Asal ikut disimpan.
      if (d && !f.permitAsal && !d.abaiGambar) {
        busy(btn, true, 'Menunggu gambar permit disimpan…');
        try {
          f.permitAsal = await tungguGambar(d);
          setPermitBtn();
        } catch {
          d.gagal = true;
          d.abaiGambar = true;
          setPermitBtn();
          busy(btn, false);
          toast('Gambar permit gagal disimpan. Tekan butang gambar untuk cuba lagi, atau tekan Simpan sekali lagi untuk simpan tanpa gambar.', 'err');
          return;
        }
        busy(btn, false);
      }
      const data = {};
      for (const k of INPUT_KEYS) {
        if (k === 'id') continue;
        let v = f[k];
        if (typeof v === 'string') { v = v.trim(); if (UPPER.has(k)) v = v.toUpperCase(); }
        data[k] = v;
      }
      if (data.tempoh !== 'BERMUSIM') { data.k10 = data.k10 || null; data.k20 = data.k20 || null; data.hiburan = data.hiburan || null; }
      if (sekali) data.tamat = null;
      busy(btn, true, 'Menyimpan…');
      try {
        if (mode === 'sunting') {
          const changes = {};
          for (const [k, v] of Object.entries(data)) if (!same(v, orig[k])) changes[k] = v ?? '';
          await ctx.withAuth(() => updateRecord(src.id, changes));
          draft.v = null;
          toast(Object.keys(changes).length ? 'Perubahan disimpan.' : 'Tiada perubahan.', 'ok');
          ctx.go(`#/permit/${encodeURIComponent(src.id)}`);
        } else {
          const newId = await ctx.withAuth(() => addRecord(data));
          draft.v = null;
          toast(`Permit ${newId} disimpan.`, 'ok');
          ctx.go(`#/permit/${encodeURIComponent(newId)}`);
        }
      } catch (err) {
        busy(btn, false);
        ctx.fail(err);
      }
    }

    refresh();
  },
};
