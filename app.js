(function () {
  "use strict";
  var D = window.MME;
  var main = document.getElementById("main");
  var filter = "all";      // all | stepfree | beausoleil
  var placeFilter = null;  // a place id from the height chart

  var COLORS = { lift: "#ce1126", escalator: "#1d6fa5", walk: "#8a96a3", bus: "#0f8b6e", arrive: "#0b2545" };
  var LABELS = { lift: "Lift", escalator: "Escalator", walk: "Walk", bus: "Bus", arrive: "Arrive" };

  var ICONS = {
    lift: '<path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm6 3l-3.5 4h7zm0 12l3.5-4h-7z"/>',
    escalator: '<path d="M3 19h4l9-11h5V5h-6.4l-9 11H3z"/>',
    walk: '<path d="M13.5 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 8.5l3-1 2 .6 2.4 3.4-1.6 1.1-1.8-2.4-.9 3.4 2.4 2.8V22h-2v-5.6l-2.3-2.4-1 3.7L7.3 22l-1.9-.9 2.6-4.6L10 8.5zm-1.4 1.2L7 14.2l-1.9-.6 1.8-5 1.7 1.1z"/>',
    bus: '<path d="M6 3h12a2 2 0 0 1 2 2v12a2 2 0 0 1-1 1.7V21h-3v-2H8v2H5v-2.3A2 2 0 0 1 4 17V5a2 2 0 0 1 2-2zm0 3v5h12V6zm1.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
    arrive: '<path d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>'
  };
  function icon(type, cls) {
    return '<svg class="' + (cls || "ico") + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[type] + "</svg>";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function mapsLink(q) {
    return "https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=" + encodeURIComponent(q);
  }

  // ---------- Height chart: Monaco seen side-on ----------
  function heightChart() {
    var W = 360, H = 230, top = 18, bottom = 196, left = 34, right = 350;
    var maxH = 110;
    function X(x) { return left + (x / 100) * (right - left); }
    function Y(h) { return bottom - (h / maxH) * (bottom - top); }
    var s = '<svg class="hchart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Monaco places plotted by height above the sea, with the routes that link them">';
    // sea
    s += '<path class="sea" d="M0 ' + (Y(0) + 4) + " q 12 -5 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 V " + H + ' H 0 Z"/>';
    // gridlines
    [0, 25, 50, 75, 100].forEach(function (h) {
      s += '<line class="grid" x1="' + left + '" x2="' + right + '" y1="' + Y(h) + '" y2="' + Y(h) + '"/>';
      s += '<text class="gl" x="' + (left - 6) + '" y="' + (Y(h) + 4) + '">' + h + (h === 100 ? " m" : "") + "</text>";
    });
    // routes as arcs
    D.routes.forEach(function (r) {
      var a = D.places[r.from], b = D.places[r.to];
      var x1 = X(a.x), y1 = Y(a.height), x2 = X(b.x), y2 = Y(b.height);
      var cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 26;
      var dim = placeFilter && r.from !== placeFilter && r.to !== placeFilter;
      s += '<path class="arc' + (r.stepFree ? " sf" : "") + (dim ? " dim" : "") + '" d="M' + x1 + " " + y1 + " Q " + cx + " " + cy + " " + x2 + " " + y2 + '"/>';
    });
    // places
    Object.keys(D.places).forEach(function (id) {
      var p = D.places[id];
      var x = X(p.x), y = Y(p.height);
      var on = placeFilter === id;
      // label position: a = above, b = below, r = right of the dot
      var anchor = "middle", lx = x, ly = y + 19;
      if (p.label === "a") ly = y - 11;
      if (p.label === "r") { anchor = "start"; lx = x + 10; ly = y + 4.5; }
      if (p.label === "b" && p.x > 85) anchor = "end", lx = x + 6;
      s += '<g class="pt' + (on ? " on" : "") + '" data-place="' + id + '" tabindex="0" role="button" aria-label="Show routes for ' + esc(p.name) + '">';
      s += '<circle cx="' + x + '" cy="' + y + '" r="14" class="hit"/>';
      s += '<circle cx="' + x + '" cy="' + y + '" r="' + (on ? 6.5 : 5) + '" class="dot"/>';
      s += '<text x="' + lx + '" y="' + ly + '" text-anchor="' + anchor + '">' + esc(p.short) + "</text></g>";
    });
    return s + "</svg>";
  }

  // ---------- Height profile for one route ----------
  function profile(r, big) {
    var W = big ? 340 : 120, H = big ? 150 : 40, pad = big ? 18 : 4;
    var hs = r.steps.map(function (s) { return s.h; });
    var maxH = Math.max.apply(null, hs.concat([20])), minH = 0;
    // Each step is a leg from the previous height to its own height. Lifts are drawn nearly
    // vertical, escalators steep, walks take a full share of the width. "Arrive" adds nothing.
    function legW(t) { return t === "lift" ? 0.16 : t === "escalator" ? 0.45 : t === "arrive" ? 0 : 1; }
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
      out += '<text class="sea-l" x="' + (W - 2) + '" y="' + (Y(0) - 5) + '" text-anchor="end">sea level</text>';
    }
    for (var i = 1; i < pts.length; i++) {
      var t = pts[i][2];
      out += '<line class="seg seg-' + t + '" x1="' + pts[i - 1][0] + '" y1="' + pts[i - 1][1] + '" x2="' + pts[i][0] + '" y2="' + pts[i][1] + '" stroke="' + COLORS[t] + '"/>';
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
  function heightText(r) {
    var first = r.steps[0].h, last = r.steps[r.steps.length - 1].h;
    return last >= first ? { n: r.climbSaved + " m", label: "climb saved", line: "Saves a " + r.climbSaved + " m climb" }
                         : { n: (first - last) + " m", label: "downhill", line: (first - last) + " m downhill" };
  }

  function routeCard(r) {
    return '<li><a class="rcard" href="#/route/' + r.id + '">' +
      '<span class="rc-text"><span class="rc-title">' + esc(r.title) + "</span>" +
      '<span class="rc-meta"><span>' + r.minutes + " min</span>" +
      (r.stepFree ? '<span class="sf-pill">Step-free</span>' : '<span class="some-steps">Some steps</span>') +
      "<span>" + heightText(r).line + "</span></span></span>" +
      profile(r, false) + "</a></li>";
  }

  // ---------- Screens ----------
  function home() {
    var list = D.routes.filter(routeMatches);
    var chips = [["all", "All routes"], ["stepfree", "Step-free only"], ["beausoleil", "Beausoleil"]];
    var pf = placeFilter ? D.places[placeFilter] : null;
    return '<section class="hero">' +
      '<p class="preview">Preview: routes are being checked on the ground</p>' +
      "<h1>Monaco, without the climb.</h1>" +
      '<p class="lede">Around 80 free public lifts, 37 escalators and 8 moving walkways link Monaco and Beausoleil. Here’s how to use them.</p>' +
      '<figure class="chart-card"><figcaption><span>Monaco, side on</span><span class="key"><i class="k-sf"></i>Step-free route <i class="k-st"></i>Some steps</span></figcaption>' + heightChart() + '<p class="chart-hint">Tap a place to see its routes.</p></figure>' +
      "</section>" +
      '<section class="block" aria-labelledby="routes-h">' +
      '<div class="block-head"><h2 id="routes-h">' + (pf ? "Routes for " + esc(pf.short) : "Popular routes") + "</h2>" +
      (pf ? '<button type="button" class="link-btn" data-clear>Show all</button>' : "") + "</div>" +
      '<div class="chips" role="group" aria-label="Filter routes">' + chips.map(function (c) {
        return '<button type="button" class="chip' + (filter === c[0] ? " on" : "") + '" data-filter="' + c[0] + '" aria-pressed="' + (filter === c[0]) + '">' + c[1] + "</button>";
      }).join("") + "</div>" +
      (list.length ? '<ul class="rlist">' + list.map(routeCard).join("") + "</ul>" : '<p class="empty">No routes match yet. Try “All routes”.</p>') +
      "</section>";
  }

  function routePage(id) {
    var r = D.routes.filter(function (x) { return x.id === id; })[0];
    if (!r) return home();
    var from = D.places[r.from], to = D.places[r.to];
    var steps = r.steps.map(function (s) {
      return '<li class="step step-' + s.type + '"><span class="step-ico" style="--c:' + COLORS[s.type] + '">' + icon(s.type) + "</span>" +
        '<div><span class="step-type">' + LABELS[s.type] + "</span><p>" + esc(s.text) + "</p></div></li>";
    }).join("");
    return '<article class="route">' +
      '<a class="back" href="#/">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>All routes</a>' +
      '<p class="route-from">' + esc(from.area) + " to " + esc(to.area) + "</p>" +
      "<h1>" + esc(r.title) + "</h1>" +
      '<ul class="facts"><li><strong>' + r.minutes + " min</strong><span>about</span></li>" +
      "<li><strong>" + (r.stepFree ? "Step-free" : "Some steps") + "</strong><span>" + (r.stepFree ? "no stairs" : "possible") + "</span></li>" +
      "<li><strong>" + heightText(r).n + "</strong><span>" + heightText(r).label + "</span></li></ul>" +
      '<p class="summary">' + esc(r.summary) + "</p>" +
      '<figure class="prof-card">' + profile(r, true) +
      '<figcaption class="legend"><span><i style="background:' + COLORS.lift + '"></i>Lift</span><span><i style="background:' + COLORS.escalator + '"></i>Escalator</span><span><i style="background:' + COLORS.walk + '"></i>Walk</span></figcaption></figure>' +
      '<h2 class="steps-h">Step by step</h2><ol class="steps">' + steps + "</ol>" +
      (r.tip ? '<aside class="note"><strong>Tip</strong><p>' + esc(r.tip) + "</p></aside>" : "") +
      (r.back ? '<aside class="note"><strong>The way back</strong><p>' + esc(r.back) + "</p></aside>" : "") +
      (r.sponsor ? '<aside class="sponsor"><span class="sp-label">Sponsored</span><strong>Your Beausoleil hotel or restaurant here</strong><p>A space for a partner business, seen by every visitor taking this route.</p></aside>' : "") +
      '<div class="actions"><a class="btn btn-red" href="' + mapsLink(r.maps) + '" target="_blank" rel="noopener">Open in Google Maps</a>' +
      '<a class="btn btn-line" href="mailto:hello@example.com?subject=' + encodeURIComponent("Problem on route: " + r.title) + '">Report a problem</a></div>' +
      (r.checked ? "" : '<p class="unchecked">Being checked: our team hasn’t walked this route yet. Follow the blue “Ascenseur public” signs on the day.</p>') +
      "</article>";
  }

  function liftsPage() {
    var areas = ["Monaco", "Beausoleil"];
    return '<section class="page"><h1>Lift finder</h1>' +
      '<p class="lede-dark">Look for glass doors in walls and car parks, signed “Ascenseur public”. All lifts and escalators are free.</p>' +
      areas.map(function (a) {
        var items = D.lifts.filter(function (l) { return l.area === a; });
        return '<h2 class="area-h">' + a + (a === "Beausoleil" ? " <span>(France)</span>" : "") + '</h2><ul class="lifts">' + items.map(function (l) {
          return '<li><span class="step-ico" style="--c:' + COLORS[l.type] + '">' + icon(l.type) + "</span><div><strong>" + esc(l.name) + "</strong>" +
            "<span>" + esc(l.links) + "</span><small>" + esc(l.where) + "</small></div>" +
            '<a class="map-mini" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.where + ", " + a) + '" target="_blank" rel="noopener" aria-label="Open ' + esc(l.name) + ' in Google Maps">Map</a></li>';
        }).join("") + "</ul>";
      }).join("") +
      '<p class="unchecked">Lift details are being checked on the ground and will get photos of each entrance.</p></section>';
  }

  function infoPage() {
    var items = [
      ["Free to use", "Every public lift, escalator and moving walkway in Monaco is free."],
      ["Follow the blue signs", "Look for blue signs with a lift symbol, and doors marked “Ascenseur public”. Many are tucked inside buildings and car parks."],
      ["Opening hours", "Monaco’s public lifts are generally open day and night, but a few close overnight. Beausoleil’s lifts were reported in 2020 to run from 5am to 9pm."],
      ["Buses", "Buses 1 and 2 go up to Monaco-Ville on the Rock, and buses 1, 5 and 6 stop at Casino Square. Fares were about €1.50 single or €5.50 for a day. Check before you travel."],
      ["Across the harbour", "The small electric Bateau-Bus ferry crosses Port Hercule and has a boarding ramp."],
      ["Accessible toilets", "There are accessible toilets at the Casino Square tourist office, the Oceanographic Museum, the Grimaldi Forum, Larvotto Beach and Port Hercule."],
      ["Beausoleil", "Beausoleil is in France, right behind Monte-Carlo. The border is just a street, with no checks. It’s steep, so plan to use the lifts on the way back up."],
      ["Emergencies", "Call 112 from any phone."]
    ];
    return '<section class="page"><h1>Good to know</h1><dl class="info">' + items.map(function (i) {
      return "<div><dt>" + i[0] + "</dt><dd>" + esc(i[1]) + "</dd></div>";
    }).join("") + '</dl><p class="unchecked">This is a preview. Details are gathered from published sources and are being checked on the ground before launch.</p></section>';
  }

  // ---------- Router ----------
  function render() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/");
    var tab = "routes", html;
    if (parts[0] === "route") html = routePage(parts[1]);
    else if (parts[0] === "lifts") { html = liftsPage(); tab = "lifts"; }
    else if (parts[0] === "info") { html = infoPage(); tab = "info"; }
    else html = home();
    main.innerHTML = html;
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
  var lastHash = location.hash;
  window.addEventListener("hashchange", function () {
    render();
    var toRoute = location.hash.indexOf("#/route/") === 0;
    var fromRoute = lastHash.indexOf("#/route/") === 0;
    if (toRoute || !fromRoute) window.scrollTo(0, 0);
    lastHash = location.hash;
  });
  render();

  // Works offline once opened: cache the app on the phone.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
