// Keeps the app working with no signal: everything is saved on the phone the first time it opens.
// Change VERSION whenever the app is updated so phones pick up the new files.
var VERSION = "mme-preview-66";
var TILES = "mme-map-tiles";
var FILES = [
  "./", "index.html", "styles.css", "i18n.js", "i18n-strings.js", "app.js", "data.js", "graph.js", "lifts-osm.js", "router.js", "bus.js", "border.js", "trains.js", "transit.js", "map.js", "survey.js", "planner.js", "extras.js", "essentials.js", "walks.js", "pro.js", "install.js", "weather.js", "guide-titles.js", "guide-data.js", "guide.js", "manifest.webmanifest",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/jszip.min.js",
  "img/harbour-hero.jpg", "img/seapath-coast.jpg", "img/seapath-arch.jpg", "img/rock-museum.jpg", "img/rock-palace.jpg", "img/rock-fontvieille.jpg", "img/mc-garden-pond.jpg", "img/mc-garden-bridge.jpg", "img/mc-casino.jpg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "fonts/atkinson-hyperlegible-latin-400-normal.woff2", "fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "fonts/dm-serif-display-latin-400-normal.woff2", "fonts/dm-serif-display-latin-400-italic.woff2"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== TILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Fresh copy when online, saved copy when not.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  // Map tiles: keep the ones you've looked at, so the map still shows with no signal.
  if (/basemaps\.cartocdn\.com$/.test(url.hostname) || url.pathname.indexOf("/elevation-tiles-prod/") === 0) {
    e.respondWith(caches.open(TILES).then(function (c) {
      return c.match(e.request, { ignoreVary: true }).then(function (hit) {
        return hit || fetch(e.request).then(function (res) { if (res.ok || res.type === "opaque") c.put(e.request, res.clone()); return res; });
      });
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match("index.html"); });
  }));
});
