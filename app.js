(function () {
  "use strict";
  var D = window.MME;
  window.MMEI18N.init();
  var t = window.MMEI18N.t;
  // Real lift and escalator positions from OpenStreetMap, plus Beausoleil's (approximate until checked).
  if (window.MMEOsmLifts) D.lifts = window.MMEOsmLifts.concat(D.lifts.filter(function (l) { return l.area === "Beausoleil"; }));
  var main = document.getElementById("main");
  var filter = "all";      // all | stepfree | beausoleil
  var placeFilter = null;  // a place id from the height chart

  var COLORS = { lift: "#ce1126", escalator: "#1d6fa5", walk: "#8a96a3", bus: "#0f8b6e", arrive: "#0b2545", steps: "#d9480f" };

  var ICONS = {
    lift: '<path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm6 3l-3.5 4h7zm0 12l3.5-4h-7z"/>',
    escalator: '<path d="M3 19h4l9-11h5V5h-6.4l-9 11H3z"/>',
    walk: '<path d="M13.5 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 8.5l3-1 2 .6 2.4 3.4-1.6 1.1-1.8-2.4-.9 3.4 2.4 2.8V22h-2v-5.6l-2.3-2.4-1 3.7L7.3 22l-1.9-.9 2.6-4.6L10 8.5zm-1.4 1.2L7 14.2l-1.9-.6 1.8-5 1.7 1.1z"/>',
    bus: '<path d="M6 3h12a2 2 0 0 1 2 2v12a2 2 0 0 1-1 1.7V21h-3v-2H8v2H5v-2.3A2 2 0 0 1 4 17V5a2 2 0 0 1 2-2zm0 3v5h12V6zm1.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
    steps: '<path d="M3 20v-3h4v-4h4V9h4V5h6v3h-3v4h-4v4h-4v4z"/>',
    arrive: '<path d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>',
    toilets: '<text x="12" y="16.2" font-size="10.5" font-weight="700" text-anchor="middle" font-family="Arial, sans-serif">WC</text>',
    pharmacy: '<path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z"/>',
    atm: '<path d="M2 6h20v12H2zm2 2v8h16V8zm8 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM5.5 10.5h2v3h-2zm11 0h2v3h-2z"/>',
    drinking_water: '<path d="M12 2.5s6.5 7 6.5 11.8a6.5 6.5 0 0 1-13 0C5.5 9.5 12 2.5 12 2.5z"/>',
    defibrillator: '<path fill-rule="evenodd" d="M12 21 3.6 12.8A5 5 0 0 1 12 6.4a5 5 0 0 1 8.4 6.4zM12.8 8.5 9 13.2h2.6l-1.3 4.3 4.2-5.4h-2.7z"/>',
    eat: '<path d="M4.5 2H6v5h1V2h1.5v5h1V2H11v6a2.5 2.5 0 0 1-2 2.45V22H7V10.45A2.5 2.5 0 0 1 4.5 8zM18 2v20h-2v-8h-2.5V8c0-3 1.6-5.4 4.5-6z"/>',
    cafe: '<path d="M3 8h14v2h1.5a3.5 3.5 0 0 1 0 7h-2A6.5 6.5 0 0 1 10 21H9.5A6.5 6.5 0 0 1 3 14.5zm14 4v3h1.5a1.5 1.5 0 0 0 0-3zM7 2.5h2c0 1.3-1 1.7-1 3h-2c0-1.3 1-1.7 1-3zm4 0h2c0 1.3-1 1.7-1 3h-2c0-1.3 1-1.7 1-3z"/>',
    shop: '<path d="M5.5 9 9 3.5l1.7 1L7.8 9h8.4l-2.9-4.5 1.7-1L18.5 9H22v2h-1.2l-1.6 9.2a1.5 1.5 0 0 1-1.5 1.3H6.3a1.5 1.5 0 0 1-1.5-1.3L3.2 11H2V9z"/>',
    tabac: '<path d="M2 13h15v4H2zm16 0h1.6v4H18zm2.4 0H22v4h-1.6zM17.5 6.5c0-1.6 1.3-2.5 2.6-2.5v1.6c-.6 0-1 .4-1 .9 0 1.6 2.9 1.6 2.9 4.5h-1.6c0-1.8-2.9-2-2.9-4.5z"/>',
    bakery: '<path d="M12 4c5 0 9 2.2 9 5 0 1.2-.8 2-2 2.4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7.6C3.8 11 3 10.2 3 9c0-2.8 4-5 9-5z"/>',
    bar: '<path d="M3 3h18l-8 9.2V19h4v2H7v-2h4v-6.8zm4.4 2 4.6 5.3L16.6 5z"/>',
    culture: '<path d="M12 2 2 7v2h20V7zM4 10h2.5v8H4zm4.75 0h2.5v8h-2.5zm4.5 0h2.5v8h-2.5zM17.5 10H20v8h-2.5zM2 19h20v3H2z"/>',
    yacht: '<path d="M12 2a3 3 0 0 1 1 5.83V10h3v2h-3v7.9A7 7 0 0 0 18.9 15h-2.4l3-4 3 4h-1.6A9 9 0 0 1 3.1 15H1.5l3-4 3 4H5.1A7 7 0 0 0 11 19.9V12H8v-2h3V7.83A3 3 0 0 1 12 2zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
    broker: '<path d="M11 2.5V13H4.5zM13 5.5l6.5 7.5H13zM2 15h20l-2.6 5.2a1.5 1.5 0 0 1-1.3.8H5.9a1.5 1.5 0 0 1-1.3-.8z"/>',
    club: '<path d="M5 2h2v20H5zM8 3l13 4.5L8 12z"/>',
    phone: '<path d="M6.6 2.5 9.4 6a1.5 1.5 0 0 1-.1 2l-1.6 1.5a12 12 0 0 0 6.8 6.8l1.5-1.6a1.5 1.5 0 0 1 2-.1l3.5 2.8a1.5 1.5 0 0 1 .2 2.1l-1.4 1.7A3 3 0 0 1 17.5 22 15.5 15.5 0 0 1 2 6.5a3 3 0 0 1 .8-2.8l1.7-1.4a1.5 1.5 0 0 1 2.1.2z"/>',
    calendar: '<path d="M7 2h2v2h6V2h2v2h2.5A1.5 1.5 0 0 1 21 5.5v14a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-14A1.5 1.5 0 0 1 4.5 4H7zM5 9v10h14V9zm2 2h4v4H7z"/>',
    star: '<path d="M12 2.5l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.8l-5.9 3.7 1.7-6.7-5.3-4.4 6.9-.5z"/>',
    suitcase: '<path d="M9 2.5h6A1.5 1.5 0 0 1 16.5 4v2h3A1.5 1.5 0 0 1 21 7.5v11a1.5 1.5 0 0 1-1.5 1.5H19v1.5h-2V20H7v1.5H5V20h-.5A1.5 1.5 0 0 1 3 18.5v-11A1.5 1.5 0 0 1 4.5 6h3V4A1.5 1.5 0 0 1 9 2.5zm.5 2V6h5V4.5zM8 9v8h2V9zm6 0v8h2V9z"/>',
    house: '<path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z"/>',
    info: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 8v8h2.6v-8zM12 5.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>'
  };
  function icon(type, cls) {
    return '<svg class="' + (cls || "ico") + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[type] + "</svg>";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  // Translated names for our own places (street and lift names stay as they are on the signs).
  function placeName(p) { return t(p.name); }
  function placeShort(p) { return t(p.short); }
  window.MMEUI = { esc: esc, icon: icon, COLORS: COLORS, placeName: placeName, placeShort: placeShort };

  // ---------- Height chart: Monaco seen side-on ----------
  function heightChart() {
    var W = 360, H = 230, top = 18, bottom = 196, left = 34, right = 350;
    var maxH = 110;
    function X(x) { return left + (x / 100) * (right - left); }
    function Y(h) { return bottom - (h / maxH) * (bottom - top); }
    var s = '<svg class="hchart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("Monaco places plotted by height above the sea, with the routes that link them")) + '">';
    s += '<path class="sea" d="M0 ' + (Y(0) + 4) + " q 12 -5 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 V " + H + ' H 0 Z"/>';
    [0, 25, 50, 75, 100].forEach(function (h) {
      s += '<line class="grid" x1="' + left + '" x2="' + right + '" y1="' + Y(h) + '" y2="' + Y(h) + '"/>';
      s += '<text class="gl" x="' + (left - 6) + '" y="' + (Y(h) + 4) + '">' + h + (h === 100 ? " m" : "") + "</text>";
    });
    D.routes.forEach(function (r) {
      var a = D.places[r.from], b = D.places[r.to];
      var x1 = X(a.x), y1 = Y(a.height), x2 = X(b.x), y2 = Y(b.height);
      var cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 26;
      var dim = placeFilter && r.from !== placeFilter && r.to !== placeFilter;
      s += '<path class="arc' + (r.stepFree ? " sf" : "") + (dim ? " dim" : "") + '" d="M' + x1 + " " + y1 + " Q " + cx + " " + cy + " " + x2 + " " + y2 + '"/>';
    });
    Object.keys(D.places).forEach(function (id) {
      var p = D.places[id];
      var x = X(p.x), y = Y(p.height);
      var on = placeFilter === id;
      // label position: a = above, b = below, r = right of the dot
      var anchor = "middle", lx = x, ly = y + 19;
      if (p.label === "a") ly = y - 11;
      if (p.label === "r") { anchor = "start"; lx = x + 10; ly = y + 4.5; }
      if (p.label === "b" && p.x > 85) anchor = "end", lx = x + 6;
      s += '<g class="pt' + (on ? " on" : "") + '" data-place="' + id + '" tabindex="0" role="button" aria-label="' + esc(t("Show routes for {place}", { place: placeName(p) })) + '">';
      s += '<circle cx="' + x + '" cy="' + y + '" r="14" class="hit"/>';
      s += '<circle cx="' + x + '" cy="' + y + '" r="' + (on ? 6.5 : 5) + '" class="dot"/>';
      s += '<text x="' + lx + '" y="' + ly + '" text-anchor="' + anchor + '">' + esc(placeShort(p)) + "</text></g>";
    });
    return s + "</svg>";
  }

  // ---------- Height profile for one route ----------
  function profile(r, big) {
    var W = big ? 340 : 120, H = big ? 150 : 40, pad = big ? 18 : 4;
    var hs = r.steps.map(function (s) { return s.h; });
    var maxH = Math.max.apply(null, hs.concat([20])), minH = 0;
    // Lifts are drawn nearly vertical, escalators steep, walks take a full share of the width.
    function legW(ty) { return ty === "lift" ? 0.16 : ty === "escalator" ? 0.45 : ty === "arrive" ? 0 : 1; }
    var total = r.steps.reduce(function (a, s) { return a + legW(s.type); }, 0) || 1;
    var usable = W - pad * 2;
    function Y(h) { return H - pad - ((h - minH) / (maxH - minH)) * (H - pad * 2 - (big ? 14 : 0)); }
    var x = pad, pts = [[x, Y(r.steps[0].h), "start", r.steps[0].h]];
    r.steps.forEach(function (s) {
      if (s.type === "arrive") return;
      x += (legW(s.type) / total) * usable;
      pts.push([x, Y(s.h), s.type, s.h]);
    });
    var out = '<svg class="' + (big ? "prof" : "spark") + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">';
    if (big) {
      out += '<line class="base" x1="0" x2="' + W + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
      out += '<text class="sea-l" x="' + (W - 2) + '" y="' + (Y(0) - 5) + '" text-anchor="end">' + esc(t("sea level")) + "</text>";
    }
    for (var i = 1; i < pts.length; i++) {
      var ty = pts[i][2];
      out += '<line class="seg seg-' + ty + '" x1="' + pts[i - 1][0] + '" y1="' + pts[i - 1][1] + '" x2="' + pts[i][0] + '" y2="' + pts[i][1] + '" stroke="' + COLORS[ty] + '"/>';
    }
    if (big) {
      pts.forEach(function (p, i) {
        out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" class="pdot"/>';
        if (i === 0 || i === pts.length - 1) {
          var below = i === 0 && p[1] < 30;
          out += '<text class="ph" x="' + (i === 0 ? p[0] - 2 : p[0]) + '" y="' + (below ? p[1] + 20 : p[1] - 10) + '" text-anchor="' + (i === 0 ? "start" : "end") + '">' + p[3] + " m</text>";
        }
      });
    }
    return out + "</svg>";
  }

  function routeMatches(r) {
    if (placeFilter && r.from !== placeFilter && r.to !== placeFilter) return false;
    if (filter === "stepfree") return r.stepFree;
    if (filter === "beausoleil") return r.from === "beausoleil" || r.to === "beausoleil";
    return true;
  }

  // Uphill routes show the climb saved; downhill ones show how far down they go.
  function heightLine(r) {
    var first = r.steps[0].h, last = r.steps[r.steps.length - 1].h;
    return last >= first ? t("Saves a {n} m climb", { n: r.climbSaved }) : t("{n} m downhill", { n: first - last });
  }

  function routeTitle(r) { return t("{from} to {to}", { from: placeName(D.places[r.from]), to: placeName(D.places[r.to]) }); }

  function routeCard(r) {
    var from = D.places[r.from], to = D.places[r.to];
    var art = r.photo
      ? '<img class="rc-photo" src="' + esc(r.photo) + '" alt="" loading="lazy">'
      : '<span class="rc-art">' + profile(r, true) + '<span class="rc-ends"><span>' + esc(placeShort(from)) + "</span><span>" + esc(placeShort(to)) + "</span></span></span>";
    return '<li><a class="rcard" href="#/go/' + r.id + '">' + art +
      '<span class="rc-body"><span class="rc-title">' + esc(routeTitle(r)) + "</span>" +
      '<span class="rc-meta"><span>' + esc(t("{n} min", { n: r.minutes })) + "</span>" +
      (r.stepFree ? '<span class="sf-pill">' + esc(t("Step-free")) + "</span>" : '<span class="some-steps">' + esc(t("Some steps")) + "</span>") +
      "<span>" + esc(heightLine(r)) + "</span></span></span></a></li>";
  }

  // ---------- Screens ----------
  var X = window.MMEExtras;
  function home() {
    var list = D.routes.filter(routeMatches);
    var chips = [["all", t("All routes")], ["stepfree", t("Step-free only")], ["beausoleil", t("Beausoleil")]];
    var pf = placeFilter ? D.places[placeFilter] : null;
    return '<section class="hero">' +
      '<div class="hero-head"><h1>' + esc(t("Monaco, without the climb.")) + "</h1>" +
      '<p class="lede">' + esc(t("Around 80 free public lifts, 37 escalators and 8 moving walkways link Monaco, Beausoleil and Cap d’Ail. We show you how to use them, and we cover Roquebrune and Cap Martin too.")) + "</p></div>" +
      (window.MMEWeather ? window.MMEWeather.strip() : "") +
      (X ? X.eventBanner() + X.cruiseCard() : "") + (window.MMEWalks ? window.MMEWalks.guardCard() : "") +
      window.MMEPlanner.boxHtml() + stayList() + essQuick() +
      "</section>" +
      (window.MMEInstall ? window.MMEInstall.card("home") + window.MMEInstall.rateCard() : "") +
      (window.MMEGuide ? guideBlock() : "") +
      (window.MMEWalks ? window.MMEWalks.walksBlock() : "") +
      guidesBlock(" block") +
      (window.MMEInstall ? window.MMEInstall.shareCard() : "") +
      '<section class="block" id="routes" aria-labelledby="routes-h">' +
      '<div class="block-head"><h2 id="routes-h">' + esc(pf ? t("Routes for {place}", { place: placeShort(pf) }) : t("Popular routes")) + "</h2>" +
      (pf ? '<button type="button" class="link-btn" data-clear>' + esc(t("Show all")) + "</button>" : "") + "</div>" +
      '<div class="chips" role="group" aria-label="' + esc(t("Filter routes")) + '">' + chips.map(function (c) {
        return '<button type="button" class="chip' + (filter === c[0] ? " on" : "") + '" data-filter="' + c[0] + '" aria-pressed="' + (filter === c[0]) + '">' + esc(c[1]) + "</button>";
      }).join("") + "</div>" +
      (list.length ? '<ul class="rlist">' + list.map(routeCard).join("") + "</ul>" :
        '<p class="empty">' + esc(t("We haven’t written a route with that filter yet.")) + " " + (pf ? '<a href="https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + pf.lat + "," + pf.lng + '" target="_blank" rel="noopener">' + esc(t("Walking directions in Google Maps")) + "</a>" : "") + "</p>") +
      "</section>" +
      '<section class="side-on"><figure class="chart-card"><figcaption><span>' + esc(t("Monaco, side on")) + '</span><span class="key"><i class="k-sf"></i>' + esc(t("Step-free")) + ' <i class="k-st"></i>' + esc(t("Some steps")) + "</span></figcaption>" + heightChart() + '<p class="chart-hint">' + esc(t("Monaco climbs 100 m from the sea. Tap a place to see its routes.")) + "</p></figure></section>";
  }

  // The guide: eat, drink, see.
  function guideBlock() {
    var P = window.MMEPro, G = window.MMEGuide;
    return '<section class="block guide-block"><div class="block-head"><h2>' + esc(t("Eat, drink and see")) + "</h2>" + (P ? P.badge() : "") + '</div><p class="block-lede">' +
      esc(t("Restaurants, bars, museums and more, each with the step-free way there.")) + '</p>' +
      '<a class="g-searchlink" href="#/guide/find"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg><span>' + esc(t("Search the guide")) + '</span></a>' +
      '<nav class="g-quick"><a href="#/guide/saved"><span class="eq-ico" style="--c:#ce1126"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.8 5 21 8.3 19.5 11.8 17.5 16.4 12 21 12 21z"/></svg></span>' + esc(t("My places")) + "</a>" + G.CATS.map(function (c) {
        return '<a href="#/guide/' + c[0] + '"><span class="eq-ico" style="--c:' + G.COLOR[c[0]] + '">' + icon(c[0]) + "</span>" + esc(t(c[1])) + "</a>";
      }).join("") + "</nav></section>";
  }

  // The visit, in one quiet list: arriving, where you're staying, the season, and what to know.
  var CHEV = '<svg class="sl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.4 10 4l8 8-8 8-1.4-1.4 6.6-6.6z"/></svg>';
  function stayRow(href, ico, title, sub, cls) {
    return '<li><a class="sl-row' + (cls ? " " + cls : "") + '" href="' + href + '"><span class="sl-ico">' + icon(ico) + '</span><span class="sl-txt"><strong>' + esc(title) + "</strong>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" + CHEV + "</a></li>";
  }
  function stayList() {
    if (!X) return "";
    var h = X.Home.get();
    return '<ul class="stay-list">' +
      stayRow("#/arrive", "suitcase", t("Just arrived?"), t("The easiest way to where you’re staying, with your bags")) +
      (h ? stayRow("#/home-route", "house", t("Back to {name}", { name: t(h.label) }), t("The easiest way from where you are now")) :
        stayRow("#/stay", "house", t("Where are you staying?"), t("Save it once, then one tap gets you back from anywhere."))) +
      (X.xmasSeason() ? stayRow("#/christmas", "star", t("Christmas in Monaco"), t("The Christmas village, the ice rink, the lights and New Year’s Eve, and the easy way between them."), "sl-season") : "") +
      stayRow("#/info", "info", t("Know before you go: phone roaming, dress rules and the Casino"), "") +
      "</ul>" + (h ? '<a class="home-change" href="#/stay">' + esc(t("Change where I’m staying")) + "</a>" : "");
  }

  // Quick links to the nearest toilets, pharmacy, cash machine and water, and the other everyday things.
  function essQuick() {
    var items = [["#/map/toilets", "toilets", "Toilets"], ["#/map/pharmacy", "pharmacy", "Pharmacy"], ["#/map/atm", "atm", "Cash machine"], ["#/map/drinking_water", "drinking_water", "Drinking water"],
      ["#/info", "phone", "Emergency numbers"], ["#/whats-on", "calendar", "What’s on"], ["#/yachts", "yacht", "Yachts in port"], ["#/map/near", "lift", "Lifts near me"]];
    return '<nav class="ess-grid" aria-label="' + esc(t("Nearest essentials")) + '">' + items.map(function (i) {
      return '<a href="' + i[0] + '"><span class="eg-ico">' + icon(i[1]) + "</span><span>" + esc(t(i[2])) + "</span></a>";
    }).join("") + "</nav>";
  }

  // Links to the visitor guide pages, in the visitor's language.
  function guidesBlock(cls) {
    var L = window.MMEI18N.lang(), G = window.MMEGuideTitles && window.MMEGuideTitles[L];
    return '<section class="gp-links' + cls + '"><h2>' + esc(t("Guides for visitors")) + '</h2><ul>' + [["monaco-public-lifts.html", "Monaco’s free public lifts and escalators"], ["step-free-monaco.html", "Step-free Monaco: wheelchairs and pushchairs"], ["monaco-train-station.html", "Monaco Monte-Carlo station: which exit?"], ["cap-dail-sea-path.html", "The sea path from Cap d’Ail to Monaco"], ["beausoleil.html", "Getting around Beausoleil"], ["roquebrune-cap-martin.html", "Roquebrune-Cap-Martin and the Promenade Le Corbusier"]].map(function (g) {
      return '<li><a href="' + (L === "en" ? "" : L + "/") + g[0] + '">' + esc(G ? G[g[0]] : g[1]) + "</a></li>";
    }).join("") + "</ul></section>";
  }

  function infoPage() {
    var items = [
      [t("Free to use"), t("Every public lift, escalator and moving walkway in Monaco is free.")],
      [t("Follow the blue signs"), t("Look for blue signs with a lift symbol, and doors marked “Ascenseur public”. Many are tucked inside buildings and car parks.")],
      [t("Opening hours"), t("Monaco’s public lifts are generally open day and night, but a few close overnight. Beausoleil’s lifts were reported in 2020 to run from 5am to 9pm.")],
      [t("Buses"), t("Monaco’s buses climb the hills for you. See the Transport tab for the next buses near you.")],
      [t("Across the harbour"), t("The small electric Bateau-Bus ferry crosses Port Hercule and has a boarding ramp.")],
      [t("Accessible toilets"), t("There are accessible toilets at the Casino Square tourist office, the Oceanographic Museum, the Grimaldi Forum, Larvotto Beach and Port Hercule.")],
      [t("Cap d'Ail"), t("Cap d’Ail is in France, just west of Fontvieille, with no border checks. A flat seaside path links it to Monaco, and it has beaches, restaurants and a small harbour.")],
      [t("Roquebrune and Cap Martin"), t("Roquebrune-Cap-Martin is in France, just east of Monaco. Its medieval village and castle sit on the hill, and the Promenade Le Corbusier runs round Cap Martin by the sea. Trains stop at Roquebrune-Cap-Martin and Carnolès.")],
      [t("Beausoleil"), t("Beausoleil is in France, right behind Monte-Carlo. The border is just a street, with no checks. It’s steep, so plan to use the lifts on the way back up.")],
      [t("Where our data comes from"), t("Streets, paths, lifts and escalators: © OpenStreetMap contributors (ODbL). Heights: Terrain Tiles from AWS Open Data (Mapzen and others). Map style: © CARTO. Buses: Compagnie des Autobus de Monaco open data.")]
    ];
    // Emergency numbers first: one tap to call. Monaco numbers from the Monaco government; France from service-public.fr.
    function call(tel, label, sub) { return '<li' + (tel.length > 5 ? ' class="sos-long"' : "") + '><a href="tel:' + tel.replace(/[^+\d]/g, "") + '"><b>' + esc(tel) + "</b><span>" + esc(label) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span></a></li>"; }
    var sos = '<section class="sos" id="emergency"><h2>' + esc(t("Emergency numbers")) + '</h2><p class="sos-lede">' + esc(t("Tap a number to call. 112 works from any phone, in Monaco and France.")) + "</p>" +
      '<ul class="sos-list">' + call("112", t("Any emergency"), t("Free, from any phone")) + call("18", t("Fire and ambulance")) + call("17", t("Police")) + "</ul>" +
      '<h3 class="sos-h">' + esc(t("In Monaco")) + '</h3><ul class="sos-list">' +
      call("+377 97 98 97 69", t("Princess Grace Hospital, emergency department"), "Avenue Pasteur") + call("+377 93 15 30 15", t("Police (Sûreté Publique)")) + "</ul>" +
      '<p class="sos-more"><a href="https://www.monacosante.mc/en/emergency-contact-numbers/emergency-contact-numbers" target="_blank" rel="noopener">' + esc(t("Today’s on-duty doctor and pharmacy in Monaco")) + "</a></p>" +
      '<h3 class="sos-h">' + esc(t("In Beausoleil, Cap d’Ail and Roquebrune (France)")) + '</h3><ul class="sos-list">' +
      call("15", t("Medical emergency (SAMU)")) + call("3237", t("On-duty pharmacy (French side)"), t("Paid call")) + "</ul>" +
      '<p class="sos-more">' + esc(t("Poison centre (Marseille): +33 4 91 75 25 25")) + "</p></section>";
    return '<section class="page"><h1>' + esc(t("Good to know")) + "</h1>" + sos + (X ? X.knowCard() + X.offlineCard() : "") +
      '<a class="pro-link" href="#/pro">' + (window.MMEPro ? window.MMEPro.badge() : "") + "<span><strong>" + esc(t("Monaco Made Easy Pro")) + "</strong><small>" + esc(t("What’s included, and how to get it")) + "</small></span></a>" +
      (window.MMEInstall ? window.MMEInstall.card("info") + window.MMEInstall.shareCard() : "") +
      '<p class="play-soon">' + esc(t("Coming soon to Google Play. You can already add this app to your home screen: in your browser’s menu, choose “Add to Home Screen”.")) + "</p>" + '<dl class="info">' + items.map(function (i) {
      return "<div><dt>" + esc(i[0]) + "</dt><dd>" + esc(i[1]) + "</dd></div>";
    }).join("") + "</dl>" + (X ? X.eventsInfo() : "") +
      guidesBlock("") + '<p class="unchecked">' + esc(t("This is a preview. Details are gathered from published sources and are being checked on the ground before launch.")) + "</p>" +
      '<p class="legal-links"><a href="mailto:hello@monacomadeeasy.com?subject=' + encodeURIComponent("Monaco Made Easy feedback") + '">' + esc(t("Spotted something wrong? Tell us")) + '</a><a href="https://www.instagram.com/monacomadeeasy/" target="_blank" rel="noopener">Instagram</a><a href="https://x.com/Monacomadeeasy" target="_blank" rel="noopener">X</a><a href="privacy.html">' + esc(t("Privacy policy")) + '</a><a href="terms.html">' + esc(t("Terms of sale")) + "</a></p></section>";
  }

  // ---------- Router ----------
  function render() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/");
    var tab = "routes", html, screen = null;
    // Pro features go straight to the Pro page for visitors who haven't bought it.
    var P = window.MMEPro, sub = (parts[1] || "").split("?")[0];
    if (P && !P.isPro() && ((parts[0].split("?")[0] === "guide") || parts[0] === "walk" || parts[0] === "walks" || parts[0] === "cruise")) {
      if (window.MMEStats) window.MMEStats.track("Pro feature tapped", { what: parts[0] + (sub ? "/" + sub : "") });
      location.replace("#/pro"); return;
    }
    if (parts[0] === "route") { location.replace("#/go/" + parts[1]); return; }
    else if (parts[0] === "map" || parts[0] === "lifts") { screen = window.MMEMap.screen; tab = "map"; }
    else if (parts[0] === "survey") { screen = window.MMESurvey.screen; tab = ""; }
    else if (parts[0] === "info") { html = infoPage(); tab = "info"; }
    else if (parts[0] === "whats-on" && X) { screen = X.whatsOnScreen; tab = "info"; }
    else if (parts[0] === "yachts" && X) { screen = X.yachtsScreen; tab = "info"; }
    else if (parts[0] === "christmas" && X) { screen = X.xmasScreen; tab = "info"; }
    else if (parts[0] === "guide") { screen = window.MMEGuide.screen; tab = "guide"; }
    else if (parts[0].indexOf("pro") === 0) { window.MMEPro.previewSwitch(); screen = window.MMEPro.screen; }
    else if (parts[0] === "cruise") { screen = X.cruiseScreen; tab = "transport"; }
    else if (parts[0] === "walk" || parts[0] === "walks") {
      var wid = parts[1];
      screen = { html: function () { return window.MMEWalks.walkScreen.html(wid); }, mount: function (el) { window.MMEWalks.walkScreen.mount(el, wid); } };
    }
    else if (parts[0] === "to-palace") { window.MMEWalks.toPalace(); location.replace("#/plan"); return; }
    else if (parts[0] === "home-route") { location.replace(window.MMEPlanner.homeRoute() ? "#/plan" : "#/arrive"); return; }
    else if (parts[0] === "ship") { location.replace(window.MMEPlanner.shipRoute() ? "#/plan" : "#/cruise"); return; }
    else if (parts[0] === "plan") { screen = window.MMEPlanner.screen; }
    else if (parts[0] === "stay") { screen = window.MMEPlanner.stayScreen; }
    else if (parts[0] === "arrive") { screen = window.MMEPlanner.arriveScreen; }
    else if (parts[0] === "transport" && window.MMETransit.ready) { screen = window.MMETransit.transportScreen; tab = "transport"; }
    else if (parts[0] === "taxis") { screen = window.MMETransit.taxiScreen; tab = "transport"; }
    else if (parts[0] === "airport") { screen = window.MMETransit.airportScreen; tab = "transport"; }
    else if (parts[0] === "bus" && window.MMETransit.ready) {
      var lid = parts[1];
      screen = { html: function () { return window.MMETransit.lineScreen.html(lid); }, mount: function (el) { window.MMETransit.lineScreen.mount(el, lid); } };
      tab = "transport";
    }
    else if (parts[0] === "go") { location.replace(window.MMEPlanner.go(parts[1]) ? "#/plan" : "#/"); return; }
    else if (/^to(\?|$)/.test(parts[0])) { location.replace(window.MMEPlanner.toLink(location.hash) ? "#/plan" : "#/"); return; }
    else if (parts[0].indexOf("from") === 0) { window.MMEPlanner.fromLink(location.hash); location.replace("#/"); return; }
    else html = home();
    main.innerHTML = screen ? screen.html() : html;
    document.body.classList.toggle("is-map", tab === "map" || tab === "guide");
    if (screen) screen.mount(main.firstElementChild);
    if (window.MMEInstall) window.MMEInstall.mount(main);
    if (!parts[0]) { if (window.MMEWeather) window.MMEWeather.mount(main); window.MMEPlanner.mountBox(main); if (X) X.mountHome(main); }
    else if (parts[0] === "info" && X) X.mountOffline(main);
    document.querySelectorAll(".tabs a").forEach(function (a) {
      if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  main.addEventListener("click", function (e) {
    var f = e.target.closest("[data-filter]");
    if (f) { filter = f.dataset.filter; render(); return; }
    var p = e.target.closest("[data-place]");
    if (p) { placeFilter = placeFilter === p.dataset.place ? null : p.dataset.place; render(); return; }
    if (e.target.closest("[data-clear]")) { placeFilter = null; render(); }
  });
  main.addEventListener("keydown", function (e) {
    var p = e.target.closest && e.target.closest("[data-place]");
    if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); p.click(); }
  });
  window.addEventListener("hashchange", function () { render(); window.scrollTo(0, 0); });
  if (window.MMEStats) window.MMEStats.track("App opened", { lang: window.MMEI18N.lang() });
  // Changing language redraws the current screen in the new language.
  window.addEventListener("mme-lang", function () { render(); });
  // Dark mode: the moon/sun button in the top bar. Remembered on this phone.
  (function () {
    var b = document.getElementById("theme-btn"), root = document.documentElement;
    if (!b) return;
    function show() {
      var dark = root.getAttribute("data-theme") === "dark";
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", t(dark ? "Light mode" : "Dark mode"));
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", dark ? "#121d29" : "#fffdf8");
    }
    b.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("mme-theme", next); } catch (e) {}
      show();
      if (window.MMEStats) window.MMEStats.track("Theme", { theme: next });
    });
    window.addEventListener("mme-lang", show);
    show();
  })();
  // A newer bus timetable arrived: redraw the transport screens.
  window.addEventListener("mme-bus", function () { if (/^#\/(transport|bus)/.test(location.hash)) render(); });
  // Pro switched on (or off): redraw.
  window.addEventListener("mme-pro", function () { render(); });
  if (window.MMEPro) { window.MMEPro.checkReturn(); window.MMEPro.retryPending(); }
  render();

  // Works offline once opened: cache the app on the phone.
  try { localStorage.removeItem("mme-first-open"); } catch (e) {}
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(function () {}); });
    // The app opens from the saved copy. If a newer version arrives in the first few seconds,
    // reload once on the home screen so people get it straight away (never in the middle of a route).
    var hadSW = !!navigator.serviceWorker.controller, openedAt = Date.now(), reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadSW || reloaded) return;
      if (Date.now() - openedAt < 15000 && (!location.hash || location.hash === "#/")) { reloaded = true; location.reload(); }
    });
  }
})();
