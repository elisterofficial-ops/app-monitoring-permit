// Data app: baca dari Google Sheet (DAFTAR, TETAPAN, SURAT), kira ringkasan, dan tulis rekod.
// Lajur dikenal pasti ikut tajuk, jadi susunan lajur dalam Sheet boleh berubah.
import { sheets, drive, docs } from './google.js';
import {
  toDate, numOrNull, str, today, addDays, addMonths, diffDays, fmtLong, dayName, norm, isoDate, toNum, driveId,
} from './util.js';
import { permitNumbers } from './imbas.js';
import { ambilDataKetua } from './ketua.js';

const DAFTAR = 'DAFTAR';
const TETAPAN = 'TETAPAN';
const SURAT = 'SURAT';

export const state = {
  demo: false,
  sheetId: '',
  sheetTitle: '',
  meta: null,
  user: null,
  ownerEmail: '',
  role: 'LIHAT',
  ketua: null,
  cols: {},
  tcols: {},
  scols: {},
  records: [],
  byId: new Map(),
  renewals: new Map(),
  tetapan: { jenis: [], kawasan: [], settings: [], units: [], users: [] },
  surat: [],
  loadedAt: 0,
  offline: false,
};

const COLS = {
  id: ['ID Rekod'],
  jenis: ['Jenis Permit'],
  tempoh: ['Jenis Tempoh'],
  noPermit: ['No. Permit'],
  idLama: ['ID Rekod Terdahulu', 'No. Permit Terdahulu'],
  nama: ['Nama Pemohon / Syarikat', 'Nama Pemohon', 'Nama Syarikat'],
  pengurus: ['Nama Pengurus Premis', 'Nama Pengurus'],
  alamat: ['Alamat'],
  telefon: ['No. Telefon'],
  kawasan: ['Kawasan'],
  kedudukan: ['Kedudukan Petak / Lokasi', 'Kedudukan'],
  kuantiti: ['Kuantiti'],
  k10: ['Khemah 10x10 (bil.)'],
  k20: ['Khemah 20x20 (bil.)'],
  hiburan: ['Hiburan (bil.)'],
  mula: ['Tarikh Mula'],
  tamat: ['Tarikh Tamat'],
  kadarKhas: ['Kadar Khas (RM)'],
  dibayar: ['Jumlah Dibayar (RM)'],
  tarikhBayar: ['Tarikh Bayar'],
  resit: ['No. Resit'],
  koordinat: ['Koordinat (lat, long)', 'Koordinat'],
  permitAsal: ['Permit Asal (pautan)', 'Permit Asal'],
  gambarLokasi: ['Gambar Lokasi (pautan)', 'Gambar Lokasi'],
  catatan: ['Catatan'],
  status: ['Status'],
  baki: ['Baki Hari'],
  tempohHari: ['Tempoh (Hari)'],
  tempohBulan: ['Tempoh (Bulan)'],
  unitKuantiti: ['Unit Kuantiti'],
  asasKadar: ['Asas Kadar'],
  kadar: ['Kadar Digunakan (RM)'],
  jumlah: ['Jumlah Keseluruhan (RM)', 'Jumlah Sepatutnya (RM)', 'Jumlah Keseluruhan'],
  unit: ['Unit Bahagian'],
};

// Lajur yang diisi oleh pengguna. Lajur lain dikira oleh formula dalam Sheet.
export const INPUT_KEYS = [
  'id', 'jenis', 'tempoh', 'noPermit', 'idLama', 'nama', 'pengurus', 'alamat', 'telefon', 'kawasan', 'kedudukan',
  'kuantiti', 'k10', 'k20', 'hiburan', 'mula', 'tamat', 'kadarKhas', 'dibayar', 'tarikhBayar', 'resit', 'koordinat',
  'permitAsal', 'gambarLokasi', 'catatan',
];
const DATE_KEYS = new Set(['mula', 'tamat', 'tarikhBayar']);
const NUM_KEYS = new Set(['kuantiti', 'k10', 'k20', 'hiburan', 'kadarKhas', 'dibayar', 'baki', 'tempohHari', 'tempohBulan', 'kadar', 'jumlah']);

