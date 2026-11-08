// Loaded first, only inside the iPhone app. The app's pages are built into the app (so it works with no signal);
// live data still comes from the website's servers.
(function () {
  "use strict";
  var SITE = "https://www.monacomadeeasy.com";
  window.MMENative = { platform: "ios", site: SITE };
  document.documentElement.classList.add("native-ios");

  // Live data (/api/...) lives on the website, not inside the app.
  var fetch0 = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.indexOf("/api/") === 0) input = SITE + input;
    return fetch0.call(this, input, init);
  };

  // Location through the iPhone's own permission (not the web view's "localhost would like to use your location").
  var Cap = window.Capacitor, Geo = Cap && Cap.registerPlugin ? Cap.registerPlugin("Geolocation") : null;
  if (Geo && navigator.geolocation) {
    var seq = 0, ids = {};
    var errOf = function (e) {
      var m = String((e && (e.message || e.code)) || e || "");
      return { code: /denied|permission|not authori[sz]ed|disabled/i.test(m) ? 1 : /time ?out/i.test(m) ? 3 : 2, message: m,
        PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
    };
    var opts = function (o) { o = o || {}; return { enableHighAccuracy: !!o.enableHighAccuracy, timeout: o.timeout || 20000, maximumAge: o.maximumAge || 0 }; };
    var allowed = function () {
      return Geo.checkPermissions().then(function (p) {
        if (p.location === "granted") return true;
        if (p.location === "denied") return false;
        return Geo.requestPermissions({ permissions: ["location"] }).then(function (r) { return r.location === "granted"; });
      });
    };
    var denied = { message: "Location permission was denied" };
    navigator.geolocation.getCurrentPosition = function (ok, fail, o) {
      allowed().then(function (yes) { if (!yes) throw denied; return Geo.getCurrentPosition(opts(o)); })
        .then(ok, function (e) { if (fail) fail(errOf(e)); });
    };
    navigator.geolocation.watchPosition = function (ok, fail, o) {
      var id = ++seq; ids[id] = null;
      allowed().then(function (yes) {
        if (!yes) throw denied;
        if (!(id in ids)) return;
        return Geo.watchPosition(opts(o), function (pos, err) {
          if (!(id in ids)) return;
          if (err) { if (fail) fail(errOf(err)); } else if (pos) ok(pos);
        }).then(function (cid) { if (id in ids) ids[id] = cid; else Geo.clearWatch({ id: cid }); });
      }).catch(function (e) { if (fail) fail(errOf(e)); });
      return id;
    };
    navigator.geolocation.clearWatch = function (id) {
      var cid = ids[id]; delete ids[id];
      if (cid) Geo.clearWatch({ id: cid });
    };
  }
})();
