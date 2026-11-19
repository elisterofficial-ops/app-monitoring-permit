// Imbas gambar permit: muat naik gambar sebagai Permit Asal, baca No. permit (OCR), pengguna sahkan.
import { esc, isoDate, today } from '../util.js';
import { compressImage, uploadPhoto, ocrPermit } from '../store.js';
import { pickFile, openSheet, toast } from '../ui.js';

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