const TCOLS = {
  jenis: ['Jenis Permit'],
  unitKuantiti: ['Unit Kuantiti'],
  asasKadar: ['Asas Kadar'],
  kadarStandard: ['Kadar Standard (RM)', 'Kadar Standard'],
  unit: ['Unit Bahagian'],
  kod: ['Kod ID'],
  kadarHarian: ['Kadar Harian (RM)', 'Kadar Harian'],
  namaSurat: ['Nama Dalam Surat'],
  kawasan: ['Kawasan'],
  label: ['Tetapan'],
  nilai: ['Nilai'],
  senaraiUnit: ['Senarai Unit'],
  email: ['Emel Pengguna APP', 'Emel Pengguna'],
  namaPengguna: ['Nama'],
  peranan: ['Peranan'],
};

const SCOLS = {
  tarikh: ['Tarikh Dijana'],
  id: ['ID Rekod'],
  nama: ['Nama Premis'],
  jenis: ['Jenis Permit'],
  tamat: ['Tarikh Tamat'],
  ruj: ['Ruj. Kami'],
  doc: ['Pautan Surat'],
  pdf: ['Pautan PDF'],
  oleh: ['Dijana Oleh'],
};

const hnorm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

function mapHeaders(row, spec) {
  const hs = (row || []).map(hnorm);
  const idx = {};
  for (const [k, names] of Object.entries(spec)) {
    for (const n of names) {
      const i = hs.indexOf(hnorm(n));
      if (i >= 0) { idx[k] = i; break; }
    }
  }
  return idx;
}

