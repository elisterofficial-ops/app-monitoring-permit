import { I } from '../icons.js';
import { esc } from '../util.js';
import { installCard } from '../install.js';

export function loginView({ needSheet, hasCache, error = '' }) {
  return `<div class="login">
    <img class="login-logo" src="icons/icon-192.png" alt="" width="96" height="96">
    <h1 class="h1">APP Monitoring Permit</h1>
    <p class="sub">Pemantauan permit Bahagian Penguatkuasa</p>
    ${needSheet ? `<div class="fld"><label class="lbl" for="sheet-url">Pautan Google Sheet permit</label>
      <input id="sheet-url" class="inp" type="url" placeholder="https://docs.google.com/spreadsheets/d/…" autocomplete="off">
      <div class="hint">Tampal sekali sahaja. Admin boleh kongsi pautan app yang sudah mengandungi Sheet. Ketua jabatan: tampal pautan ketua di sini, tanpa log masuk Google.</div></div>` : ''}
    <button type="button" class="btn google big" id="btn-login">${I.google}<span>Log masuk dengan Google</span></button>
    ${hasCache ? '<button type="button" class="btn ghost wide" id="btn-offline">Lihat data simpanan (luar talian)</button>' : ''}
    <p class="err" id="login-err" role="alert">${esc(error)}</p>
    ${installCard()}
    <p class="fine">Log masuk untuk admin dan focal person sahaja. Ketua jabatan guna pautan khas daripada admin, tanpa log masuk.</p>
    <p class="fine">Data permit kekal dalam Google Sheet jabatan. App ini membaca dan menulis menggunakan akaun Google awak sendiri.</p>
  </div>`;
}
