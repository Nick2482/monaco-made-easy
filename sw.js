// Keeps the app working with no signal: everything is saved on the phone the first time it opens.
// Change VERSION whenever the app is updated so phones pick up the new files.
var VERSION = "mme-preview-109";
var TILES = "mme-map-tiles";
var FILES = [
  "./", "index.html", "styles.css", "i18n.js", "i18n-strings.js", "app.js", "data.js", "graph.js", "lifts-osm.js", "router.js", "bus.js", "border.js", "trains.js", "transit.js", "map.js", "survey.js", "planner.js", "extras.js", "essentials.js", "walks.js", "pro.js", "install.js", "weather.js", "guide-titles.js", "guide-data.js", "guide.js", "manifest.webmanifest",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/jszip.min.js",
  "img/harbour-hero.jpg", "img/seapath-coast.jpg", "img/seapath-arch.jpg", "img/rock-museum.jpg", "img/rock-palace.jpg", "img/rock-fontvieille.jpg", "img/mc-garden-pond.jpg", "img/mc-garden-bridge.jpg", "img/mc-casino.jpg", "img/corbusier-waves.jpg", "img/corbusier-carnoles.jpg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
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
// App files: the saved copy straight away (fast, even with weak signal in tunnels and lifts),
// with a fresh copy fetched quietly in the background for next time.
// Live data (/api/...): the network first, but give up after a few seconds and use the last saved answer.
function fromNetwork(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  });
}
function withTimeout(p, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error("timeout")); }, ms);
    p.then(function (r) { clearTimeout(t); resolve(r); }, function (e) { clearTimeout(t); reject(e); });
  });
}
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
  if (url.pathname.indexOf("/api/") === 0) {
    e.respondWith(withTimeout(fromNetwork(e.request), 6000).catch(function () {
      return caches.match(e.request).then(function (r) { return r || new Response('{"ok":false,"error":"offline"}', { status: 503, headers: { "Content-Type": "application/json" } }); });
    }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    var fresh = fromNetwork(e.request).catch(function () { return null; });
    if (hit) { e.waitUntil(fresh); return hit; }
    return fresh.then(function (r) { return r || caches.match("index.html"); });
  }));
});