export function colLetter(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellText(v) {
  if (typeof v === 'number') return String(v);
  return str(v);
}

function phoneText(v) {
  if (typeof v === 'number') {
    const s = String(v);
    return s.startsWith('6') ? s : '0' + s;
  }
  return str(v);
}

function parseRecord(row, i, c) {
  const g = (k) => (c[k] != null ? row[c[k]] : '');
  const r = { row: i + 1 };
  for (const k of Object.keys(COLS)) {
    const v = g(k);
    if (DATE_KEYS.has(k)) r[k] = toDate(v);
    else if (NUM_KEYS.has(k)) r[k] = numOrNull(v);
    else if (k === 'telefon') r[k] = phoneText(v);
    else r[k] = cellText(v);
  }
  r.id = r.id.toUpperCase();
  r.idLama = r.idLama.toUpperCase();
  r.jenis = r.jenis.toUpperCase();
  r.tempoh = r.tempoh.toUpperCase();
  r.status = r.status.toUpperCase();
  r.kawasan = r.kawasan.toUpperCase();
  return r;
}

function warnDays() {
  return toNum(setting('amaran')) || 30;
}

// Dipakai bila formula Sheet tiada (mod demo, atau rekod baru sebelum dimuat semula).
function computeDerived(r) {
  const t = today();
  r.baki = r.tamat ? diffDays(t, r.tamat) : null;
  if (state.renewals.has(r.id)) r.status = 'DIPERBAHARUI';
  else if (isRekod(r.jenis)) r.status = 'REKOD';
  else if (r.tempoh === 'SEKALI BAYAR') r.status = 'SAH';
  else if (!r.tamat) r.status = 'TIADA TARIKH';
  else if (r.tempoh === 'BERMUSIM') r.status = r.baki >= 0 ? 'SAH' : 'SELESAI';
  else if (r.baki < 0) r.status = 'TAMAT';
  else if (r.baki <= warnDays()) r.status = 'AKAN TAMAT';
  else r.status = 'SAH';
  const info = jenisInfo(r.jenis);
  if (!r.unit && info) r.unit = info.unit;
  if (r.mula && r.tamat) {
    r.tempohHari = diffDays(r.mula, r.tamat) + 1;
    r.tempohBulan = Math.round(r.tempohHari / 30.4375);
  }
  if (r.jumlah == null) {
    const a = anggaran(r);
    r.jumlah = a ? a.total : null;
  }
}

function ingest(d, t, s) {
  const c = mapHeaders(d[0], COLS);
  if (c.id == null || c.nama == null) {
    throw new Error('Tajuk lajur DAFTAR tidak dikenali. Lajur "ID Rekod" dan "Nama Pemohon / Syarikat" diperlukan.');
  }
  state.cols = c;
  parseTetapan(t);
  parseSurat(s);
  const recs = [];
  for (let i = 1; i < d.length; i++) {
    const r = parseRecord(d[i] || [], i, c);
    if (r.id) recs.push(r);
  }
  state.records = recs;
  state.byId = new Map(recs.map((r) => [r.id, r]));
  state.renewals = new Map();
  for (const r of recs) if (r.idLama && state.byId.has(r.idLama)) state.renewals.set(r.idLama, r);
  for (const r of recs) if (!r.status || c.status == null) computeDerived(r);
}

function parseTetapan(t) {
  const c = mapHeaders(t[0], TCOLS);
  state.tcols = c;
  const g = (row, k) => (c[k] != null ? row[c[k]] : '');
  const out = { jenis: [], kawasan: [], settings: [], units: [], users: [] };
  for (let i = 1; i < t.length; i++) {
    const row = t[i] || [];
    const j = str(g(row, 'jenis'));
    if (j) {
      out.jenis.push({
        jenis: j.toUpperCase(),
        unitKuantiti: str(g(row, 'unitKuantiti')),
        asasKadar: str(g(row, 'asasKadar')).toUpperCase(),
        kadarStandard: numOrNull(g(row, 'kadarStandard')),
        unit: str(g(row, 'unit')),
        kod: str(g(row, 'kod')).toUpperCase(),
        kadarHarian: numOrNull(g(row, 'kadarHarian')),
        namaSurat: str(g(row, 'namaSurat')),
      });
    }
    const k = str(g(row, 'kawasan'));
    if (k) out.kawasan.push(k.toUpperCase());
    const lb = str(g(row, 'label'));
    if (lb) out.settings.push({ label: lb, value: g(row, 'nilai'), row: i + 1 });
    const u = str(g(row, 'senaraiUnit'));
    if (u) out.units.push(u);
    const e = str(g(row, 'email'));
    if (e.includes('@')) out.users.push({ email: e.toLowerCase(), nama: str(g(row, 'namaPengguna')), peranan: str(g(row, 'peranan')).toUpperCase() });
  }
  state.tetapan = out;
}

function parseSurat(s) {
  const c = mapHeaders(s[0], SCOLS);
  state.scols = c;
  const g = (row, k) => (c[k] != null ? row[c[k]] : '');
  state.surat = [];
  for (let i = 1; i < s.length; i++) {
    const row = s[i] || [];
    const id = str(g(row, 'id')).toUpperCase();
    if (!id) continue;
    state.surat.push({
      tarikh: toDate(g(row, 'tarikh')), id, nama: str(g(row, 'nama')), jenis: str(g(row, 'jenis')),
      tamat: toDate(g(row, 'tamat')), ruj: str(g(row, 'ruj')), doc: str(g(row, 'doc')), pdf: str(g(row, 'pdf')), oleh: str(g(row, 'oleh')),
    });
  }
}

export function setting(key) {
  const k = norm(key);
  const s = state.tetapan.settings.find((x) => norm(x.label).includes(k));
  return s ? s.value : '';
}

export const jenisInfo = (j) => state.tetapan.jenis.find((x) => x.jenis === String(j || '').toUpperCase());

// Jenis untuk rekod hasil sahaja (Asas Kadar REKOD dalam TETAPAN, contoh LPKP): tiada tarikh tamat dan tiada surat.
export const isRekod = (j) => (jenisInfo(j) || {}).asasKadar === 'REKOD';

function resolveRole(email) {
  const e = String(email || '').toLowerCase();
  if (state.ketua) return 'KETUA';
  if (state.demo) return 'ADMIN';
  if (state.ownerEmail && e === state.ownerEmail.toLowerCase()) return 'ADMIN';
  const u = state.tetapan.users.find((x) => x.email === e);
  if (u) return u.peranan || 'FOCAL PERSON';
  return state.tetapan.users.length ? 'LIHAT' : 'ADMIN';
}

export const canEdit = () => !state.ketua && (state.role === 'ADMIN' || state.role === 'FOCAL PERSON');

// ---------- Muat data ----------

const cacheKey = () => `amp-cache:${state.sheetId}`;

function saveCache(raw) {
  try { localStorage.setItem(cacheKey(), JSON.stringify(raw)); } catch {}
}

export function hasCache() {
  try { return !!localStorage.getItem(cacheKey()); } catch { return false; }
}

function applyRaw(raw) {
  ingest(raw.d, raw.t, raw.s);
  state.user = raw.user;
  state.ownerEmail = raw.ownerEmail || '';
  state.sheetTitle = raw.title || '';
  state.loadedAt = raw.loadedAt || Date.now();
  state.role = resolveRole(state.user && state.user.email);
}

export function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey()) || 'null');
    if (!raw) return false;
    applyRaw(raw);
    state.offline = true;
    return true;
  } catch {
    return false;
  }
}

