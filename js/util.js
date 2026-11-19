// Fungsi bantu: teks, nombor, tarikh. Semua tarikh disimpan sebagai Date pada tengah malam UTC.

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
export const BULAN_PENDEK = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
export const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
export const DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');

export const ymd = (y, m, d) => new Date(Date.UTC(y, m, d));

export function today() {
  const n = new Date();
  return ymd(n.getFullYear(), n.getMonth(), n.getDate());
}

// Nombor siri tarikh Google Sheets (25569 = 1 Jan 1970).
export const fromSerial = (n) => new Date((Math.floor(n) - 25569) * DAY);

export function toDate(v) {
  if (v === '' || v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return fromSerial(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return ymd(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return ymd(+m[1], +m[2] - 1, +m[3]);
  return null;
}

export function toNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/RM/gi, '').replace(/[,\s]/g, '');
  if (s === '' || s === '-') return 0;
  const n = parseFloat(s.replace(/^\((.*)\)$/, '-$1'));
  return isNaN(n) ? 0 : n;
}

export function numOrNull(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'string' && v.trim() === '-') return null;
  const n = toNum(v);
  return n;
}

export const str = (v) => (v == null ? '' : String(v).trim());

export const addDays = (d, n) => new Date(d.getTime() + n * DAY);

export function addMonths(d, n) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return ymd(y, m, Math.min(d.getUTCDate(), last));
}

export const diffDays = (a, b) => Math.round((b - a) / DAY);

export const fmtDate = (d) => (d ? `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` : '');
export const fmtLong = (d) => (d ? `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '');
export const fmtShort = (d) => (d ? `${d.getUTCDate()} ${BULAN_PENDEK[d.getUTCMonth()]}` : '');
export const dayName = (d) => (d ? HARI[d.getUTCDay()] : '');
export const isoDate = (d) => (d ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` : '');

export function fromIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? ymd(+m[1], +m[2] - 1, +m[3]) : null;
}

export function fmtRM(n, dp = 2) {
  return 'RM ' + fmtNum(n, dp);
}

export function fmtNum(n, dp = 2) {
  return Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtK(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(Math.round(n));
}

// Untuk carian: huruf kecil, buang ruang dan tanda baca.
export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const KECIL = new Set(['dan', 'di', 'ke', 'dari', 'bagi', 'untuk', 'atau']);
export const tcase = (s) =>
  String(s || '').toLowerCase().replace(/(^|[\s(/&-])([a-z]+)/g, (m, a, w) => (a && KECIL.has(w) ? a + w : a + w.charAt(0).toUpperCase() + w.slice(1)));

export function scase(s) {
  const t = String(s || '').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const STATUS = {
  'SAH': { cls: 'ok', label: 'Sah' },
  'AKAN TAMAT': { cls: 'warn', label: 'Akan tamat' },
  'TAMAT': { cls: 'bad', label: 'Tamat' },
  'DIPERBAHARUI': { cls: 'mute', label: 'Diperbaharui' },
  'SELESAI': { cls: 'mute', label: 'Selesai' },
  'TIADA TARIKH': { cls: 'mute', label: 'Tiada tarikh' },
};

export const statusCls = (s) => (STATUS[s] ? STATUS[s].cls : 'mute');

// Jenis tempoh. SEKALI BAYAR: bayaran sekali tanpa tarikh tamat (contoh papan tanda ONE OFF).
export const SEKALI = 'SEKALI BAYAR';
export const TEMPOH = { TAHUNAN: 'Tahunan', BERMUSIM: 'Bermusim', [SEKALI]: 'Sekali bayar' };
export const tempohLabel = (t) => TEMPOH[t] || 'Tahunan';

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function parseSheetId(input) {
  const s = String(input || '').trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{30,}$/.test(s)) return s;
  return '';
}

export function driveId(link) {
  const s = String(link || '');
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : '';
}

// No. telefon Malaysia ke format wa.me (60xxxxxxxxx).
export function waNumber(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('60')) return d;
  if (d.startsWith('0')) return '6' + d;
  if (d.startsWith('1')) return '60' + d;
  return d;
}

export function mapsUrl(koordinat) {
  const k = String(koordinat || '').replace(/\s+/g, '');
  return k ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k)}` : '';
}

export function greet(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Selamat pagi';
  if (h < 14) return 'Selamat tengah hari';
  if (h < 19) return 'Selamat petang';
  return 'Selamat malam';
}

export function timeAgo(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'baru sahaja';
  if (m < 60) return `${m} minit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}
