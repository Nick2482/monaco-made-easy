// "Add to your home screen": the website installs like an app (full screen, works without signal).
// Android/Chrome gets a one-tap Install button; iPhone gets the two Safari steps.
(function () {
  "use strict";
  var deferred = null;
  function t(s, v) { return window.MMEI18N.t(s, v); }
  function esc(s) { return window.MMEUI.esc(s); }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    window.dispatchEvent(new Event("mme-install"));
  });
  window.addEventListener("appinstalled", function () {
    set("mme-installed", "1");
    if (window.MMEStats) window.MMEStats.track("App installed");
    document.querySelectorAll(".install-card").forEach(function (c) { c.remove(); });
  });

  function installed() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches) return true;
    } catch (e) {}
    if (window.navigator.standalone) return true;
    if (window.MMEPro && window.MMEPro.inPlayApp && window.MMEPro.inPlayApp()) return true;
    return false;
  }
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 3v14h10V4zm5 15.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM11 6h2v5h2.5L12 14.5 8.5 11H11z"/></svg>';

  // where: "home" (can be closed for good) or "info" (always shown until installed).
  function card(where) {
    if (installed()) return "";
    if (where === "home" && get("mme-install-x")) return "";
    var steps = isIOS() ? t("On iPhone: tap the Share button (the square with an arrow) at the bottom of Safari, then “Add to Home Screen”.")
      : t("Open your browser’s menu (⋮ or ⋯) and choose “Install app” or “Add to Home screen”.");
    return '<aside class="install-card" data-where="' + where + '">' +
      (where === "home" ? '<button type="button" class="ic-x" aria-label="' + esc(t("Not now")) + '">×</button>' : "") +
      '<span class="ic-ico">' + ICON + "</span><div><strong>" + esc(t("Add to your home screen")) + "</strong>" +
      "<p>" + esc(t("Monaco Made Easy opens like an app, full screen, and works without signal.")) + "</p>" +
      '<button type="button" class="btn btn-navy ic-go"' + (deferred ? "" : " hidden") + ">" + esc(t("Install")) + "</button>" +
      '<p class="ic-steps"' + (deferred ? " hidden" : "") + ">" + esc(steps) + "</p></div></aside>";
  }
  function mount(root) {
    root.querySelectorAll(".install-card").forEach(function (c) {
      var x = c.querySelector(".ic-x");
      if (x) x.addEventListener("click", function () { set("mme-install-x", "1"); c.remove(); });
      var go = c.querySelector(".ic-go");
      function refresh() {
        if (!document.body.contains(c)) { window.removeEventListener("mme-install", refresh); return; }
        go.hidden = !deferred; c.querySelector(".ic-steps").hidden = !!deferred;
      }
      window.addEventListener("mme-install", refresh);
      go.addEventListener("click", function () {
        if (!deferred) return;
        var p = deferred; deferred = null;
        p.prompt();
        if (window.MMEStats) window.MMEStats.track("Install prompt", { where: c.dataset.where });
        (p.userChoice || Promise.resolve({})).then(function (r) {
          if (r && r.outcome === "accepted") { c.innerHTML = '<p class="off-ok">' + esc(t("Installed. Look for Monaco Easy on your home screen.")) + "</p>"; }
          else refresh();
        });
      });
    });
  }

  window.MMEInstall = { card: card, mount: mount, installed: installed };
})();