// Pautan ketua: data lihat sahaja dari skrip Google. Surat tidak dihantar.
async function loadKetua() {
  const j = await ambilDataKetua(state.ketua);
  const raw = { d: j.d, t: j.t, s: [], user: { email: '', name: 'Ketua Jabatan', photo: '' }, ownerEmail: '', title: j.title || '', loadedAt: Date.now() };
  applyRaw(raw);
  state.offline = false;
  saveCache(raw);
}

export async function load() {
  if (state.ketua) return loadKetua();
  if (state.demo) return loadDemo();
  const id = state.sheetId;
  const meta = await sheets.meta(id);
  state.meta = meta;
  const titles = meta.sheets.map((x) => x.properties.title);
  if (!titles.includes(DAFTAR) || !titles.includes(TETAPAN)) {
    throw new Error('Google Sheet ini tiada tab DAFTAR dan TETAPAN. Semak pautan Sheet.');
  }
  const ranges = [`${DAFTAR}!A1:AZ`, `${TETAPAN}!A1:Z`];
  if (titles.includes(SURAT)) ranges.push(`${SURAT}!A1:L`);
  const needUser = !state.user;
  const [vals, about, file] = await Promise.all([
    sheets.batchGet(id, ranges),
    needUser ? drive.about() : Promise.resolve(null),
    state.ownerEmail ? Promise.resolve(null) : drive.file(id, 'owners(emailAddress)').catch(() => null),
  ]);
  if (about) {
    state.user = { email: about.user.emailAddress, name: about.user.displayName || '', photo: about.user.photoLink || '' };
    try { localStorage.setItem('amp-email', state.user.email); } catch {}
  }
  if (file && file.owners && file.owners[0]) state.ownerEmail = file.owners[0].emailAddress;
  const v = vals.valueRanges.map((x) => x.values || []);
  const raw = { d: v[0], t: v[1], s: v[2] || [], user: state.user, ownerEmail: state.ownerEmail, title: meta.properties.title, loadedAt: Date.now() };
  applyRaw(raw);
  state.offline = false;
  saveCache(raw);
}

async function loadDemo() {
  if (!state._demoRaw) {
    const res = await fetch('__demo/data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Data demo tiada.');
    state._demoRaw = await res.json();
  }
  const raw = state._demoRaw;
  applyRaw({ ...raw, loadedAt: Date.now() });
  state.offline = false;
}

// ---------- Ringkasan ----------

export function counts() {
  const c = { 'SAH': 0, 'AKAN TAMAT': 0, 'TAMAT': 0 };
  for (const r of state.records) if (c[r.status] != null) c[r.status]++;
  return c;
}

export function perhatian() {
  const akan = state.records.filter((r) => r.status === 'AKAN TAMAT').sort((a, b) => (a.baki ?? 0) - (b.baki ?? 0));
  const tamat = state.records.filter((r) => r.status === 'TAMAT').sort((a, b) => (b.tamat || 0) - (a.tamat || 0));
  return [...akan, ...tamat];
}

export function years() {
  const ys = new Set([today().getUTCFullYear()]);
  for (const r of state.records) if (r.tarikhBayar) ys.add(r.tarikhBayar.getUTCFullYear());
  return [...ys].sort((a, b) => b - a);
}

export function hasil(year) {
  const months = Array(12).fill(0);
  const byUnit = new Map(state.tetapan.units.map((u) => [u, 0]));
  const byJenis = new Map();
  const unitJenis = new Map(); // unit -> Map(jenis -> jumlah setahun)
  const monthUnit = Array.from({ length: 12 }, () => new Map()); // bulan -> Map(unit -> { total, jenis: Map })
  let total = 0;
  let count = 0;
  for (const r of state.records) {
    if (!r.tarikhBayar || r.tarikhBayar.getUTCFullYear() !== year || !r.dibayar) continue;
    const v = r.dibayar;
    months[r.tarikhBayar.getUTCMonth()] += v;
    total += v;
    count++;
    const u = r.unit || (jenisInfo(r.jenis) || {}).unit || 'Lain-lain';
    byUnit.set(u, (byUnit.get(u) || 0) + v);
    byJenis.set(r.jenis, (byJenis.get(r.jenis) || 0) + v);
    const uj = unitJenis.get(u) || new Map();
    uj.set(r.jenis, (uj.get(r.jenis) || 0) + v);
    unitJenis.set(u, uj);
    const bulan = monthUnit[r.tarikhBayar.getUTCMonth()];
    const mu = bulan.get(u) || { total: 0, jenis: new Map() };
    mu.total += v;
    mu.jenis.set(r.jenis, (mu.jenis.get(r.jenis) || 0) + v);
    bulan.set(u, mu);
  }
  return { months, byUnit, byJenis, unitJenis, monthUnit, total, count };
}

