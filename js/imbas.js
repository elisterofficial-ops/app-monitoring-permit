// Baca teks OCR surat kelulusan / permit majlis dan resit bayaran, kemudian pulangkan medan untuk borang.
// Fungsi tulen (tiada DOM, tiada rangkaian) supaya mudah diuji.
import { ymd, diffDays, norm, addDays, addMonths } from './util.js';

const BULAN = {
  jan: 0, januari: 0, january: 0, feb: 1, februari: 1, february: 1, mac: 2, mar: 2, march: 2, apr: 3, april: 3,
  mei: 4, may: 4, jun: 5, june: 5, jul: 6, julai: 6, july: 6, ogo: 7, ogos: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, okt: 9, oktober: 9, oct: 9, october: 9, nov: 10, november: 10,
  dis: 11, disember: 11, dec: 11, december: 11,
};

const valid = (y, m, d) => y >= 2000 && y <= 2100 && m >= 0 && m <= 11 && d >= 1 && d <= 31;

// Semua tarikh dalam teks, ikut kedudukan: 01.11.2026, 1/11/2026, 1 November 2026, 1 Nov 2026.
export function findDates(text) {
  const out = [];
  const t = String(text || '');
  for (const m of t.matchAll(/\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})\b/g)) {
    const [d, mo, y] = [+m[1], +m[2] - 1, +m[3]];
    if (valid(y, mo, d)) out.push({ date: ymd(y, mo, d), i: m.index, end: m.index + m[0].length });
  }
  for (const m of t.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g)) {
    const mo = BULAN[m[2].toLowerCase()];
    const [d, y] = [+m[1], +m[3]];
    if (mo != null && valid(y, mo, d)) out.push({ date: ymd(y, mo, d), i: m.index, end: m.index + m[0].length });
  }
  return out.sort((a, b) => a.i - b.i);
}

const JOIN = /^[\s(]*(?:-|–|—|~|sehingga|hingga|sampai|to|until|s\/d)[\s)]*$/i;
const START = /(mulai|bermula|dari|daripada|tempoh|from|menggunakan|berkuat\s*kuasa)[^\n]{0,60}$/i;

// Julat tarikh (mula hingga tamat). Utamakan julat yang didahului "mulai", "dari" atau "tempoh".
export function findRange(text) {
  const t = String(text || '');
  const ds = findDates(t);
  const ranges = [];
  for (let k = 0; k + 1 < ds.length; k++) {
    const a = ds[k];
    const b = ds[k + 1];
    if (!JOIN.test(t.slice(a.end, b.i)) || b.date < a.date) continue;
    ranges.push({ mula: a.date, tamat: b.date, i: a.i, kuat: START.test(t.slice(Math.max(0, a.i - 80), a.i)) });
  }
  return ranges.find((r) => r.kuat) || ranges[0] || null;
}

// No. permit: "MDS/700/1 JLD.2 (34)" jadi "MDS/700/1 JLD.2(34)".
export function cleanPermitNo(s) {
  return String(s || '').toUpperCase()
    .replace(/[|]/g, '/')
    .replace(/\s+/g, ' ')
    .replace(/\s*([/.()])\s*/g, '$1')
    .replace(/[.,;:]+$/, '')
    .trim();
}

const MDS = /M\s?D\s?S\s*\/[\s\S]{0,40}?\(\s*\d{1,4}\s*\)/gi;

export function permitNumbers(text) {
  const t = String(text || '');
  const first = [];
  const other = [];
  const m1 = t.match(/(?:permit|lesen)\s+(?:bernombor|bernomber|nombor|no\.?)\s*[:.]?\s*(M\s?D\s?S\s*\/[\s\S]{0,40}?\(\s*\d{1,4}\s*\))/i)
    || t.match(/(?:no\.?|nombor)\s*(?:permit|lesen)\s*[:.]?\s*(M\s?D\s?S\s*\/[\s\S]{0,40}?\(\s*\d{1,4}\s*\))/i);
  if (m1) first.push(cleanPermitNo(m1[1]));
  for (const m of t.matchAll(MDS)) {
    const before = t.slice(Math.max(0, m.index - 30), m.index);
    if (/ruj/i.test(before)) continue; // Ruj. Kami / Ruj. Tuan ialah nombor fail surat, bukan nombor permit.
    other.push(cleanPermitNo(m[0]));
  }
  for (const m of t.matchAll(/(?:no\.?\s*(?:permit|lesen|siri)|permit\s*no\.?)\s*[:-]?\s*([A-Z0-9][A-Z0-9./()-]{2,40})/gi)) other.push(cleanPermitNo(m[1]));
  return [...new Set([...first, ...other])].filter((x) => x.length >= 5).slice(0, 5);
}

