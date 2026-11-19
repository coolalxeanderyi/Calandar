// 離線也能打開：把網站本身的檔案存在瀏覽器裡。
// 任務、目標這些資料本來就由 Firestore 的離線快取處理，這裡只管網頁檔案。
// 網站更新時把 VERSION 改成新的值（跟 js/update.js 的 APP_BUILD 一樣），舊的快取就會被清掉。
const VERSION = 'planner-2026-11-19-1';

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/backend-firebase.js',
  './js/backend-local.js',
  './js/components.js',
  './js/covers.js',
  './js/dates.js',
  './js/datesui.js',
  './js/fontsize.js',
  './js/friends.js',
  './js/firebase-sdk.js',
  './js/gas-code.js',
  './js/gcal.js',
  './js/gsync.js',
  './js/mascot.js',
  './js/greet.js',
  './js/model.js',
  './js/moodchart.js',
  './js/money.js',
  './js/quickadd.js',
  './js/shoplist.js',
  './js/settings.js',
  './js/store.js',
  './js/swipe.js',
  './js/tags.js',
  './js/themes.js',
  './js/timeline.js',
  './js/update.js',
  './js/ui.js',
  './js/utils.js',
  './js/weather.js',
  './js/zone.js',
  './js/views/calendar.js',
  './js/views/dashboard.js',
  './js/views/friends.js',
  './js/views/goals.js',
  './js/views/habits.js',
  './js/views/money.js',
  './js/views/review.js',
  './js/views/shopping.js',
  './js/views/tasks.js',
  './firebase-config.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(SHELL.map((path) => cache.add(path).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('planner-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 先上網拿最新的（每次都跟伺服器確認有沒有更新），沒網路再用存起來的
async function networkFirst(request, key = request) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(request, { cache: 'no-cache' });
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

// 版本固定、不會變的檔案（Firebase SDK、字型）：有存就直接用
async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (
    url.hostname === 'fonts.googleapis.com'
    || url.hostname === 'fonts.gstatic.com'
    || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // 登入、雲端資料、Google 日曆：一律直接上網，不經過快取
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const root = new URL('./', self.location);
    if (url.pathname === root.pathname || url.pathname === `${root.pathname}index.html`) {
      event.respondWith(networkFirst(request, root.href));
    } else {
      // 其他網址（例如舊的 /v7/）：有網路就交給 404.html 轉回首頁，沒網路直接回首頁。
      // 這些頁面不存進快取，免得蓋掉首頁。
      event.respondWith(fetch(request).catch(() => Response.redirect(root.href, 302)));
    }
    return;
  }
  // firebase-config.js?v=時間 這種網址，用不含 ? 的網址存
  event.respondWith(networkFirst(request, url.origin + url.pathname));
});
