/* オフラインでも遊べるように、ゲームを端末に保存しておく */
var CACHE = 'seishin-games-20261103115728';
var FILES = ["index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "eeg.html", "ct.html", "ect.html", "touchoku.html", "byoto.html", "quest.html", "kensa.html", "fukusayo.html", "fukusayo_diag.html", "bakuro.html"];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    // 自分のファイル：ネットにつながれば新しいものを、つながらなければ保存したものを使う
    e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); return r; }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    // 文字の形（フォント）：一度読んだら保存しておく
    e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); return r; }); }));
  }
});