const toAmt = (s) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return isFinite(n) ? n : null;
};

const AMT = '([\\d,]+(?:\\.\\d{1,2})?)';

function amount(text, words) {
  const t = String(text || '');
  const m = t.match(new RegExp(`sebanyak\\s*(?:RM|MYR)\\s*${AMT}`, 'i'))
    || t.match(new RegExp(`(?:${words})[^\\n\\d]{0,40}(?:RM|MYR)\\s*${AMT}`, 'i'));
  if (m) return toAmt(m[1]);
  const all = [...t.matchAll(new RegExp(`(?:RM|MYR)\\s*${AMT}`, 'gi'))].map((x) => toAmt(x[1])).filter((n) => n != null);
  return all.length ? Math.max(...all) : null;
}

const JENIS = [
  [/giant\s*banner/i, 'GIANT BANNER'],
  [/fish\s*tail|streamer/i, 'FISHTAIL'],
  [/banner|kain\s*rentang|bunting/i, 'BANNER'],
  [/papan\s*(?:tanda|iklan|nama)|sign\s*board/i, 'SIGNBOARD'],
  [/kaki\s*lima|siar\s*kaki/i, 'KAKI LIMA'],
  [/roller\s*shutt?er|pintu\s*gulung/i, 'ROLLER SHUTTER'],
  [/terminal\s*bas/i, 'SEWAAN TERMINAL BAS'],
  [/pesta\s*ria|hiburan\s*awam\s*sementara|fun\s*fair/i, 'PESTA RIA'],
  [/lesen\s*hiburan/i, 'LESEN HIBURAN'],
  [/(?:petak|tempat|lot)\s*letak\s*(?:kereta|kenderaan)|parking|parkir/i, 'PARKING'],
];

// Jenis permit dari tajuk surat; jika tiada, kata kunci yang paling awal muncul.
function jenisOf(subject, body, list) {
  const ok = (j) => !list.length || list.includes(j);
  for (const src of [subject, body]) {
    if (!src) continue;
    let best = null;
    for (const [re, j] of JENIS) {
      if (!ok(j)) continue;
      const m = re.exec(src);
      if (m && (!best || m.index < best.i)) best = { i: m.index, j };
    }
    if (best) return best.j;
  }
  return '';
}

const KAWASAN_LEMAH = new Set(['BAZAAR', 'JAYA', 'PASAR', 'TOWN']);

function kawasanOf(text, list) {
  const t = String(text || '');
  let best = null;
  const names = [...list].sort((a, b) => b.length - a.length);
  for (const k of names) {
    const words = k.split(/\s+/);
    const alts = [words];
    const tanpa = words.filter((w) => w !== 'SERIAN');
    if (tanpa.length && tanpa.length < words.length && !(tanpa.length === 1 && KAWASAN_LEMAH.has(tanpa[0]))) alts.push(tanpa);
    for (const ws of alts) {
      const re = new RegExp(`\\b${ws.map((w) => (w === 'PIAZZA' ? 'PIAZ?ZA' : w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('[\\s-]*')}\\b`, 'i');
      const m = re.exec(t);
      if (m && (!best || m.index < best.i || (m.index === best.i && k.length > best.k.length))) best = { i: m.index, k };
    }
  }
  return best ? best.k : '';
}

const SALAM = /^\s*(tuan|puan|tuan\s*\/\s*puan|sir|madam|dear)\b[\s,]*$/i;
const BISING = /tarikh\s*:|^\s*date\b|e-?mail|laman\s*web|https?:|www\.|tel\.?\s*[:.]|faks|fax|^\s*ruj/i;
const SYARIKAT = /\b(sdn\.?\s*bhd|bhd|berhad|enterprise|trading|plt|company|co\.|store|centre|center|furniture|electrical|motor\w*|restoran|restaurant|caf[eé]|kedai|syarikat|pharmacy|mart|marketing|holdings?|services?|agency|jabatan|pejabat|management|retail|industries|sdn)\b/i;

function cleanLine(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/^[\s,.;:]+|[\s,;:]+$/g, '').trim();
}

// Alamat dua baris: baris 1 nombor dan jalan, baris 2 poskod dan bandar.
function alamatOf(lines) {
  const ls = lines.map(cleanLine).filter(Boolean);
  if (!ls.length) return '';
  const p = ls.findIndex((l) => /\b\d{5}\b/.test(l));
  if (p <= 0) return ls.map((l) => l.replace(/[.,]+$/, '')).join(', ');
  const l1 = ls.slice(0, p).map((l) => l.replace(/[.,]+$/, '')).join(', ');
  const l2 = ls.slice(p).map((l) => l.replace(/[.,]+$/, '')).join(', ');
  return `${l1}\n${l2}`;
}

