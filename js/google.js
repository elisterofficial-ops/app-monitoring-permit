// Log masuk Google (Google Identity Services) dan panggilan API Sheets, Drive dan Docs.
// Token disimpan dalam peranti sahaja dan tamat dalam masa sejam.
import { CONFIG } from './config.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];
const TOKEN_KEY = 'amp-token';

let token = null;
try {
  const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  if (t && t.exp > Date.now()) token = t;
} catch {}

export class AuthError extends Error {}

export const hasToken = () => !!(token && token.exp > Date.now());

function waitForGis(timeout = 12000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function check() {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      if (Date.now() - t0 > timeout) return reject(new Error('Log masuk Google tidak dapat dimuatkan. Semak sambungan internet.'));
      setTimeout(check, 120);
    })();
  });
}

// Mesti dipanggil daripada tindakan pengguna (klik) supaya tetingkap Google tidak disekat.
export async function signIn() {
  await waitForGis();
  if (!CONFIG.clientId) throw new Error('Client ID Google belum ditetapkan dalam js/config.js.');
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.clientId,
      scope: SCOPES.join(' '),
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || 'Log masuk dibatalkan.'));
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...SCOPES)) {
          return reject(new Error('Sila tandakan semua kebenaran (Google Sheets dan Drive) supaya app boleh berfungsi.'));
        }
        token = { access_token: r.access_token, exp: Date.now() + (Number(r.expires_in || 3600) - 120) * 1000 };
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify(token)); } catch {}
        resolve();
      },
      error_callback: (e) => {
        const type = e && e.type;
        if (type === 'popup_closed') reject(new Error('Tetingkap log masuk ditutup sebelum selesai.'));
        else if (type === 'popup_failed_to_open') reject(new Error('Tetingkap log masuk disekat. Benarkan pop-up untuk laman ini.'));
        else reject(new Error('Log masuk tidak berjaya. Cuba lagi.'));
      },
    });
    let hint = '';
    try { hint = localStorage.getItem('amp-email') || ''; } catch {}
    client.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: 'select_account' });
  });
}

export function signOut() {
  token = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('amp-email');
  } catch {}
}

async function api(url, { method = 'GET', body, query, raw = false } = {}) {
  if (!hasToken()) throw new AuthError('Sesi log masuk tamat.');
  if (query) url += (url.includes('?') ? '&' : '?') + new URLSearchParams(query);
  const opts = { method, headers: { Authorization: `Bearer ${token.access_token}` } };
  if (body !== undefined) {
    if (body instanceof FormData || body instanceof Blob) opts.body = body;
    else {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    const e = new Error('Tiada sambungan internet.');
    e.offline = true;
    throw e;
  }
  if (res.status === 401) {
    token = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    throw new AuthError('Sesi log masuk tamat.');
  }
  if (!res.ok) {
    let msg = `Ralat ${res.status}`;
    try {
      const j = await res.json();
      if (j.error && j.error.message) msg = j.error.message;
    } catch {}
    if (res.status === 403 || res.status === 404) msg = `Tiada akses: ${msg}`;
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  if (raw) return res;
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export const sheets = {
  meta: (id) => api(`${SHEETS}/${id}`, { query: { fields: 'properties(title,locale),sheets.properties(sheetId,title)' } }),
  batchGet(id, ranges) {
    const q = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
    ranges.forEach((r) => q.append('ranges', r));
    return api(`${SHEETS}/${id}/values:batchGet?${q}`);
  },
  batchValues: (id, data) =>
    api(`${SHEETS}/${id}/values:batchUpdate`, { method: 'POST', body: { valueInputOption: 'USER_ENTERED', data } }),
  append: (id, range, values) =>
    api(`${SHEETS}/${id}/values/${encodeURIComponent(range)}:append`, {
      method: 'POST',
      query: { valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS' },
      body: { values },
    }),
  batchUpdate: (id, requests) => api(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: { requests } }),
};

export const drive = {
  about: () => api(`${DRIVE}/about`, { query: { fields: 'user(displayName,emailAddress,photoLink)' } }),
  file: (id, fields) => api(`${DRIVE}/files/${id}`, { query: { fields, supportsAllDrives: 'true' } }),
  upload(blob, meta) {
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    fd.append('file', blob);
    return api(UPLOAD, { method: 'POST', query: { uploadType: 'multipart', fields: 'id,name,webViewLink', supportsAllDrives: 'true' }, body: fd });
  },
  createFolder: (name) =>
    api(`${DRIVE}/files`, { method: 'POST', query: { fields: 'id,webViewLink' }, body: { name, mimeType: 'application/vnd.google-apps.folder' } }),
  copy: (id, name, parent) =>
    api(`${DRIVE}/files/${id}/copy`, {
      method: 'POST',
      query: { fields: 'id,webViewLink', supportsAllDrives: 'true' },
      body: parent ? { name, parents: [parent] } : { name },
    }),
  async exportFile(id, mimeType) {
    const res = await api(`${DRIVE}/files/${id}/export`, { query: { mimeType }, raw: true });
    return mimeType.startsWith('text/') ? res.text() : res.blob();
  },
  async download(id) {
    const res = await api(`${DRIVE}/files/${id}`, { query: { alt: 'media', supportsAllDrives: 'true' }, raw: true });
    return res.blob();
  },
  trash: (id) => api(`${DRIVE}/files/${id}`, { method: 'PATCH', query: { supportsAllDrives: 'true' }, body: { trashed: true } }),
};

export const docs = {
  batchUpdate: (id, requests) => api(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, { method: 'POST', body: { requests } }),
};
