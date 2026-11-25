// Pautan lihat sahaja untuk anggota ronda dan ketua, tanpa log masuk. Nama 'ketua' dalam alamat dan TETAPAN dikekalkan supaya pautan lama terus berfungsi. Data datang dari skrip Google milik admin, bukan terus dari Sheet.
// Bentuk pautan: <app>/#/ketua/<ID skrip>/<kunci>. Bahagian selepas # tidak dihantar ke pelayan web.
import { CONFIG } from './config.js';

const SIMPAN = 'amp-ketua';
const RE = /#\/ketua\/([A-Za-z0-9_-]{20,})\/([A-Za-z0-9]{24,64})(?![A-Za-z0-9])/;

export class PautanError extends Error {}

export function parseKetua(teks) {
  const m = String(teks || '').match(RE);
  return m ? { skrip: m[1], kunci: m[2] } : null;
}

export function ketuaTersimpan() {
  try {
    const k = JSON.parse(localStorage.getItem(SIMPAN) || 'null');
    return k && k.skrip && k.kunci ? k : null;
  } catch { return null; }
}

export function simpanKetua(k) {
  try { localStorage.setItem(SIMPAN, JSON.stringify(k)); } catch {}
}

export function buangKetua() {
  try {
    localStorage.removeItem(SIMPAN);
    localStorage.removeItem('amp-cache:ketua');
  } catch {}
}

export const samaKetua = (a, b) => !!a && !!b && a.skrip === b.skrip && a.kunci === b.kunci;

export const pautanKetua = (k) => `${location.origin}${location.pathname}#/ketua/${k.skrip}/${k.kunci}`;

// Kunci rawak: huruf kecil dan nombor, bermula dengan huruf supaya Sheet tidak membacanya sebagai nombor.
export function kunciBaharu() {
  const abjad = 'abcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(31));
  return 'k' + Array.from(r, (x) => abjad[x % abjad.length]).join('');
}

export async function ambilDataKetua(k) {
  let res;
  try {
    res = await fetch(`${CONFIG.skripKetua}${k.skrip}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ k: k.kunci }),
      credentials: 'omit',
      redirect: 'follow',
    });
  } catch {
    const e = new Error('Tiada sambungan internet, atau pautan ini sudah tidak berfungsi.');
    e.offline = true;
    throw e;
  }
  let j = null;
  try { j = await res.json(); } catch {}
  if (j && j.ok && Array.isArray(j.d) && Array.isArray(j.t)) return j;
  if (j && j.ralat === 'kunci') throw new PautanError('Pautan ini sudah ditukar atau dimatikan. Minta pautan baharu daripada admin.');
  throw new Error('Data tidak dapat dimuatkan. Cuba lagi sebentar.');
}
