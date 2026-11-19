// Komponen paparan yang dikongsi semua skrin.
import { I } from './icons.js';
import { esc, statusCls, fmtDate, scase, tcase } from './util.js';

export function badge(status) {
  return `<span class="badge ${statusCls(status)}">${esc(status || '-')}</span>`;
}

let toastTimer;
export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'err' ? 5200 : 3200);
}

export function openSheet(html, onMount, onClose) {
  const root = document.getElementById('sheet-root');
  root.innerHTML = `<div class="sheet-backdrop" data-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip" aria-hidden="true"></div>${html}</div>`;
  root.classList.add('open');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.classList.remove('open');
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const sheet = root.querySelector('.sheet');
  if (onMount) onMount(sheet, close);
  const f = sheet.querySelector('input, button:not([data-close])');
  if (f) f.focus({ preventScroll: true });
  return close;
}

export function busy(btn, on, text = 'Sebentar…') {
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span>${esc(text)}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

export function header(title, { back = '#/utama', right = '', sub = '' } = {}) {
  return `<header class="hbar">
    <a class="icon-btn" href="${back}" data-back aria-label="Kembali">${I.back}</a>
    <div class="hbar-t"><div class="hbar-title">${esc(title)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
    ${right}
  </header>`;
}

export function empty(title, text = '', action = '') {
  return `<div class="empty"><div class="empty-t">${esc(title)}</div>${text ? `<div class="sub">${esc(text)}</div>` : ''}${action}</div>`;
}

export function recordCard(r, { renewed } = {}) {
  const dim = r.status === 'DIPERBAHARUI' || r.status === 'SELESAI';
  let when = '';
  if (r.tamat) {
    if (r.status === 'SAH' || r.status === 'AKAN TAMAT') when = `Tamat ${fmtDate(r.tamat)} · tinggal ${r.baki} hari`;
    else if (r.status === 'TAMAT') when = `Tamat ${fmtDate(r.tamat)} · ${Math.abs(r.baki)} hari lalu`;
    else when = `${r.status === 'SELESAI' ? 'Selesai' : 'Tamat'} ${fmtDate(r.tamat)}`;
  }
  const meta = [scase(r.jenis), r.noPermit || r.id, r.kawasan ? tcase(r.kawasan) : '', r.kuantiti ? `${r.kuantiti} ${r.unitKuantiti || ''}`.trim() : '']
    .filter(Boolean).map(esc).join(' · ');
  return `<a class="rcard${dim ? ' dim' : ''}" href="#/permit/${encodeURIComponent(r.id)}">
    <div class="rcard-top"><div class="rcard-name">${esc(r.nama)}</div>${badge(r.status)}</div>
    <div class="sub">${meta}</div>
    <div class="rcard-foot"><span>${esc(when)}</span>${r.idLama ? `<span class="violet">Pembaharuan ${esc(r.idLama)}</span>` : renewed ? `<span class="muted">Diperbaharui</span>` : ''}</div>
  </a>`;
}

export function stepper(name, label, value, { hint = '' } = {}) {
  const v = Number(value || 0);
  return `<div class="stepper${v ? ' on' : ''}" data-stepper="${name}">
    <div class="stepper-l">${esc(label)}${hint ? ` <span class="muted">· ${esc(hint)}</span>` : ''}</div>
    <div class="stepper-c">
      <button type="button" class="st-btn" data-step="-1" aria-label="Kurangkan ${esc(label)}">−</button>
      <output class="st-v" aria-live="polite">${v}</output>
      <button type="button" class="st-btn" data-step="1" aria-label="Tambah ${esc(label)}">+</button>
    </div>
  </div>`;
}

export function initials(name, email) {
  const s = String(name || email || '?').trim();
  return s.charAt(0).toUpperCase();
}

// Kongsi fail (cth. PDF ke WhatsApp) guna menu kongsi telefon; jika tidak disokong, muat turun.
export async function shareFile(blob, filename, text = '') {
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename, text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancel';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return 'downloaded';
}

// Pemilih gambar. Input dilekatkan pada halaman dan dirujuk dari luar: input yang terapung boleh dibuang
// oleh telefon semasa kamera terbuka, lalu gambar yang diambil tidak sampai ke app.
let activeInput = null;
export function pickFile({ capture = true } = {}) {
  return new Promise((resolve) => {
    if (activeInput) activeInput.remove();
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    if (capture) inp.setAttribute('capture', 'environment');
    inp.setAttribute('aria-hidden', 'true');
    inp.tabIndex = -1;
    inp.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(inp);
    activeInput = inp;
    let done = false;
    const finish = (f) => {
      if (done) return;
      done = true;
      setTimeout(() => { inp.remove(); if (activeInput === inp) activeInput = null; }, 0);
      resolve(f);
    };
    inp.addEventListener('change', () => finish(inp.files && inp.files[0] ? inp.files[0] : null));
    inp.addEventListener('cancel', () => finish(null));
    inp.click();
  });
}

export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Peranti ini tidak menyokong lokasi.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`),
      (e) => reject(new Error(e.code === 1 ? 'Akses lokasi ditolak. Benarkan lokasi untuk app ini.' : 'Lokasi tidak dapat dikesan. Cuba di kawasan terbuka.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}