export function chain(r) {
  const seen = new Set([r.id]);
  const prev = [];
  let p = r;
  while (p.idLama && state.byId.has(p.idLama) && !seen.has(p.idLama)) {
    p = state.byId.get(p.idLama);
    seen.add(p.id);
    prev.push(p);
  }
  const next = [];
  let n = r;
  while ((n = state.renewals.get(n.id)) && !seen.has(n.id)) {
    seen.add(n.id);
    next.push(n);
  }
  return { prev, next };
}

// Pemohon kerap: dikumpul ikut nama, rekod terbaru dahulu.
export function frequent(limit = 8) {
  const m = new Map();
  for (const r of state.records) {
    const k = norm(r.nama);
    if (!k) continue;
    const e = m.get(k) || { nama: r.nama, count: 0, latest: r };
    e.count++;
    if ((r.mula || 0) > (e.latest.mula || 0)) e.latest = r;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || (b.latest.mula || 0) - (a.latest.mula || 0)).slice(0, limit);
}

export const shortName = (nama) =>
  String(nama || '').replace(/\b(SDN\.?\s*BHD\.?|BHD|PLT|ENTERPRISE|MARKETING|TRADING|\(.*?\))/gi, '').replace(/\s+/g, ' ').trim();

// Anggaran jumlah keseluruhan, sama dengan formula lajur Jumlah Keseluruhan dalam DAFTAR.
export function anggaran(f) {
  const info = jenisInfo(f.jenis) || {};
  const bermusim = f.tempoh === 'BERMUSIM';
  const sekali = f.tempoh === 'SEKALI BAYAR';
  const asas = bermusim ? 'SEHARI' : sekali ? 'SEKALI' : info.asasKadar || '';
  const kadar = f.kadarKhas || (bermusim ? info.kadarHarian : info.kadarStandard) || 0;
  if (!kadar) return null;
  if (sekali) {
    const q = f.kuantiti || 1;
    return { total: q * kadar, ket: `${q} ${info.unitKuantiti || 'unit'} × RM${kadar}, sekali bayar` };
  }
  if (!f.mula || !f.tamat || f.tamat < f.mula) return null;
  const hari = diffDays(f.mula, f.tamat) + 1;
  const bulan = Math.round(hari / 30.4375);
  const qty = f.kuantiti || 1;
  const unitQ = info.unitKuantiti || 'unit';
  let total;
  let ket;
  if (asas === 'SEHARI') {
    const r10 = toNum(setting('khemah 10'));
    const r20 = toNum(setting('khemah 20'));
    const rh = toNum(setting('hiburan sehari'));
    const extra = (f.k10 || 0) * r10 + (f.k20 || 0) * r20 + (f.hiburan || 0) * rh;
    total = (qty * kadar + extra) * hari;
    ket = `${qty} ${unitQ} × RM${kadar}${extra ? ` + RM${extra} tambahan` : ''} × ${hari} hari`;
  } else if (asas === 'SEBULAN') {
    total = qty * kadar * bulan;
    ket = `${qty} ${unitQ} × RM${kadar} × ${bulan} bulan`;
  } else if (asas === 'SETAHUN') {
    total = (qty * kadar * bulan) / 12;
    ket = `${qty} ${unitQ} × RM${kadar} setahun × ${bulan} bulan`;
  } else {
    total = qty * kadar;
    ket = `${qty} ${unitQ} × RM${kadar}`;
  }
  return { total, ket };
}

// ---------- Surat ----------

export const suratFor = (id) => state.surat.filter((s) => s.id === id);

export function suratDue() {
  return state.records
    .filter((r) => r.tempoh === 'TAHUNAN' && r.status === 'AKAN TAMAT' && !state.surat.some((s) => s.id === r.id))
    .sort((a, b) => (a.baki ?? 0) - (b.baki ?? 0));
}

// Permit tahunan yang tarikhnya sudah lepas: surat guna templat kedua ("telah tamat tempoh") dengan tarikh akhir sendiri.
export const suratLewat = (r) => r.tempoh === 'TAHUNAN' && r.baki != null && r.baki < 0;