// Baris yang menamatkan blok penerima bila dibaca ke atas dari "Tuan," / "Puan,":
// nombor rujukan surat, tarikh, kepala surat majlis atau maklumat hubungan.
const ATAS = /\b[rk]?uj\.?\s*(kami|tuan)|rujukan|M\s?D\s?S\s*\/|tarikh\s*:|^\s*date\b|kepada\s*:?\s*$|majlis\s+daerah|jalan\s+bunga\s+tanjung|\be-?m(?:ai|e)l\b|laman\s*web|https?:|www\.|\btel\b|faks|fax/i;

// Blok penerima: baris sebelum "Tuan," / "Puan,", dibaca ke atas hingga baris rujukan, tarikh atau kepala surat.
// Tidak bergantung pada "Ruj. Kami" kerana OCR kadang-kadang tersilap baca huruf pertamanya.
function penerima(lines) {
  const e = lines.findIndex((l) => SALAM.test(l));
  if (e < 1) return null;
  const blok = [];
  for (let i = e - 1; i >= 0 && blok.length < 8; i--) {
    const l = cleanLine(lines[i]);
    if (!l) continue;
    if (ATAS.test(l)) break;
    blok.unshift(l);
  }
  if (!blok.length) return null;
  const syarikat = (s) => s.replace(/\bSdn\.?\s*Bhd\.?/i, 'Sdn Bhd').replace(/[.,]+$/, '');
  const c = blok.findIndex((l) => SYARIKAT.test(l));
  if (c >= 0) {
    const sebelum = c > 0 ? blok[c - 1] : '';
    const orang = sebelum && !/\d/.test(sebelum) ? sebelum : '';
    return { nama: syarikat(blok[c]), pengurus: orang, alamat: alamatOf(blok.slice(c + 1)), salam: e };
  }
  return { nama: syarikat(blok[0]), pengurus: '', alamat: alamatOf(blok.slice(1)), salam: e };
}

