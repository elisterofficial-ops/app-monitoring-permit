// Imbas gambar: permit / surat kelulusan (isi borang) dan resit (isi bayaran). Teks dibaca dengan OCR Google Drive.
import { esc, isoDate, today, fmtDate, fmtRM, scase } from '../util.js';
import { state, compressImage, uploadPhoto, ocrText, ocrPermit } from '../store.js';
import { parsePermit, parseResit, findMatch } from '../imbas.js';
import { pickFile, openSheet, toast } from '../ui.js';
import { AuthError } from '../google.js';

// Draf hasil imbasan permit, dipakai oleh borang selepas skrin Tambah.
export const draft = { v: null };

const opts = () => ({ jenis: state.tetapan.jenis.map((j) => j.jenis), kawasan: state.tetapan.kawasan });

// Imbas permit: simpan gambar sebagai Permit Asal, baca teks dan isi medan.
// step(teks) dipanggil untuk kemas kini teks butang semasa proses.
export async function imbasPermit({ capture = true, step = () => {} } = {}) {
  const file = await pickFile({ capture });
  if (!file) return null;
  step('Menyediakan gambar…');
  const blob = await compressImage(file);
  step('Membaca teks permit…');
  let text = '';
  try { text = await ocrText(blob, 'permit'); } catch (e) { if (e instanceof AuthError) throw e; text = ''; }
  const { fields, calon, info } = parsePermit(text, opts());
  step('Menyimpan gambar permit…');
  const label = fields.nama || 'Permit baru';
  const up = await uploadPhoto(blob, `${label} - permit asal ${isoDate(today())}.jpg`);
  const d = {
    fields, calon, info, text,
    keys: Object.keys(fields),
    permitAsal: up.webViewLink,
    thumb: URL.createObjectURL(blob),
    match: findMatch(fields, state.records),
  };
  draft.v = d;
  return d;
}

// Imbas resit: tidak disimpan, hanya teks dibaca untuk jumlah, No. resit dan tarikh bayar.
export async function imbasResit({ capture = true, step = () => {} } = {}) {
  const file = await pickFile({ capture });
  if (!file) return null;
  step('Membaca resit…');
  const blob = await compressImage(file);
  const text = await ocrText(blob, 'resit');
  return parseResit(text).fields;
}

// Tanya sama ada rekod sedia ada patut dilengkapkan. Pulangkan 'lengkap', 'baru' atau null (batal).
export function askMatch(m) {
  const r = m.r;
  return new Promise((resolve) => {
    let done = false;
    const close = openSheet(`
      <h2 class="h2">Rekod ini sudah ada</h2>
      <p class="sub">${esc(m.sebab)}. Permit yang diimbas nampaknya untuk rekod di bawah. Lengkapkan rekod ini supaya tiada rekod berganda.</p>
      <div class="rcard">
        <div class="rcard-top"><div class="rcard-name">${esc(r.nama)}</div><span class="pill cyan">${esc(r.id)}</span></div>
        <div class="sub">${esc([scase(r.jenis), r.mula ? `${fmtDate(r.mula)} hingga ${fmtDate(r.tamat) || '-'}` : '', r.dibayar ? fmtRM(r.dibayar) : ''].filter(Boolean).join(' · '))}</div>
      </div>
      <button type="button" class="btn primary big" id="m-ok">Lengkapkan rekod ini</button>
      <button type="button" class="btn ghost wide" id="m-new">Tambah sebagai permit baru</button>`, (sheet) => {
      sheet.querySelector('#m-ok').addEventListener('click', () => { done = true; close(); resolve('lengkap'); });
      sheet.querySelector('#m-new').addEventListener('click', () => { done = true; close(); resolve('baru'); });
    }, () => { if (!done) resolve(null); });
  });
}

// Imbasan lama (butang Imbas di sebelah No. permit dan di skrin Butiran): gambar permit + calon No. permit.
export async function scanPermit(label) {
  const file = await pickFile();
  if (!file) return null;
  toast('Memuat naik gambar permit…');
  const blob = await compressImage(file);
  const up = await uploadPhoto(blob, `${label || 'Permit baru'} - permit asal ${isoDate(today())}.jpg`);
  toast('Membaca nombor permit dari gambar…');
  let candidates = [];
  try { candidates = await ocrPermit(blob); } catch { candidates = []; }
  return { link: up.webViewLink, candidates };
}

// Tunjuk calon No. permit untuk disahkan. Pulangkan nombor yang dipilih, atau null.
export function confirmNumber(candidates, current = '') {
  return new Promise((resolve) => {
    let done = false;
    const first = candidates[0] || current || '';
    const close = openSheet(`
      <h2 class="h2">Sahkan No. permit</h2>
      <p class="sub">${candidates.length ? 'Dibaca dari gambar. Betulkan jika ada huruf yang salah.' : 'Nombor tidak dapat dibaca dari gambar. Taip sendiri, gambar tetap disimpan.'}</p>
      <label class="lbl" for="np">No. permit</label>
      <input id="np" class="inp" value="${esc(first)}" autocomplete="off" autocapitalize="characters">
      ${candidates.length > 1 ? `<div class="chips">${candidates.map((c) => `<button type="button" class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
      <div class="row2">
        <button type="button" class="btn ghost" data-close>Langkau</button>
        <button type="button" class="btn primary" id="np-ok">Guna nombor ini</button>
      </div>`, (sheet) => {
      const inp = sheet.querySelector('#np');
      sheet.addEventListener('click', (e) => {
        const c = e.target.closest('[data-c]');
        if (c) inp.value = c.dataset.c;
      });
      sheet.querySelector('#np-ok').addEventListener('click', () => {
        done = true;
        const v = inp.value.trim().toUpperCase() || null;
        close();
        resolve(v);
      });
    }, () => { if (!done) resolve(null); });
  });
}
