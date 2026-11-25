// Panduan pasang app ikut jenis telefon dan browser.
// Browser dalam app lain (WhatsApp, Claude, Facebook dan lain-lain) tidak boleh memasang app,
// jadi pengguna diminta buka pautan dalam Chrome (Android) atau Safari (iPhone).
import { I } from './icons.js';
import { esc } from './util.js';
import { ketuaTersimpan, pautanKetua } from './ketua.js';

const ua = navigator.userAgent || '';
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/i.test(ua);
const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Messenger|Telegram|GSA\/|; wv\)|Claude/i.test(ua);
const iosOther = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
const samsung = /SamsungBrowser/i.test(ua);

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function appLink() {
  const k = ketuaTersimpan();
  if (k) return pautanKetua(k);
  let sheet = '';
  try { sheet = localStorage.getItem('amp-sheet') || ''; } catch {}
  const base = location.origin + location.pathname;
  return sheet ? `${base}?sheet=${encodeURIComponent(sheet)}` : base;
}

export function sheetLink() {
  if (ketuaTersimpan()) return '';
  let sheet = '';
  try { sheet = localStorage.getItem('amp-sheet') || ''; } catch {}
  return sheet ? `https://docs.google.com/spreadsheets/d/${sheet}/edit` : '';
}

function chromeIntent() {
  const u = new URL(appLink());
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
}

const step = (n, html) => `<li><span class="stepn">${n}</span><span>${html}</span></li>`;

export function installCard({ title = true } = {}) {
  if (isStandalone()) return '';
  const copyBtn = `<button type="button" class="btn ghost sm" data-copy="${esc(appLink())}">${I.copy}Salin pautan app</button>`;
  let body = '';
  if (window.__ampInstall) {
    body = `<button type="button" class="btn primary wide" data-install>${I.install}Pasang APP Monitoring Permit</button>`;
  } else if (isIOS) {
    const sl = sheetLink();
    if (inApp || iosOther) {
      body = `<p class="sub2">Pautan ini dibuka dalam browser app lain, yang tidak boleh memasang app. Salin pautan, buka app <b>Safari</b>, tampal di bar alamat, kemudian ikut langkah pasang.</p>
        <div class="row-btns">${copyBtn}</div>`;
    } else {
      body = `<ol class="steps">
        ${sl ? step(1, `Salin pautan Sheet dahulu. App di skrin utama akan memintanya sekali. <button type="button" class="link" data-copy="${esc(sl)}">Salin pautan Sheet</button>`) : ''}
        ${step(sl ? 2 : 1, 'Tekan butang <b>Kongsi</b> (kotak dengan anak panah ke atas). Dalam iOS 26, tekan <b>⋯</b> dahulu, kemudian <b>Share</b>.')}
        ${step(sl ? 3 : 2, 'Skrol ke bawah, pilih <b>Add to Home Screen</b>, pastikan <b>Open as Web App</b> hidup, kemudian <b>Add</b>.')}
        ${step(sl ? 4 : 3, 'Buka app dari ikon di skrin utama.')}
      </ol>
      <p class="hint">Tiada pilihan Add to Home Screen? Pautan mungkin dibuka dari app lain (WhatsApp, Claude). Tekan ikon kompas atau <b>Open in Safari</b> dahulu.</p>`;
    }
  } else if (isAndroid) {
    // Pautan intent tidak boleh membawa bahagian selepas #, jadi pautan ketua hanya boleh disalin.
    const open = ketuaTersimpan() ? '' : `<a class="btn primary sm" href="${esc(chromeIntent())}">${I.ext}Buka dalam Chrome</a>`;
    if (inApp) {
      body = `<p class="sub2">Pautan ini dibuka dalam browser app lain, yang tidak boleh memasang app. Buka dalam Chrome dahulu.</p>
        <div class="row-btns">${open}${copyBtn}</div>`;
    } else if (samsung) {
      body = `<ol class="steps">${step(1, 'Tekan menu <b>☰</b> di bawah.')}${step(2, 'Pilih <b>Tambah halaman ke</b> → <b>Skrin utama</b>.')}</ol>`;
    } else {
      body = `<ol class="steps">
        ${step(1, 'Tekan menu <b>⋮</b> di penjuru kanan atas Chrome.')}
        ${step(2, 'Pilih <b>Pasang app</b> atau <b>Tambah ke skrin utama</b>, kemudian <b>Pasang</b>.')}
      </ol>
      <p class="hint">Menu tiada pilihan itu? Pautan mungkin dibuka dari app lain (WhatsApp, Claude). Tekan butang di bawah.</p>
      <div class="row-btns">${open}${copyBtn}</div>`;
    }
  } else {
    body = '<p class="sub2">Di komputer, tekan ikon pasang di hujung bar alamat Chrome atau Edge. Untuk telefon, buka pautan app dalam Chrome (Android) atau Safari (iPhone).</p>';
  }
  return `<section class="card install-card">${title ? `<h2 class="h2">Pasang di telefon</h2>` : ''}${body}</section>`;
}