// Tajuk surat: baris selepas "Tuan," sebelum "Dengan segala hormat".
function tajuk(lines, salam) {
  if (salam == null || salam < 0) return '';
  const out = [];
  for (let i = salam + 1; i < Math.min(lines.length, salam + 6); i++) {
    if (/dengan\s+(segala\s+)?hormat|merujuk|adalah\s+saya/i.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join(' ');
}

function kuantitiOf(text) {
  const m = String(text || '').match(/\b(\d{1,3})\s*(?:\(\s*[a-z\s]+\)\s*)?(?:petak|lot|unit|keping|helai|buah)\b/i);
  return m ? +m[1] : null;
}

/**
 * Teks OCR surat kelulusan atau permit.
 * @param {string} text
 * @param {{jenis?: string[], kawasan?: string[]}} opts senarai dari TETAPAN
 * @returns {{fields: object, calon: string[], info: object}}
 */
export function parsePermit(text, opts = {}) {
  const t = String(text || '').replace(/\r/g, '').replace(/ /g, ' ');
  const lines = t.split('\n');
  const f = {};
  const info = {};

  const calon = permitNumbers(t);
  if (calon[0]) f.noPermit = calon[0];

  const p = penerima(lines);
  if (p) {
    if (p.nama) f.nama = p.nama;
    if (p.pengurus) f.pengurus = p.pengurus;
    if (p.alamat) f.alamat = p.alamat;
  }
  const subj = tajuk(lines, p ? p.salam : -1);
  const body = p ? lines.slice(p.salam + 1).join('\n') : t;

  const jenis = jenisOf(subj, body, opts.jenis || []);
  if (jenis) f.jenis = jenis;

  const r = findRange(body) || findRange(t);
  if (r) { f.mula = r.mula; f.tamat = r.tamat; }

  if (/one\s*off|sekali\s*bayar/i.test(t)) f.tempoh = 'SEKALI BAYAR';
  else if (r) f.tempoh = diffDays(r.mula, r.tamat) >= 300 ? 'TAHUNAN' : 'BERMUSIM';
  else if (/setahun|1\s*tahun|tahunan|12\s*bulan/i.test(body)) f.tempoh = 'TAHUNAN';

  const amt = amount(body, 'bayaran|jumlah|amaun|sewaan|caj|fi');
  if (amt) f.dibayar = amt;

  const q = kuantitiOf(body.replace(/\blot\s*\d+/gi, ''));
  if (q && f.jenis !== 'KAKI LIMA' && f.jenis !== 'ROLLER SHUTTER') f.kuantiti = q;

  const kaw = kawasanOf(body, opts.kawasan || []);
  if (kaw) f.kawasan = kaw;

  const bertarikh = t.match(/bertarikh\s+([\s\S]{0,25})/i);
  if (bertarikh) {
    const d = findDates(bertarikh[1])[0];
    if (d) info.tarikhPermit = d.date;
  }
  const ts = t.match(/tarikh\s*:\s*([^\n]{0,30})/i);
  if (ts) {
    const d = findDates(ts[1])[0];
    if (d) info.tarikhSurat = d.date;
  }
  if (info.tarikhPermit || info.tarikhSurat) f.tarikhBayar = info.tarikhPermit || info.tarikhSurat;
  return { fields: f, calon, info };
}

// Cop kaunter pada bil yang sudah dibayar, contoh "B7 M1 120000001 01/01/2026 RM 20.00 B7 TUNAI".
function copKaunter(t) {
  const m = t.match(/\b(\d{7,12})\s+(\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4})\s+RM\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const d = findDates(m[2])[0];
  return { resit: m[1], tarikh: d ? d.date : null, amaun: toAmt(m[3]) };
}

export const isBil = (text) => /BIL\s*PELBAGAI|MISCELLANEOUS\s*BILL/i.test(String(text || ''));

// Tarikh tamat dari "(1 hari)", "(2 minggu)", "(6 bulan)" atau "(1 tahun)" selepas tarikh mula.
function tamatDari(mula, s) {
  const m = String(s || '').match(/\(?\s*(\d{1,3})\s*(hari|minggu|bulan|tahun)\s*\)?/i);
  if (!m) return mula;
  const n = +m[1];
  const u = m[2].toLowerCase();
  if (u === 'hari') return addDays(mula, Math.max(1, n) - 1);
  if (u === 'minggu') return addDays(mula, n * 7 - 1);
  return addDays(addMonths(mula, u === 'bulan' ? n : n * 12), -1);
}

/**
 * Bil Pelbagai / Miscellaneous Bill majlis: penerima, keterangan akaun, amaun dan cop kaunter.
 * No. Resit ialah nombor pada cop kaunter; jika bil belum dicop, No. Bil digunakan.
 */
export function parseBil(text, opts = {}) {
  const t = String(text || '').replace(/\r/g, '').replace(/ /g, ' ');
  const lines = t.split('\n');
  const f = {};
  const info = {};

  const h = lines.findIndex((l) => isBil(l));
  const e = lines.findIndex((l, i) => i > h && /^\s*(no\.?\s*bil|bill\s*no|tarikh\s*bil|keterangan|particulars)/i.test(l));
  if (h >= 0 && e > h) {
    const blok = lines.slice(h + 1, e).map(cleanLine).filter((l) => l && !BISING.test(l));
    if (blok.length) {
      f.nama = blok[0].replace(/\bSdn\.?\s*Bhd\.?/i, 'Sdn Bhd').replace(/[.,]+$/, '');
      const al = alamatOf(blok.slice(1));
      if (al) f.alamat = al;
    }
  }

  // Keterangan akaun: dari "PARTICULARS OF ACCOUNT" hingga "Ruj. Kami" (tarikh surat selepas Ruj bukan tarikh permit).
  const pm = t.match(/PARTICULARS\s+OF\s+ACCOUNT\s*([\s\S]*?)(?=[RK]?uj\.?\s*Kami|Sila\s+Jelaskan|\n\s*:|AMAUN|$)/i);
  // Label kotak bil kadang-kadang dibaca di tengah keterangan; buang baris label itu.
  const LABEL = /^\s*(no\.?\s*bil|bill\s*no|tarikh\s*bil|bill\s*date|kod\s*akaun|account\s*code|bil\s*rujukan|bill\s*reference|department)\b.*$/gim;
  const part = pm ? pm[1].replace(LABEL, '').replace(/\s+/g, ' ').trim() : '';
  if (part) info.keterangan = part;

  const jenis = jenisOf(part, part, opts.jenis || []);
  if (jenis) f.jenis = jenis;
  const q = kuantitiOf(part);
  if (q && jenis !== 'KAKI LIMA' && jenis !== 'ROLLER SHUTTER') f.kuantiti = q;

  const r = findRange(part);
  if (r) { f.mula = r.mula; f.tamat = r.tamat; } else {
    const d = findDates(part)[0];
    if (d) { f.mula = d.date; f.tamat = tamatDari(d.date, part.slice(d.end, d.end + 25)); }
  }
  if (f.mula) f.tempoh = diffDays(f.mula, f.tamat) >= 300 ? 'TAHUNAN' : 'BERMUSIM';

  const dpn = part.match(/\b(di\s+(?:hadapan|depan|tepi|sebelah)\s+[^,.;()]+?)(?=\s+untuk\b|\s+pada\b|\s+bagi\b|[,.;(]|$)/i);
  if (dpn) f.kedudukan = dpn[1].charAt(0).toUpperCase() + dpn[1].slice(1);

  const kaw = kawasanOf(`${part}\n${f.alamat || ''}`, opts.kawasan || []);
  if (kaw) f.kawasan = kaw;

  const cop = copKaunter(t);
  const bil = t.match(/^\s*:\s*([A-Z]\d{5,12})\s*$/m) || t.match(/(?:no\.?\s*bil|bill\s*no\.?)\s*[:.]?\s*([A-Z]\d{5,12})/i);
  if (bil) info.noBil = bil[1];
  const tb = t.match(/^\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*$/m);
  if (tb) info.tarikhBil = findDates(tb[1])[0].date;
  const billAmt = t.match(/Bill\s*Amt\s*[:.]?\s*RM\s*([\d,]+(?:\.\d{1,2})?)/i);

  const amt = (cop && cop.amaun) || (billAmt && toAmt(billAmt[1])) || amount(t, 'amaun|amount|jumlah');
  if (amt) f.dibayar = amt;
  if (cop) { f.resit = cop.resit; info.dibayar = true; } else if (info.noBil) f.resit = info.noBil;
  const tarikhBayar = (cop && cop.tarikh) || info.tarikhBil;
  if (tarikhBayar) f.tarikhBayar = tarikhBayar;
  return { fields: f, calon: [], info };
}

// Surat kelulusan atau bil: pilih pembaca ikut jenis dokumen.
export function parseDokumen(text, opts = {}) {
  return isBil(text) ? parseBil(text, opts) : parsePermit(text, opts);
}

const BAYARAN = ['dibayar', 'resit', 'tarikhBayar'];

/** Teks OCR resit atau bil yang dicop: jumlah, No. resit dan tarikh bayar. */
export function parseResit(text) {
  const t = String(text || '').replace(/\r/g, '');
  if (isBil(t)) {
    const b = parseBil(t).fields;
    return { fields: Object.fromEntries(BAYARAN.filter((k) => b[k] != null).map((k) => [k, b[k]])) };
  }
  const f = {};
  const cop = copKaunter(t);
  const no = t.match(/(?:no\.?\s*(?:resit|receipt|resi)|(?:resit|receipt)\s*(?:no\.?|number|#))\s*[:.#]?\s*([A-Z0-9][A-Z0-9/-]{3,30})/i);
  if (cop) f.resit = cop.resit;
  else if (no) f.resit = no[1].toUpperCase();
  const amt = (cop && cop.amaun) || amount(t, 'jumlah|amaun|total|amount|bayaran|dibayar|paid|tunai|cash');
  if (amt) f.dibayar = amt;
  const lab = t.match(/(?:tarikh|date)\s*[:.]?\s*([^\n]{0,30})/i);
  const d = (cop && cop.tarikh) || (lab && findDates(lab[1])[0] || findDates(t)[0] || {}).date;
  if (d) f.tarikhBayar = d;
  return { fields: f };
}

// Cari rekod sedia ada yang sama: No. permit sama, atau nama serupa dengan tarikh mula/tamat yang sama.
export function sameName(a, b) {
  const n = (s) => norm(s).replace(/(sdnbhd|bhd|berhad|plt)$/g, '');
  const x = n(a);
  const y = n(b);
  if (x.length < 4 || y.length < 4) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export function findMatch(fields, records) {
  if (fields.noPermit) {
    const k = norm(fields.noPermit);
    const r = records.find((x) => x.noPermit && norm(x.noPermit) === k);
    if (r) return { r, sebab: 'No. permit sama' };
  }
  if (!fields.nama) return null;
  const gap = (a, b) => (a && b ? Math.abs(diffDays(a, b)) : Infinity);
  const jarak = (x) => Math.min(gap(x.mula, fields.mula), gap(x.tamat, fields.tamat));
  const cands = records
    .filter((x) => sameName(x.nama, fields.nama) && (!fields.jenis || x.jenis === fields.jenis) && jarak(x) <= 3)
    .sort((a, b) => jarak(a) - jarak(b));
  return cands[0] ? { r: cands[0], sebab: 'Nama dan tarikh sama' } : null;
}