// Sudah tamat, belum diperbaharui, dan belum ada surat sejak tarikh tamat. Yang baru tamat di atas.
export function suratTamat() {
  return state.records
    .filter((r) => r.tempoh === 'TAHUNAN' && r.status === 'TAMAT' && r.tamat
      && !state.surat.some((s) => s.id === r.id && s.tarikh && s.tarikh > r.tamat))
    .sort((a, b) => b.tamat - a.tamat);
}

export function suratUpcoming(days = 90) {
  const w = warnDays();
  return state.records
    .filter((r) => r.tempoh === 'TAHUNAN' && r.status === 'SAH' && r.baki != null && r.baki > w && r.baki <= days)
    .map((r) => ({ r, tarikhSurat: addDays(r.tamat, -w) }))
    .sort((a, b) => a.tarikhSurat - b.tarikhSurat);
}

export function missingForSurat(r) {
  const m = [];
  if (!r.pengurus) m.push('Nama pengurus premis');
  if (!r.alamat) m.push('Alamat');
  if (!r.noPermit) m.push('No. permit');
  if (!r.kawasan && !r.kedudukan) m.push('Kawasan');
  if (!r.tamat) m.push('Tarikh tamat');
  return m;
}

// Ruang yang boleh dibiarkan bertitik dalam surat, untuk diisi tangan atau dalam Docs.
const BOLEH_KOSONG = ['NAMA_PENGURUS', 'ALAMAT_1', 'NO_PERMIT', 'KAWASAN'];
const TITIK = '.'.repeat(30);

export function splitAlamat(a) {
  const s = String(a || '').trim();
  if (!s) return ['', ''];
  const lines = s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (lines.length > 1) return [lines[0], lines.slice(1).join(', ')];
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 3) return [parts.slice(0, -2).join(', ') + ',', parts.slice(-2).join(', ')];
  return [s, ''];
}

export function namaSurat(jenis) {
  const info = jenisInfo(jenis);
  if (info && info.namaSurat) return info.namaSurat.toUpperCase();
  const j = String(jenis || '').toUpperCase();
  return j.startsWith('LESEN') || j.startsWith('PERMIT') ? j : `PERMIT ${j}`;
}

export function suratValues(r, ruj) {
  const t = today();
  const nama = namaSurat(r.jenis);
  const akhir = addDays(t, toNum(setting('tempoh jawab')) || 14);
  const [a1, a2] = splitAlamat(r.alamat);
  return {
    RUJ_KAMI: ruj || '',
    TARIKH_SURAT: fmtLong(t),
    NAMA_PENGURUS: String(r.pengurus || '').toUpperCase(),
    NAMA_PREMIS: r.nama,
    ALAMAT_1: a1,
    ALAMAT_2: a2,
    JENIS_PERMIT: nama,
    TAHUN: r.tamat ? String(addDays(r.tamat, 1).getUTCFullYear()) : '',
    NAMA_PERMIT: nama.toLowerCase(),
    KAWASAN: r.kawasan || r.kedudukan,
    NO_PERMIT: r.noPermit,
    TARIKH_TAMAT: fmtLong(r.tamat),
    HARI_TAMAT: dayName(r.tamat),
    TARIKH_AKHIR: fmtLong(akhir),
    HARI_AKHIR: dayName(akhir),
    NAMA_PENANDATANGAN: str(setting('penandatangan surat')).toUpperCase(),
    JAWATAN_PENANDATANGAN: str(setting('jawatan')),
  };
}

export function nextRuj() {
  const last = [...state.surat].sort((a, b) => (b.tarikh || 0) - (a.tarikh || 0))[0];
  let prev = last ? last.ruj : '';
  if (!prev) { try { prev = localStorage.getItem('amp-ruj') || ''; } catch {} }
  if (!prev) return '';
  const m = prev.match(/^(.*\()(\d+)(\)\s*)$/);
  return m ? `${m[1]}${Number(m[2]) + 1}${m[3]}` : prev;
}

// ---------- Tulis ----------

function encodeCell(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return isoDate(v);
  if (typeof v === 'number') return v;
  const s = String(v);
  if (/^[=+\-@]/.test(s) || /^[\d\s.,/:()-]+$/.test(s)) return "'" + s;
  return s;
}

async function freshIds() {
  const res = await sheets.batchGet(state.sheetId, [`${DAFTAR}!A1:A`]);
  return (res.valueRanges[0].values || []).map((r) => str(r[0]).toUpperCase());
}

