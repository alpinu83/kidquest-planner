// KidQuest 2.0 Service Worker
// - 앱 코드(HTML/JS/CSS): 네트워크 우선 → 업데이트가 바로 반영되고, 오프라인이면 캐시 사용
// - 이미지·폰트·라이브러리: 캐시 우선 (빠른 로딩)
// - Firebase 실시간 동기화 요청은 가로채지 않음
const VERSION = 'kq-2.1.0';
const CORE = `${VERSION}-core`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE).then((c) => c.addAll(['./', './index.html', './styles/app.css', './manifest.webmanifest'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('firebasedatabase.app') || url.hostname.includes('open-meteo.com')) return;
  if (req.headers.get('accept') === 'text/event-stream') return;

  const isAsset = /\/(assets|icons|vendor)\//.test(url.pathname) || url.hostname === 'cdn.jsdelivr.net';
  if (isAsset) {
    e.respondWith(caches.open(ASSETS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) caches.open(CORE).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
