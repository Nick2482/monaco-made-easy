// Only in the test build made by the cloud Mac: walks through the main screens for screenshots,
// and shows any script error on screen so it appears in the pictures.
(function () {
  var errs = [];
  function show() {
    var b = document.getElementById("shot-err");
    if (!b) { b = document.createElement("pre"); b.id = "shot-err"; b.style.cssText = "position:fixed;left:0;right:0;top:40%;z-index:99999;margin:0;padding:8px;background:#b00;color:#fff;font:11px/1.3 monospace;white-space:pre-wrap"; (document.body || document.documentElement).appendChild(b); }
    b.textContent = errs.join("\n");
  }
  window.addEventListener("error", function (e) { errs.push("ERROR " + e.message + " @ " + (e.filename || "").split("/").pop() + ":" + e.lineno); show(); });
  window.addEventListener("unhandledrejection", function (e) { errs.push("PROMISE " + (e.reason && (e.reason.message || e.reason))); show(); });
  setTimeout(function () {
    var b = document.createElement("div"); b.style.cssText = "position:fixed;left:8px;bottom:100px;z-index:99999;padding:4px 8px;background:#060;color:#fff;font:11px monospace;border-radius:4px";
    b.textContent = "location: asking"; document.body.appendChild(b);
    navigator.geolocation.getCurrentPosition(function (p) { b.textContent = "location ok " + p.coords.latitude.toFixed(4) + "," + p.coords.longitude.toFixed(4); },
      function (e) { b.style.background = "#b00"; b.textContent = "location error " + e.code + " " + e.message; }, { timeout: 15000 });
  }, 3000);
  var ROUTES = ["#/", "#/map", "#/transport", "#/guide/eat", "#/villages", "#/info", "#/pro"];
  var i = 0;
  setTimeout(function next() { i++; if (i < ROUTES.length) { location.hash = ROUTES[i]; window.scrollTo(0, 0); setTimeout(next, 10000); } }, 20000);
})();
