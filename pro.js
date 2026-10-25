// Monaco Made Easy Pro: a one-off unlock for the guide, walks, cruise mode, the offline map and "Take me home".
// Getting around (lifts, step-free routes, wheelchair mode, buses, toilets, pharmacies, defibrillators, tourist
// information) is always free. No accounts: a purchase gives an unlock code that is kept on the phone.
(function () {
  "use strict";
  var CONFIG = {
    // From this date Pro is paid. While it is null, everyone has Pro (preview).
    // (Set it when Stripe is ready; nobody keeps Pro free after it without buying.)
    launch: "2026-10-14",          // e.g. "2026-12-01"
    // The Stripe Payment Link. Until it is set, the buy button says "Coming soon".
    // One link, two currencies: Stripe charges €3.49, or £2.99 to buyers in the UK.
    payLink: "https://buy.stripe.com/14A7sLaqu7mc2630lcgYU01",
    price: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone === "Europe/London" ? "£2.99" : "€3.49"; } catch (e) { return "€3.49"; } })(),
    playSku: "pro_unlock"           // the in-app product id in Play Console
  };
  function t(s, v) { return window.MMEI18N.t(s, v); }
  function esc(s) { return window.MMEUI.esc(s); }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  function status() {
    if (get("mme-pro-test") === "locked") return "locked";   // lets us see the paid version during the preview
    if (get("mme-pro")) return "bought";
    if (inPlayApp() && !play.ready) return "playapp";   // Play app without Google's payment system (older version): Pro stays free
    if (!CONFIG.launch || new Date().toISOString().slice(0, 10) < CONFIG.launch) return "preview";
    return "locked";
  }
  function isPro() { return status() !== "locked"; }
  // Inside the Google Play app, Google requires its own payment system for things like Pro, so we don't sell there (yet).
  function inPlayApp() {
    try { if (/^android-app:\/\//.test(document.referrer)) sessionStorage.setItem("mme-twa", "1"); return sessionStorage.getItem("mme-twa") === "1"; } catch (e) { return /^android-app:\/\//.test(document.referrer); }
  }
  inPlayApp();

  // ---------- Google Play Billing (inside the Play Store app) ----------
  // Google requires its own payment system there. Works once the app is built with Play Billing switched on
  // and the "pro_unlock" product exists in Play Console; until then the Play app keeps Pro free.
  var PLAY_METHOD = "https://play.google.com/billing";
  var play = { ready: false, svc: null, price: null };
  function playInit() {
    if (!inPlayApp() || !("getDigitalGoodsService" in window)) return;
    window.getDigitalGoodsService(PLAY_METHOD).then(function (svc) {
      if (!svc) return;
      play.svc = svc;
      return svc.getDetails([CONFIG.playSku]).then(function (d) {
        if (!d || !d.length) return;
        var pr = d[0].price;
        try { play.price = new Intl.NumberFormat(document.documentElement.lang || "en-GB", { style: "currency", currency: pr.currency }).format(+pr.value); } catch (e) { play.price = pr.value + " " + pr.currency; }
        play.ready = true;
        // Already bought on this Google account (new phone, reinstall)? Switch Pro back on.
        return svc.listPurchases().then(function (list) {
          var mine = (list || []).filter(function (p) { return p.itemId === CONFIG.playSku; })[0];
          if (mine && !get("mme-pro")) return confirmPlay(mine.purchaseToken, "play-restore");
        });
      });
    }).catch(function () {}).then(function () { window.dispatchEvent(new Event("mme-pro")); });
  }
  function confirmPlay(token, how) {
    return api({ action: "play", sku: CONFIG.playSku, token: token }).then(function (r) {
      if (r.ok) { set("mme-pro-playpending", null); unlock(r.code, how); return true; }
      set("mme-pro-playpending", token); lastError = r.error || "unavailable"; return false;
    });
  }
  function buyOnPlay() {
    if (!play.ready || !window.PaymentRequest) return Promise.resolve(false);
    var req = new PaymentRequest([{ supportedMethods: PLAY_METHOD, data: { sku: CONFIG.playSku } }],
      { total: { label: "Monaco Made Easy Pro", amount: { currency: "GBP", value: "0" } } });
    return req.show().then(function (res) {
      var token = res.details && res.details.purchaseToken;
      if (!token) { res.complete("fail"); return false; }
      return confirmPlay(token, "play").then(function (ok) { res.complete(ok ? "success" : "fail"); return ok; });
    }).catch(function () { return false; });   // cancelled by the visitor
  }

  function api(body) {
    return fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "unavailable" }; }); })
      .catch(function () { return { ok: false, error: "offline" }; });
  }
  function unlock(code, how) {
    set("mme-pro", code); set("mme-pro-test", null);
    if (window.MMEStats) window.MMEStats.track("Pro unlocked", { how: how });
    window.dispatchEvent(new Event("mme-pro"));
  }

  var STAR = '<svg class="pro-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z"/></svg>';
  function badge() { return '<span class="pro-badge">' + STAR + "Pro</span>"; }

  // The card shown in place of a Pro feature.
  function lockCard(what) {
    return '<aside class="pro-lock"><div class="pl-head">' + badge() + "<strong>" + esc(t(what)) + "</strong></div>" +
      "<p>" + esc(t("Part of Monaco Made Easy Pro: the guide to restaurants, bars, museums and more, step-free walks, cruise mode, the offline map and “Take me home”.")) + "</p>" +
      '<a class="btn btn-red" href="#/pro">' + esc(inPlayApp() && !play.ready ? t("What’s included, and how to get it") : t("Get Pro for {price}, once", { price: play.price || CONFIG.price })) + "</a>" +
      '<p class="pl-free">' + esc(t("Lifts, step-free routes, buses and essentials stay free.")) + "</p></aside>";
  }

  var FEATURES = [
    ["Eat, drink and see", "Restaurants, cafés, bakeries, bars, supermarkets, museums and galleries, with opening hours and the step-free way there."],
    ["Yachting", "Chandleries, yacht brokers, clubs and harbour offices around the ports."],
    ["Walks", "Sightseeing walks that use the lifts, and the sea path from Cap d’Ail to Monaco."],
    ["Cruise day", "Set your all-aboard time and we’ll tell you when to head back."],
    ["Use it without mobile data", "Save the map on your phone for when roaming is off."],
    ["Take me home", "Save where you’re staying and get back there from anywhere in one tap."]
  ];

  var screen = {
    html: function () {
      var st = status();
      var head = '<section class="page pro-page"><a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Home")) + "</a>" +
        "<h1>" + badge() + esc(t("Monaco Made Easy Pro")) + "</h1>";
      var state = "";
      if (st === "bought") state = '<p class="pro-ok">' + esc(t("Pro is switched on for this phone. Thank you for supporting Monaco Made Easy.")) + '</p><p class="pro-code">' + esc(t("Your unlock code: {code}", { code: get("mme-pro") })) + "</p>";
      else if (st === "playapp") state = '<p class="pro-ok">' + esc(t("Pro is free in the Google Play version of the app for now.")) + "</p>";
      else if (st === "preview") state = '<p class="pro-ok">' + esc(t("Pro is free for everyone while the app is in preview.")) + "</p>";
      var list = '<ul class="pro-list">' + FEATURES.map(function (f) { return "<li><strong>" + esc(t(f[0])) + "</strong><span>" + esc(t(f[1])) + "</span></li>"; }).join("") + "</ul>";
      var buy = "";
      if (st === "locked") {
        buy = '<div class="pro-buy"><p class="pro-price"><strong>' + esc((inPlayApp() && play.price) || CONFIG.price) + "</strong> " + esc(t("one-off payment. No subscription, no account.")) + "</p>" +
          (inPlayApp() ? (play.ready ? '<button type="button" class="btn btn-red" id="pro-play">' + esc(t("Get Pro for {price}, once", { price: play.price || CONFIG.price })) + "</button>" : '<p class="pro-soon">' + esc(t("Coming soon.")) + "</p>") : CONFIG.payLink ? '<a class="btn btn-red" id="pro-buy" href="' + esc(CONFIG.payLink) + '">' + esc(t("Get Pro")) + "</a>" : '<p class="pro-soon">' + esc(t("Coming soon.")) + "</p>") +
          '<p class="pro-small">' + esc(inPlayApp() ? t("Secure payment by Google Play. Pro switches on as soon as you’ve paid, and comes back if you reinstall the app on the same Google account.") : t("Secure payment by Stripe. Pro switches on as soon as you’ve paid. Not right for you? Email us within 14 days for a full refund.")) + "</p></div>";
      }
      if (st !== "bought" && (get("mme-pro-pending") || get("mme-pro-playpending"))) state += '<div class="pro-pending" role="alert"><p>' + esc(t("We couldn’t confirm your payment yet. Your payment is safe. Tap “Try again”, or email us and we’ll sort it out.")) + "</p>" +
        (lastError ? '<p class="pro-small">(' + esc(lastError) + ")</p>" : "") + '<button type="button" class="btn btn-navy" id="pro-retry">' + esc(t("Try again")) + "</button></div>";
      var have = st === "bought" || st === "preview" || st === "playapp" ? "" :
        '<details class="pro-have"><summary>' + esc(t("Already bought Pro?")) + "</summary>" +
        '<form id="pro-code-f" class="pro-f"><label for="pro-code">' + esc(t("Enter your unlock code")) + '</label><input id="pro-code" autocomplete="off" autocapitalize="characters" placeholder="MME-XXXXX-XXXXXX"><button class="btn btn-navy" type="submit">' + esc(t("Switch on Pro")) + "</button></form>" +
        '<form id="pro-mail-f" class="pro-f"><label for="pro-mail">' + esc(t("Or the email address you paid with")) + '</label><input id="pro-mail" type="email" autocomplete="email"><button class="btn btn-line" type="submit">' + esc(t("Find my purchase")) + "</button></form>" +
        '<p class="form-err" id="pro-err" role="alert" hidden></p></details>';
      return head + state + '<p class="lede-dark">' + esc(t("Everything you need for getting around stays free. Pro adds the rest of a great day in Monaco.")) + "</p>" + list + buy + have +
        '<p class="legal-links"><a href="terms.html">' + esc(t("Terms of sale")) + '</a><a href="privacy.html">' + esc(t("Privacy policy")) + "</a></p></section>";
    },
    mount: function (root) {
      var err = root.querySelector("#pro-err");
      function fail(e) {
        err.hidden = false;
        err.textContent = t(e === "bad-code" ? "That code didn’t work. Check it and try again." :
          e === "no-purchase" ? "We couldn’t find a Pro purchase for that email address." :
          e === "offline" ? "You’re offline. Try again when you have signal." : "Something went wrong. Please try again in a moment.");
      }
      var cf = root.querySelector("#pro-code-f");
      if (cf) cf.addEventListener("submit", function (e) {
        e.preventDefault();
        api({ action: "redeem", code: root.querySelector("#pro-code").value }).then(function (r) { if (r.ok) { unlock(r.code, "code"); } else fail(r.error); });
      });
      var mf = root.querySelector("#pro-mail-f");
      if (mf) mf.addEventListener("submit", function (e) {
        e.preventDefault();
        api({ action: "restore", email: root.querySelector("#pro-mail").value }).then(function (r) { if (r.ok) { unlock(r.code, "email"); } else fail(r.error); });
      });
      var rt = root.querySelector("#pro-retry");
      if (rt) rt.addEventListener("click", function () { rt.disabled = true; retryPending(function () { window.dispatchEvent(new Event("mme-pro")); }); });
      var pb = root.querySelector("#pro-play");
      if (pb) pb.addEventListener("click", function () {
        pb.disabled = true;
        if (window.MMEStats) window.MMEStats.track("Pro Play checkout opened");
        buyOnPlay().then(function () { window.dispatchEvent(new Event("mme-pro")); });
      });
      var b = root.querySelector("#pro-buy");
      if (b) b.addEventListener("click", function () { if (window.MMEStats) window.MMEStats.track("Pro checkout opened"); });
    }
  };

  // Shown once, after someone's first route, to visitors who don't have Pro. Never repeated.
  function tipAfterRoute(body) {
    if (status() !== "locked" || get("mme-pro-tip")) return;
    set("mme-pro-tip", "1");
    var box = document.createElement("aside");
    box.className = "pro-tip";
    box.innerHTML = '<button type="button" class="pt-x" aria-label="' + esc(t("No thanks")) + '">×</button>' +
      '<div class="pl-head">' + badge() + "<strong>" + esc(t("Enjoying the app?")) + "</strong></div>" +
      "<p>" + esc(t("Pro adds restaurants, bars and museums with the step-free way there, sightseeing walks, cruise mode and the offline map.")) + "</p>" +
      '<div class="pt-actions"><a class="btn btn-red" href="#/pro">' + esc(inPlayApp() && !play.ready ? t("What’s included, and how to get it") : t("Get Pro for {price}, once", { price: play.price || CONFIG.price })) + "</a>" +
      '<button type="button" class="btn btn-line pt-no">' + esc(t("No thanks")) + "</button></div>";
    var ref = body.querySelector(".route-fb");
    if (ref) ref.parentNode.insertBefore(box, ref); else body.appendChild(box);
    function close() { box.remove(); }
    box.querySelector(".pt-x").addEventListener("click", close);
    box.querySelector(".pt-no").addEventListener("click", close);
    box.querySelector("a").addEventListener("click", function () { if (window.MMEStats) window.MMEStats.track("Pro tip tapped"); });
    if (window.MMEStats) window.MMEStats.track("Pro tip shown");
  }

  // Coming back from Stripe: ?pro_session=cs_... in the address.
  function checkReturn() {
    var m = /[?&]pro_session=([^&#]+)/.exec(location.search);
    if (!m) return;
    var sid = decodeURIComponent(m[1]);
    try { history.replaceState(null, "", location.pathname + "#/pro"); } catch (e) {}
    api({ action: "claim", session: sid }).then(function (r) {
      if (r.ok) unlock(r.code, "purchase");
      else { set("mme-pro-pending", sid); lastError = r.error || "unavailable"; }
      if (location.hash !== "#/pro") location.hash = "#/pro"; else window.dispatchEvent(new Event("mme-pro"));
    });
  }
  // A purchase that couldn't be confirmed (no signal): try again next time.
  var lastError = null;
  function retryPending(onDone) {
    var pt = get("mme-pro-playpending");
    if (pt) { confirmPlay(pt, "play").then(function (ok) { if (!ok && onDone) onDone(); }); return; }
    var sid = get("mme-pro-pending");
    if (!sid) return;
    api({ action: "claim", session: sid }).then(function (r) {
      if (r.ok) { set("mme-pro-pending", null); lastError = null; unlock(r.code, "purchase"); }
      else { lastError = r.error || "unavailable"; if (onDone) onDone(); }
    });
  }

  // #/pro?preview=locked shows the app as a non-paying visitor will see it; #/pro?preview=on goes back.
  function previewSwitch() {
    var m = /preview=(locked|on)/.exec(location.hash);
    if (m) set("mme-pro-test", m[1] === "locked" ? "locked" : null);
  }

  playInit();
  window.MMEPro = { CONFIG: CONFIG, inPlayApp: inPlayApp, status: status, isPro: isPro, lockCard: lockCard, badge: badge, screen: screen, tipAfterRoute: tipAfterRoute, checkReturn: checkReturn, retryPending: retryPending, previewSwitch: previewSwitch };
})();
