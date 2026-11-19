// Borang tambah, ulang, baharui dan sunting permit.
import { I } from '../icons.js';
import {
  esc, fmtDate, fmtRM, isoDate, fromIso, today, addDays, diffDays, numOrNull, tcase, scase, norm, debounce,
} from '../util.js';
import {
  state, jenisInfo, anggaran, addRecord, updateRecord, frequent, shortName, addMonths, INPUT_KEYS,
  compressImage, uploadPhoto,
} from '../store.js';
import { header, empty, stepper, toast, busy, pickFile, getLocation } from '../ui.js';
import { scanPermit, confirmNumber } from './scan.js';

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

function field(k, label, f, { type = 'text', ph = '', mode = '', cls = '', list = '' } = {}) {
  const v = DATES.has(k) ? isoDate(f[k]) : f[k] == null ? '' : f[k];
  return `<div class="fld ${cls}"><label class="lbl" for="f-${k}">${esc(label)}</label>
    <input id="f-${k}" class="inp" data-k="${k}" type="${type}" value="${esc(v)}" placeholder="${esc(ph)}"${mode ? ` inputmode="${mode}"` : ''}${list ? ` list="${list}"` : ''} autocomplete="off"></div>`;
}

export default {
  nav: 'tambah',
  hideNav: true,
  render(ctx) {
    const mode = ctx.name;
    const id = String(ctx.arg || '').toUpperCase();
    if (mode === 'ulang' && !id) return picker();
    const src = id ? state.byId.get(id) : null;
    if ((mode !== 'tambah') && !src) return `<div class="page">${header('Permit', { back: '#/utama' })}${empty('Rekod tidak dijumpai')}</div>`;
    const f = mode === 'tambah' ? blank() : mode === 'sunting' ? fromExisting(src) : fromRecord(src, mode);
    ctx.form = f;
    const title = { tambah: 'Tambah permit', ulang: 'Ulang permit', baharui: 'Baharui permit', sunting: 'Sunting rekod' }[mode];
    let banner = '';
    if (mode === 'ulang') banner = `<div class="vbanner"><div>Disalin dari <b>${esc(src.id)}</b> · ${esc(fmtDate(src.mula))}</div><a href="#/ulang">Tukar</a></div>`;
    if (mode === 'baharui') banner = `<div class="vbanner"><div>Pembaharuan untuk <b>${esc(src.id)}</b> · tamat ${esc(fmtDate(src.tamat))}</div></div>`;
    if (mode === 'sunting') banner = `<div class="vbanner"><div>Menyunting <b>${esc(src.id)}</b>. ID rekod tidak berubah.</div></div>`;
    const jenisList = state.tetapan.jenis.map((j) => j.jenis);
    const names = [...new Set(state.records.map((r) => r.nama))].sort();
    return `<div class="page form-page">
      ${header(title, { back: src ? `#/permit/${encodeURIComponent(src.id)}` : '#/utama' })}
      ${banner}
      <div class="seg" role="radiogroup" aria-label="Jenis tempoh">
        <button type="button" role="radio" data-tempoh="TAHUNAN" aria-checked="${f.tempoh !== 'BERMUSIM'}">Tahunan</button>
        <button type="button" role="radio" data-tempoh="BERMUSIM" aria-checked="${f.tempoh === 'BERMUSIM'}">Bermusim</button>
      </div>
      <div class="grid2">
        <div class="fld"><label class="lbl" for="f-jenis">Jenis permit</label><select id="f-jenis" class="inp" data-k="jenis">${opt(jenisList, f.jenis, { fmt: scase })}</select></div>
        <div class="fld"><label class="lbl" for="f-kawasan">Kawasan</label><select id="f-kawasan" class="inp" data-k="kawasan">${opt(state.tetapan.kawasan, f.kawasan, { fmt: tcase })}</select></div>
      </div>
      ${field('nama', 'Nama pemohon / syarikat', f, { list: 'names' })}
      <datalist id="names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="grid2">
        ${field('pengurus', 'Nama pengurus premis', f)}
        ${field('telefon', 'No. telefon', f, { type: 'tel', mode: 'tel', ph: '01x-xxxxxxx' })}
      </div>
      <div class="fld"><label class="lbl" for="f-alamat">Alamat premis</label><textarea id="f-alamat" class="inp" data-k="alamat" rows="2" placeholder="Baris 1: no. dan jalan. Baris 2: poskod dan bandar">${esc(f.alamat)}</textarea></div>
      ${field('kedudukan', 'Kedudukan petak / lokasi', f, { ph: 'Contoh: depan kedai, lot 3 dan 4' })}

      <div class="grid2">
        ${field('mula', 'Tarikh mula', f, { type: 'date' })}
        <div class="fld"><label class="lbl" for="f-tamat" id="tamat-l">Tarikh tamat</label>
          <input id="f-tamat" class="inp" data-k="tamat" type="date" value="${esc(isoDate(f.tamat))}"></div>
      </div>
      <div class="chips" aria-label="Tempoh cepat">
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
        <div class="fld"><label class="lbl" for="f-noPermit">No. permit</label>
          <div class="inrow"><input id="f-noPermit" class="inp" data-k="noPermit" value="${esc(f.noPermit)}" placeholder="Taip atau imbas dari gambar permit" autocomplete="off">
          <button type="button" class="btn ghost sm" data-act="imbas">${I.camera}Imbas</button></div></div>
        <div class="files">
          <button type="button" class="fbtn${f.permitAsal ? ' done' : ' dashed'}" data-act="permit">${f.permitAsal ? I.check : I.image}<span>${f.permitAsal ? 'Permit asal disimpan' : 'Gambar permit asal'}</span></button>
          <button type="button" class="fbtn${f.gambarLokasi ? ' done' : ' dashed'}" data-act="gambar">${f.gambarLokasi ? I.check : I.camera}<span>${f.gambarLokasi ? 'Gambar lokasi disimpan' : 'Gambar lokasi'}</span></button>
        </div>
        <div class="fld"><label class="lbl" for="f-koordinat">Koordinat (lat, long)</label>
          <div class="inrow"><input id="f-koordinat" class="inp" data-k="koordinat" value="${esc(f.koordinat)}" placeholder="1.1666, 110.5666" inputmode="decimal" autocomplete="off">
          <button type="button" class="btn ghost sm" data-act="lokasi">${I.locate}Lokasi saya</button></div></div>
      </section>

      <section class="card form-card">
        <h2 class="h2">Bayaran</h2>
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
    const id = String(ctx.arg || '').toUpperCase();
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
      el.querySelectorAll('.extra').forEach((x) => { x.hidden = !bermusim; });
      el.querySelectorAll('[data-tempoh]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tempoh === f.tempoh)));
      const info = jenisInfo(f.jenis) || {};
      const lbl = el.querySelector('#st-qty .stepper-l');
      const kadar = f.kadarKhas || (bermusim ? info.kadarHarian : info.kadarStandard);
      const asas = bermusim ? 'sehari' : String(info.asasKadar || '').toLowerCase();
      lbl.innerHTML = `${esc(scase(info.unitKuantiti || 'Kuantiti'))}${kadar ? ` <span class="muted">· RM${esc(kadar)}${asas ? ` ${esc(asas)}` : ''}</span>` : ''}`;
      const days = f.mula && f.tamat ? diffDays(f.mula, f.tamat) + 1 : 0;
      $('#tamat-l').textContent = days > 0 ? `Tarikh tamat · ${days} hari` : 'Tarikh tamat';
      const a = anggaran(f);
      $('#amt').textContent = a ? fmtRM(a.total) : '-';
      $('#ket').textContent = a ? a.ket : (f.jenis ? `Kadar ${scase(f.jenis)} belum ditetapkan dalam TETAPAN` : 'Pilih jenis permit');
      $('#use-amt').hidden = !a || f.dibayar === a.total;
      $('#use-amt').dataset.v = a ? a.total : '';
    };

    el.addEventListener('input', (e) => {
      const t = e.target.closest('[data-k]');
      if (!t) return;
      const k = t.dataset.k;
      const v = t.value;
      if (DATES.has(k)) f[k] = fromIso(v);
      else if (NUMS.has(k)) f[k] = numOrNull(v);
      else f[k] = v;
      refresh();
    });
    el.addEventListener('change', (e) => {
      const t = e.target.closest('select[data-k]');
      if (t) { f[t.dataset.k] = t.value; refresh(); }
    });

    el.addEventListener('click', async (e) => {
      const tp = e.target.closest('[data-tempoh]');
      if (tp) { f.tempoh = tp.dataset.tempoh; refresh(); return; }
      const st = e.target.closest('[data-step]');
      if (st) {
        const box = st.closest('[data-stepper]');
        const k = box.dataset.stepper;
        const min = k === 'kuantiti' ? 1 : 0;
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
          } else if (act === 'imbas') {
            await ctx.ensureAuth();
            const res = await scanPermit(src && mode === 'sunting' ? src.id : f.nama || 'Permit baru');
            if (!res) return;
            f.permitAsal = res.link;
            const pb = el.querySelector('[data-act="permit"]');
            pb.className = 'fbtn done';
            pb.innerHTML = `${I.check}<span>Permit asal disimpan</span>`;
            const num = await confirmNumber(res.candidates, f.noPermit);
            if (num) { f.noPermit = num; $('#f-noPermit').value = num; }
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
      if (!f.mula) errs.push(['mula', 'Isi tarikh mula.']);
      if (!f.tamat) errs.push(['tamat', 'Isi tarikh tamat.']);
      if (f.mula && f.tamat && f.tamat < f.mula) errs.push(['tamat', 'Tarikh tamat lebih awal dari tarikh mula.']);
      el.querySelectorAll('.inp.err').forEach((x) => x.classList.remove('err'));
      if (errs.length) {
        errs.forEach(([k]) => { const x = $(`#f-${k}`); if (x) x.classList.add('err'); });
        const first = $(`#f-${errs[0][0]}`);
        if (first) first.focus();
        toast(errs[0][1], 'err');
        return;
      }
      const data = {};
      for (const k of INPUT_KEYS) {
        if (k === 'id') continue;
        let v = f[k];
        if (typeof v === 'string') { v = v.trim(); if (UPPER.has(k)) v = v.toUpperCase(); }
        data[k] = v;
      }
      if (data.tempoh !== 'BERMUSIM') { data.k10 = data.k10 || null; data.k20 = data.k20 || null; data.hiburan = data.hiburan || null; }
      busy(btn, true, 'Menyimpan…');
      try {
        if (mode === 'sunting') {
          const changes = {};
          for (const [k, v] of Object.entries(data)) if (!same(v, orig[k])) changes[k] = v ?? '';
          await ctx.withAuth(() => updateRecord(src.id, changes));
          toast(Object.keys(changes).length ? 'Perubahan disimpan.' : 'Tiada perubahan.', 'ok');
          ctx.go(`#/permit/${encodeURIComponent(src.id)}`);
        } else {
          const newId = await ctx.withAuth(() => addRecord(data));
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
