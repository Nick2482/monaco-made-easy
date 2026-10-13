// Step-free sightseeing walks, worked out live with the same route planner (lifts first, as few steps as possible),
// plus a countdown to the Changing of the Guard at the Prince's Palace (every day at 11:55).
(function () {
  "use strict";
  var D = window.MME;
  function t(s, v) { return window.MMEI18N.t(s, v); }
  function ui() { return window.MMEUI; }
  function wheelchair() { try { return localStorage.getItem("mme-wheelchair") === "1"; } catch (e) { return false; } }

  // Stop positions come from OpenStreetMap.
  var WALKS = [
    { id: "rock", title: "The Rock without the climb", sub: "Monaco-Ville, the old town on the Rock, using the lifts from the harbour",
      stops: [
        { name: "Port Hercule", lat: D.places.port.lat, lng: D.places.port.lng, text: "Start by the harbour. The lifts in the Parking des Pêcheurs take you up the cliff, so there’s no long climb." },
        { name: "Oceanographic Museum", lat: 43.73103, lng: 7.42564, text: "Jacques Cousteau’s museum, built into the cliff edge. Its rooftop terrace has one of the best views in Monaco." },
        { name: "Saint-Martin Gardens", lat: 43.72983, lng: 7.42347, text: "Shady gardens along the cliff top, with benches and views out to sea." },
        { name: "Monaco Cathedral", lat: 43.73043, lng: 7.42273, text: "Monaco’s cathedral, where Princess Grace and Prince Rainier III are buried." },
        { name: "Prince's Palace", lat: 43.73131, lng: 7.42142, text: "The Changing of the Guard takes place in the palace square every day at 11:55. The square looks out over the harbour." },
        { name: "Back to Port Hercule", lat: D.places.port.lat, lng: D.places.port.lng, text: "Back down to the harbour the easy way." }
      ] },
    { id: "montecarlo", title: "Monte-Carlo and the Casino", sub: "From the harbour up to Casino Square, then on to the gardens and the beach",
      stops: [
        { name: "Port Hercule", lat: D.places.port.lat, lng: D.places.port.lng, text: "Start by the harbour, where the superyachts moor." },
        { name: "Casino Square", lat: D.places.casino.lat, lng: D.places.casino.lng, text: "The Belle Époque Casino, the Hôtel de Paris and the Café de Paris around one famous square." },
        { name: "Japanese Garden", lat: 43.74237, lng: 7.43101, text: "A free, peaceful Japanese garden with ponds, a waterfall and a tea house." },
        { name: "Grimaldi Forum", lat: 43.74383, lng: 7.43192, text: "Monaco’s congress and exhibition centre, with a big exhibition every summer." },
        { name: "Larvotto Beach", lat: D.places.larvotto.lat, lng: D.places.larvotto.lng, text: "Monaco’s public beach, with a promenade, cafés and restaurants." }
      ] }
  ];

  function legsFor(w) {
    var R = window.MMERouter, X = window.MMEExtras, wc = wheelchair();
    var blocked = X ? X.Reports.blockedPoints() : [];
    var legs = [];
    for (var i = 1; i < w.stops.length; i++) legs.push(R ? R.route(w.stops[i - 1], w.stops[i], { avoidSteps: true, wheelchair: wc, blocked: blocked }) : null);
    return legs;
  }
  function summary(legs) {
    var s = { minutes: 0, metres: 0, lifts: 0, steps: 0, escalators: 0, ok: true };
    legs.forEach(function (r) {
      if (!r) { s.ok = false; return; }
      s.minutes += r.minutes; s.metres += r.metres; s.lifts += r.lifts; s.steps += r.steps; s.escalators += r.escalators;
    });
    return s;
  }
  function factsHtml(s) {
    var esc = ui().esc;
    var km = s.metres >= 1000 ? (s.metres / 1000).toFixed(1) + " km" : s.metres + " m";
    return '<ul class="facts"><li><strong>' + esc(t("{n} min", { n: s.minutes })) + "</strong><span>" + esc(t("{d} on foot", { d: km })) + "</span></li>" +
      "<li><strong>" + esc(t(s.lifts === 1 ? "1 lift" : "{n} lifts", { n: s.lifts })) + "</strong><span>" + esc(s.escalators ? t(s.escalators === 1 ? "and 1 escalator" : "and {n} escalators", { n: s.escalators }) : t("on the way")) + "</span></li>" +
      "<li><strong>" + esc(s.steps === 0 ? t("No steps") : t(s.steps === 1 ? "1 set of steps" : "{n} sets of steps", { n: s.steps })) + "</strong><span>" + esc(s.steps === 0 ? t("step-free") : t("on this route")) + "</span></li></ul>";
  }

  // ---------- Changing of the Guard ----------
  var GUARD = 11 * 60 + 55;
  function guardCard() {
    var T = window.MMETransit, now = T && T.monacoNow ? T.monacoNow() : null;
    if (!now || now.min < 9 * 60 || now.min >= GUARD) return "";
    var left = GUARD - now.min, esc = ui().esc;
    return '<a class="guard-card" href="#/to-palace"><span class="gd-top">' + esc(t("Changing of the Guard")) + "</span>" +
      "<strong>" + esc(left >= 60 ? t("Today at 11:55, in {h} h {m} min", { h: Math.floor(left / 60), m: left % 60 }) : t("Today at 11:55, in {m} min", { m: left })) + "</strong>" +
      "<small>" + esc(t("Arrive by 11:30 for a good spot. Tap for the easiest way up to the Palace.")) + "</small></a>";
  }

  // ---------- Screens ----------
  function walkCard(w) {
    var esc = ui().esc;
    return '<li><a class="walk-card" href="#/walk/' + w.id + '"><span class="wk-title">' + esc(t(w.title)) + "</span><span class=\"wk-sub\">" + esc(t(w.sub)) + "</span>" +
      '<span class="wk-stops">' + w.stops.map(function (s) { return esc(t(s.name)); }).join(" · ") + "</span></a></li>";
  }
  function walksBlock() {
    var esc = ui().esc;
    return '<section class="block walks-block"><div class="block-head"><h2>' + esc(t("Step-free walks")) + "</h2>" + (window.MMEPro ? window.MMEPro.badge() : "") + '</div><p class="block-lede">' + esc(t("Sightseeing walks that use the lifts, so you see the best of Monaco without the climb.")) + '</p><ul class="walk-list">' + WALKS.map(walkCard).join("") + "</ul></section>";
  }

  var walkScreen = {
    html: function (id) {
      var w = WALKS.filter(function (x) { return x.id === id; })[0], esc = ui().esc;
      if (!w) return '<section class="page"><h1>' + esc(t("Step-free walks")) + '</h1><ul class="walk-list">' + WALKS.map(walkCard).join("") + "</ul></section>";
      if (window.MMEPro && !window.MMEPro.isPro()) return '<section class="plan walk"><a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Home")) + "</a><h1>" + esc(t(w.title)) + '</h1><p class="lede-dark">' + esc(t(w.sub)) + "</p>" + window.MMEPro.lockCard("Step-free walks") + "</section>";
      return '<section class="plan walk"><a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Home")) + "</a>" +
        "<h1>" + esc(t(w.title)) + '</h1><p class="lede-dark">' + esc(t(w.sub)) + "</p>" +
        (w.id === "rock" ? guardCard() : "") +
        '<div class="map plan-map" id="walk-map"></div><div id="walk-body"><p class="lede-dark" role="status">' + esc(t("Working out the easiest way…")) + "</p></div></section>";
    },
    mount: function (root, id) {
      var w = WALKS.filter(function (x) { return x.id === id; })[0];
      if (!w || !root.querySelector("#walk-map")) return;
      var esc = ui().esc, icon = ui().icon;
      var map = window.MMEMap.makeMap(root.querySelector("#walk-map"), { zoom: 15 });
      var ready = window.MMERouter ? window.MMERouter.ready : Promise.resolve(false);
      ready.then(function () {
        var legs = legsFor(w), s = summary(legs), b = L.latLngBounds([]);
        var LINE = { walk: { color: "#0b2545", weight: 5 }, lift: { color: "#ce1126", weight: 8 }, escalator: { color: "#1d6fa5", weight: 7 }, steps: { color: "#d9480f", weight: 6, dashArray: "4 6" } };
        legs.forEach(function (r) { if (r) r.lines.forEach(function (ln) { L.polyline(ln.pts, LINE[ln.kind]).addTo(map); ln.pts.forEach(function (p) { b.extend(p); }); }); });
        var last = w.stops.length - 1, sameEnd = w.stops[0].lat === w.stops[last].lat && w.stops[0].lng === w.stops[last].lng;
        w.stops.forEach(function (st, i) {
          if (sameEnd && i === last) return;
          L.marker([st.lat, st.lng], { icon: L.divIcon({ className: "", html: '<span class="wk-num">' + (i + 1) + "</span>", iconSize: [28, 28], iconAnchor: [14, 14] }), title: t(st.name) }).addTo(map);
          b.extend([st.lat, st.lng]);
        });
        function fit() { map.invalidateSize(); if (b.isValid()) map.fitBounds(b.pad(0.08)); }
        fit(); setTimeout(fit, 200);
        var h = factsHtml(s);
        if (!s.ok) h += '<aside class="note"><p>' + esc(t("We couldn’t find a way between these two places without steps or escalators. A taxi is the easiest option.")) + "</p></aside>";
        h += '<ol class="walk-stops">' + w.stops.map(function (st, i) {
          var leg = i > 0 ? legs[i - 1] : null;
          var how = leg ? '<details class="wk-how"><summary>' + esc(t("How to get there: {n} min", { n: leg.minutes })) + "</summary><ol class=\"steps\">" + leg.directions.map(function (d) {
            var k = d.kind;
            return '<li class="step step-' + k + '"><span class="step-ico" style="--c:' + (k === "steps" ? "#d9480f" : ui().COLORS[k] || "#0b2545") + '">' + icon(k) + "</span><div><p>" + esc(d.text) + "</p></div></li>";
          }).join("") + "</ol></details>" : "";
          return '<li><span class="wk-num">' + (sameEnd && i === last ? "↩" : i + 1) + '</span><div><strong>' + esc(t(st.name)) + "</strong><p>" + esc(t(st.text)) + "</p>" + how +
            '<button type="button" class="btn-small" data-walk-go="' + i + '">' + esc(t("Take me here")) + "</button></div></li>";
        }).join("") + "</ol>" +
          '<p class="unchecked">' + esc(t("Routes are worked out from OpenStreetMap. Lifts can be closed for repairs, so follow the blue “Ascenseur public” signs on the day.")) + "</p>";
        root.querySelector("#walk-body").innerHTML = h;
        if (window.MMEStats) window.MMEStats.track("Walk opened", { walk: w.id });
      });
      root.addEventListener("click", function (e) {
        var b = e.target.closest("[data-walk-go]");
        if (!b) return;
        var st = w.stops[+b.dataset.walkGo], P = window.MMEPlanner;
        P.state.to = { label: st.name, lat: st.lat, lng: st.lng, kind: "place" };
        P.state.from = null; P.state.arrival = null;
        location.hash = "#/plan";
      });
      setTimeout(function () { map.invalidateSize(); }, 50);
    }
  };

  function toPalace() {
    var P = window.MMEPlanner;
    P.state.to = P.placeRef("palace"); P.state.from = null; P.state.arrival = null;
    return true;
  }

  window.MMEWalks = { WALKS: WALKS, walksBlock: walksBlock, walkScreen: walkScreen, guardCard: guardCard, toPalace: toPalace };
})();
