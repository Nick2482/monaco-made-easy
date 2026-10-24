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
    root.querySelectorAll(".install-card:not(.rate-card)").forEach(function (c) {
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

  // "Share the app": the phone's own share sheet where there is one, otherwise WhatsApp, email or copy the link.
  var SHARE_URL = "https://www.monacomadeeasy.com/";
  var SHARE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.1a2.9 2.9 0 0 0-2 .8l-7.1-4.1a3 3 0 0 0 0-1.6L16 7.1A3 3 0 1 0 15 5a3 3 0 0 0 .1.8L8 9.9a3 3 0 1 0 0 4.2l7.1 4.2a2.8 2.8 0 0 0-.1.7 3 3 0 1 0 3-2.9z"/></svg>';
  function shareText() { return t("Monaco Made Easy: the easy way round Monaco, using the free public lifts and escalators."); }
  function shareCard() {
    return '<aside class="share-card"><span class="ic-ico">' + SHARE_ICON + "</span><div><strong>" + esc(t("Travelling with others?")) + "</strong>" +
      "<p>" + esc(t("Send them the app, so everyone can find the lifts.")) + "</p>" +
      '<button type="button" class="btn btn-navy sh-go">' + esc(t("Share the app")) + "</button>" +
      '<div class="sh-opts" hidden><a class="btn btn-line" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(shareText() + " " + SHARE_URL) + '">WhatsApp</a>' +
      '<a class="btn btn-line" href="mailto:?subject=' + encodeURIComponent("Monaco Made Easy") + "&body=" + encodeURIComponent(shareText() + "\n\n" + SHARE_URL) + '">' + esc(t("Email")) + "</a>" +
      '<button type="button" class="btn btn-line sh-copy">' + esc(t("Copy link")) + "</button></div></div></aside>";
  }
  function mountShare(root) {
    root.querySelectorAll(".share-card").forEach(function (c) {
      var go = c.querySelector(".sh-go"), opts = c.querySelector(".sh-opts");
      go.addEventListener("click", function () {
        if (window.MMEStats) window.MMEStats.track("Share tapped");
        if (navigator.share) {
          navigator.share({ title: "Monaco Made Easy", text: shareText(), url: SHARE_URL }).catch(function () {});
        } else { opts.hidden = !opts.hidden; }
      });
      c.querySelector(".sh-copy").addEventListener("click", function (e) {
        var b = e.currentTarget;
        function done() { b.textContent = t("Link copied"); }
        if (navigator.clipboard) navigator.clipboard.writeText(SHARE_URL).then(done, function () {}); else done();
      });
    });
  }
  var mount0 = mount;
  mount = function (root) { mount0(root); mountShare(root); };


  // "Rate us": only inside the Google Play app, only after someone has used it on 2 different days
  // and planned at least 3 routes. "Not now" asks again after 14 days; "Rate" or "No thanks" never asks again.
  var PLAY_ID = "com.monacomadeeasy.www.twa";
  (function countDay() {
    var d = new Date(), today = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    if (get("mme-lastday") !== today) { set("mme-lastday", today); set("mme-days", String((+get("mme-days") || 0) + 1)); }
  })();
  function routeUsed() { set("mme-routes", String((+get("mme-routes") || 0) + 1)); }
  function rateDue() {
    if (!(window.MMEPro && window.MMEPro.inPlayApp && window.MMEPro.inPlayApp())) return false;
    if (get("mme-rate-done")) return false;
    if ((+get("mme-days") || 0) < 2 || (+get("mme-routes") || 0) < 3) return false;
    var later = +get("mme-rate-later") || 0;
    return Date.now() - later > 14 * 864e5;
  }
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
  function rateCard() {
    if (!rateDue()) return "";
    return '<aside class="install-card rate-card"><button type="button" class="ic-x rt-later" aria-label="' + esc(t("Not now")) + '">×</button>' +
      '<span class="ic-ico">' + STAR + "</span><div><strong>" + esc(t("Finding Monaco Made Easy useful?")) + "</strong>" +
      "<p>" + esc(t("A quick review on Google Play helps other visitors find the app. It only takes a minute.")) + "</p>" +
      '<div class="rt-actions"><a class="btn btn-red rt-go" href="market://details?id=' + PLAY_ID + '">' + esc(t("Rate on Google Play")) + "</a>" +
      '<button type="button" class="btn btn-line rt-no">' + esc(t("No thanks")) + "</button></div></div></aside>";
  }
  function mountRate(root) {
    root.querySelectorAll(".rate-card").forEach(function (c) {
      if (window.MMEStats) window.MMEStats.track("Rate prompt shown");
      c.querySelector(".rt-later").addEventListener("click", function () { set("mme-rate-later", String(Date.now())); c.remove(); });
      c.querySelector(".rt-no").addEventListener("click", function () { set("mme-rate-done", "no"); c.remove(); if (window.MMEStats) window.MMEStats.track("Rate prompt", { answer: "no" }); });
      c.querySelector(".rt-go").addEventListener("click", function () {
        set("mme-rate-done", "yes");
        if (window.MMEStats) window.MMEStats.track("Rate prompt", { answer: "rate" });
        setTimeout(function () { c.innerHTML = '<p class="off-ok">' + esc(t("Thank you!")) + "</p>"; }, 400);
      });
    });
  }
  var mount1 = mount;
  mount = function (root) { mount1(root); mountRate(root); };

  window.MMEInstall = { card: card, mount: mount, installed: installed, shareCard: shareCard, rateCard: rateCard, routeUsed: routeUsed };
})();
