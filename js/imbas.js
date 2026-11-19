// Baca teks OCR surat kelulusan / permit majlis dan resit bayaran, kemudian pulangkan medan untuk borang.
// Fungsi tulen (tiada DOM, tiada rangkaian) supaya mudah diuji.
import { ymd, diffDays, norm } from './util.js';

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

// Blok penerima: baris selepas "Ruj. Kami" (atau "Kepada") hingga "Tuan," / "Puan,".
function penerima(lines) {
  let s = lines.findIndex((l) => /^\s*ruj/i.test(l) || /\bruj\.?\s*(kami|tuan)/i.test(l));
  if (s < 0) s = lines.findIndex((l) => /^\s*kepada\b/i.test(l));
  const e = lines.findIndex((l, i) => i > s && SALAM.test(l));
  if (s < 0 || e < 0 || e - s > 14) return null;
  const blok = lines.slice(s + 1, e).map(cleanLine).filter((l) => l && !BISING.test(l) && !/^kepada$/i.test(l));
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

/** Teks OCR resit bayaran: jumlah, No. resit dan tarikh bayar. */
export function parseResit(text) {
  const t = String(text || '').replace(/\r/g, '');
  const f = {};
  const no = t.match(/(?:no\.?\s*(?:resit|receipt|resi)|(?:resit|receipt)\s*(?:no\.?|number|#))\s*[:.#]?\s*([A-Z0-9][A-Z0-9/-]{3,30})/i);
  if (no) f.resit = no[1].toUpperCase();
  const amt = amount(t, 'jumlah|amaun|total|amount|bayaran|dibayar|paid|tunai|cash');
  if (amt) f.dibayar = amt;
  const lab = t.match(/(?:tarikh|date)\s*[:.]?\s*([^\n]{0,30})/i);
  const d = (lab && findDates(lab[1])[0]) || findDates(t)[0];
  if (d) f.tarikhBayar = d.date;
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
  const near = (a, b) => a && b && Math.abs(diffDays(a, b)) <= 3;
  const cands = records.filter((x) => sameName(x.nama, fields.nama) && (!fields.jenis || x.jenis === fields.jenis));
  const r = cands.find((x) => near(x.mula, fields.mula) || near(x.tamat, fields.tamat));
  return r ? { r, sebab: 'Nama dan tarikh sama' } : null;
}