export function nextId(jenis, mula, ids) {
  const info = jenisInfo(jenis);
  const kod = (info && info.kod) || String(jenis || 'PMT').replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase();
  const y = (mula || today()).getUTCFullYear();
  const prefix = `${kod}-${y}-`;
  let max = 0;
  for (const id of ids) {
    if (id.startsWith(prefix)) {
      const n = parseInt(id.slice(prefix.length), 10);
      if (n > max) max = n;
    }
  }
  return prefix + String(max + 1).padStart(3, '0');
}

function cellRanges(row, data) {
  return INPUT_KEYS.filter((k) => k in data && state.cols[k] != null).map((k) => ({
    range: `${DAFTAR}!${colLetter(state.cols[k])}${row}`,
    values: [[encodeCell(data[k])]],
  }));
}

export async function addRecord(data) {
  if (state.demo) {
    const id = nextId(data.jenis, data.mula, state.records.map((r) => r.id));
    const r = { ...blankRecord(), ...data, id, row: state.records.length + 2 };
    state.records.push(r);
    state.byId.set(id, r);
    if (r.idLama && state.byId.has(r.idLama)) {
      state.renewals.set(r.idLama, r);
      computeDerived(state.byId.get(r.idLama));
    }
    computeDerived(r);
    return id;
  }
  const ids = await freshIds();
  const id = nextId(data.jenis, data.mula, ids);
  const row = ids.length + 1;
  const clean = {};
  for (const k of INPUT_KEYS) if (data[k] != null && data[k] !== '') clean[k] = data[k];
  clean.id = id;
  await sheets.batchValues(state.sheetId, cellRanges(row, clean));
  await load();
  return id;
}

export async function updateRecord(id, changes) {
  if (!Object.keys(changes).length) return;
  if (state.demo) {
    const r = state.byId.get(id);
    Object.assign(r, changes);
    computeDerived(r);
    return;
  }
  const ids = await freshIds();
  const idx = ids.indexOf(id);
  if (idx < 1) throw new Error(`Rekod ${id} tidak dijumpai dalam DAFTAR.`);
  const data = { ...changes };
  delete data.id;
  await sheets.batchValues(state.sheetId, cellRanges(idx + 1, data));
  await load();
}

function blankRecord() {
  const r = {};
  for (const k of Object.keys(COLS)) r[k] = DATE_KEYS.has(k) || NUM_KEYS.has(k) ? null : '';
  return r;
}

async function saveSetting(keyword, value) {
  const k = norm(keyword);
  const s = state.tetapan.settings.find((x) => norm(x.label).includes(k));
  if (!s || state.tcols.nilai == null) return;
  if (!state.demo) await sheets.batchValues(state.sheetId, [{ range: `${TETAPAN}!${colLetter(state.tcols.nilai)}${s.row}`, values: [[value]] }]);
  s.value = value;
}

// Pautan ketua: ID skrip dan kunci ada dalam TETAPAN. Kunci kosong bermaksud pautan dimatikan.
export function tetapanKetua() {
  const ada = state.tetapan.settings.some((x) => norm(x.label).includes('kuncipautanketua'));
  return { ada, skrip: str(setting('skrip pautan ketua')), kunci: str(setting('kunci pautan ketua')) };
}

export const tetapKunciKetua = (kunci) => saveSetting('kunci pautan ketua', kunci);

async function folder(keyword, name) {
  let id = str(setting(keyword));
  if (id) return id;
  const f = await drive.createFolder(name);
  id = f.id;
  await saveSetting(keyword, id);
  return id;
}

// Kecilkan gambar sebelum dimuat naik (data telefon lebih jimat, OCR masih jelas).
// Jika createImageBitmap gagal (gambar kamera yang sangat besar pada sesetengah telefon), cuba melalui <img>,
// supaya gambar asal berbilang MB tidak dihantar.
function loadImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak dapat dibuka.')); };
    img.src = url;
  });
}

export async function compressImage(file, max = 2000, q = 0.86) {
  let src;
  try { src = await createImageBitmap(file); } catch { try { src = await loadImg(file); } catch { return file; } }
  try {
    const w = src.width || src.naturalWidth;
    const h = src.height || src.naturalHeight;
    const sc = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * sc);
    c.height = Math.round(h * sc);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    if (src.close) src.close();
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
    return blob || file;
  } catch {
    return file;
  }
}

