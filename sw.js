// Service worker: simpan kod app supaya boleh dibuka tanpa internet.
// Kod sentiasa diambil dari rangkaian dahulu (versi terbaru), simpanan hanya bila luar talian.
// Data permit (Google API) tidak pernah disimpan di sini.
const VERSION = 'amp-1.4.1';
const FONTS = 'amp-fonts';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/util.js', 'js/icons.js', 'js/google.js', 'js/store.js', 'js/ui.js', 'js/install.js', 'js/imbas.js', 'js/ketua.js',
  'js/views/login.js', 'js/views/utama.js', 'js/views/cari.js', 'js/views/butiran.js', 'js/views/borang.js',
  'js/views/hasil.js', 'js/views/surat.js', 'js/views/profil.js', 'js/views/scan.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-32.png', 'icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/__demo/')) return;
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./'))),
    );
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(FONTS).then((c) => c.put(req, copy));
        return res;
      })),
    );
  }
});