export async function uploadPhoto(blob, name) {
  if (state.demo) return { id: 'demo', webViewLink: URL.createObjectURL(blob) };
  const parent = await folder('folder gambar', 'APP Monitoring Permit - Gambar');
  return drive.upload(blob, { name, parents: [parent], mimeType: blob.type || 'image/jpeg' }, { timeout: 120000 });
}

// OCR guna Google Drive: gambar ditukar ke Google Doc sementara, teksnya dibaca, kemudian dibuang ke Sampah.
// Mod demo membaca teks contoh dari pelayan ujian (bukan dari repo). kind: 'permit' atau 'resit'.
export async function ocrText(blob, kind = 'permit') {
  if (state.demo) {
    const res = await fetch(`__demo/ocr/${kind}.txt`, { cache: 'no-store' });
    return res.ok ? res.text() : '';
  }
  const parent = await folder('folder gambar', 'APP Monitoring Permit - Gambar');
  const doc = await drive.upload(blob, { name: 'OCR sementara', mimeType: 'application/vnd.google-apps.document', parents: [parent] }, { timeout: 60000 });
  try {
    return await drive.exportFile(doc.id, 'text/plain', { timeout: 30000 });
  } finally {
    drive.trash(doc.id).catch(() => {});
  }
}

export async function ocrPermit(blob) {
  return permitNumbers(await ocrText(blob, 'permit'));
}

export async function janaSurat(r, ruj) {
  const lewat = suratLewat(r);
  const nama = `${lewat ? 'Surat permit tamat' : 'Surat peringatan'} ${r.id} ${r.nama}`.slice(0, 120);
  if (state.demo) {
    state.surat.push({ tarikh: today(), id: r.id, nama: r.nama, jenis: r.jenis, tamat: r.tamat, ruj, doc: '#', pdf: '#', oleh: state.user.email });
    return { doc: '#', pdf: '#', pdfBlob: null, nama };
  }
  const tpl = str(setting(lewat ? 'template permit tamat' : 'template surat'));
  if (!tpl) throw new Error(`ID templat surat belum diisi dalam TETAPAN ("${lewat ? 'Template permit tamat (ID)' : 'Template surat (ID)'}").`);
  const parent = await folder('folder surat', 'APP Monitoring Permit - Surat');
  const copy = await drive.copy(tpl, nama, parent);
  const vals = suratValues(r, ruj);
  for (const k of BOLEH_KOSONG) if (!vals[k]) vals[k] = TITIK;
  const requests = [];
  for (const [k, v] of Object.entries(vals)) {
    for (const t of new Set([`{{${k}}}`, `{{${k.replace(/_/g, '\\_')}}}`])) {
      requests.push({ replaceAllText: { containsText: { text: t, matchCase: true }, replaceText: v || '' } });
    }
  }
  await docs.batchUpdate(copy.id, requests);
  const pdfBlob = await drive.exportFile(copy.id, 'application/pdf');
  const pdf = await drive.upload(pdfBlob, { name: `${nama}.pdf`, parents: [parent], mimeType: 'application/pdf' });
  await ensureSuratTab();
  await sheets.append(state.sheetId, `${SURAT}!A:I`, [[
    isoDate(today()), r.id, encodeCell(r.nama), encodeCell(r.jenis), isoDate(r.tamat), encodeCell(ruj), copy.webViewLink, pdf.webViewLink, state.user.email,
  ]]);
  try { localStorage.setItem('amp-ruj', ruj); } catch {}
  await load();
  return { doc: copy.webViewLink, pdf: pdf.webViewLink, pdfBlob, nama };
}

async function ensureSuratTab() {
  const titles = state.meta.sheets.map((x) => x.properties.title);
  if (titles.includes(SURAT)) return;
  await sheets.batchUpdate(state.sheetId, [{ addSheet: { properties: { title: SURAT } } }]);
  await sheets.batchValues(state.sheetId, [{
    range: `${SURAT}!A1:I1`,
    values: [['Tarikh Dijana', 'ID Rekod', 'Nama Premis', 'Jenis Permit', 'Tarikh Tamat', 'Ruj. Kami', 'Pautan Surat', 'Pautan PDF', 'Dijana Oleh']],
  }]);
  state.meta = await sheets.meta(state.sheetId);
}

export async function pdfBlobFromLink(link) {
  const id = driveId(link);
  if (!id) throw new Error('Pautan PDF tidak sah.');
  return drive.download(id);
}

export { addMonths };
