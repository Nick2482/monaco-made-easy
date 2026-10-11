// Buses (Monaco's CAM network, from its open timetable) and getting here from Nice airport.
(function () {
  "use strict";
  var B = window.MMEBus;
  var D = window.MME;
  function ui() { return window.MMEUI; }

  // ---------- Time in Monaco ----------
  function monacoNow() {
    var d = new Date();
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(d);
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      var wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(o.weekday);
      return { ymd: o.year + o.month + o.day, min: (+o.hour) * 60 + (+o.minute), wd: wd };
    } catch (e) {
      return { ymd: "" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2), min: d.getHours() * 60 + d.getMinutes(), wd: (d.getDay() + 6) % 7 };
    }
  }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }
  function expired(now) { return B && now.ymd > B.valid[1]; }
  function runs(svcIdx, now) {
    var s = B.services[svcIdx];
    if (s[0].charAt(now.wd) !== "1") return false;
    if (expired(now)) return true; // timetable out of date: assume the same pattern continues
    return now.ymd >= s[1] && now.ymd <= s[2];
  }

  function metres(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function stopPt(i) { var s = B.stops[i]; return { lat: s[1], lng: s[2] }; }

  // Next departures from a stop, soonest first.
  function departures(stopIdx, now, limit) {
    var out = [];
    B.patterns.forEach(function (p, pi) {
      var k = p.s.indexOf(stopIdx);
      if (k < 0 || k === p.s.length - 1) return;
      p.t.forEach(function (t) {
        if (!runs(t[0], now)) return;
        var at = t[1 + k];
        if (at >= now.min && at <= now.min + 180) out.push({ r: p.r, head: p.h, at: at, p: pi });
      });
    });
    out.sort(function (a, b) { return a.at - b.at; });
    return out.slice(0, limit || 6);
  }

  function nearStops(pt, maxM) {
    return B.stops.map(function (s, i) { return { i: i, d: metres(pt, { lat: s[1], lng: s[2] }) }; })
      .filter(function (x) { return x.d <= maxM; }).sort(function (a, b) { return a.d - b.d; });
  }

  // Best bus for a journey: walk to a stop, wait, ride, walk on.
  // Walking to and from stops uses the real walking network (with hills and steps) when it's available.
  function walkMins(a, b) {
    var R = window.MMERouter, straight = metres(a, b);
    if (R && straight > 60) {
      var r = R.route(a, b, { avoidSteps: true });
      if (r) return { m: r.minutes, steps: !r.stepFree };
    }
    return { m: Math.ceil(straight * 1.3 / 70), steps: false };
  }
  function firstTrip(p, i, j, reach, now) {
    for (var t = 0; t < p.t.length; t++) {
      var trip = p.t[t];
      if (runs(trip[0], now) && trip[1 + i] >= reach) return trip;
    }
    return null;
  }
  function busOption(from, to, now) {
    if (!B) return null;
    now = now || monacoNow();
    var A = nearStops(from, 500), Z = nearStops(to, 500);
    if (!A.length || !Z.length) return null;
    var walkA = {}, walkZ = {};
    A.forEach(function (x) { walkA[x.i] = x.d; });
    Z.forEach(function (x) { walkZ[x.i] = x.d; });
    // 1. Rough pass with straight-line walking, keeping the best few stop pairs.
    var cands = [];
    B.patterns.forEach(function (p) {
      for (var i = 0; i < p.s.length - 1; i++) {
        if (walkA[p.s[i]] === undefined) continue;
        for (var j = i + 1; j < p.s.length; j++) {
          if (walkZ[p.s[j]] === undefined) continue;
          var wa = Math.ceil(walkA[p.s[i]] * 1.3 / 70), wz = Math.ceil(walkZ[p.s[j]] * 1.3 / 70);
          var trip = firstTrip(p, i, j, now.min + wa, now);
          if (trip) cands.push({ p: p, i: i, j: j, rough: trip[1 + j] + wz });
        }
      }
    });
    cands.sort(function (x, y) { return x.rough - y.rough; });
    // One candidate per pair of stops, and per alighting stop at most two, so different stops get a look.
    var seenPair = {}, perStop = {};
    cands = cands.filter(function (c) {
      var k = c.p.s[c.i] + ">" + c.p.s[c.j], z = c.p.s[c.j];
      if (seenPair[k] || (perStop[z] || 0) >= 2) return false;
      seenPair[k] = 1; perStop[z] = (perStop[z] || 0) + 1; return true;
    });
    // 2. Check the best candidates with real walking times (hills and steps count).
    var cache = {}, best = null;
    function walk(key, a, b) { if (!cache[key]) cache[key] = walkMins(a, b); return cache[key]; }
    cands.slice(0, 20).forEach(function (c) {
      var sa = c.p.s[c.i], sz = c.p.s[c.j];
      var wa = walk("a" + sa, from, stopPt(sa)), wz = walk("z" + sz, stopPt(sz), to);
      var trip = firstTrip(c.p, c.i, c.j, now.min + wa.m, now);
      if (!trip) return;
      var arrive = trip[1 + c.j] + wz.m + (wz.steps || wa.steps ? 3 : 0);
      if (!best || arrive < best.arrive) best = { p: c.p, from: sa, to: sz, dep: trip[1 + c.i], ride: trip[1 + c.j] - trip[1 + c.i], walkTo: wa.m, walkFrom: wz.m, steps: wa.steps || wz.steps, arrive: arrive, wait: trip[1 + c.i] - now.min };
    });
    if (best) best.minutes = best.arrive - now.min;
    return best;
  }

  function badge(r) { var R = B.routes[r]; return '<span class="bus-badge" style="background:' + R.c + ";color:" + R.t + '">' + ui().esc(R.n) + "</span>"; }
  function inMins(at, now) { var m = at - now.min; return m <= 0 ? "now" : m === 1 ? "in 1 min" : "in " + m + " min"; }

  // ---------- Screens ----------
  var LINE_ORDER = function () { return B.routes.map(function (r, i) { return i; }); };

  var transportScreen = {
    html: function () {
      var esc = ui().esc, now = monacoNow();
      return '<section class="page transport"><h1>Getting around</h1>' +
        '<a class="tr-card tr-airport" href="#/airport"><strong>From Nice airport</strong><span>Train, bus, taxi or helicopter, and how long each takes</span></a>' +
        '<div class="tr-card tr-train"><strong>Trains from Monaco</strong><span>Usually every 15 minutes through the day: about 26 minutes to Nice-Ville and about 35 minutes to Nice Saint-Augustin for the airport. Trains also run east to Menton and Ventimiglia in Italy. For live times and platforms, use the SNCF Connect app.</span></div>' +
        '<h2 class="area-h">Next buses near you</h2><div id="tr-near"><button type="button" class="btn btn-red" id="tr-find">Show buses near me</button></div>' +
        '<h2 class="area-h">Monaco bus lines</h2><p class="lede-dark">Buses cover almost all of Monaco and climb the hills for you. Tickets cost a couple of euros and can be bought on board. Check the price on the day.</p>' +
        '<ul class="lines">' + LINE_ORDER().map(function (i) {
          var r = B.routes[i];
          return '<li><a href="#/bus/' + i + '">' + badge(i) + "<span>" + esc(r.name) + "</span></a></li>";
        }).join("") + "</ul>" +
        (expired(now) ? '<p class="unchecked">The bus timetable we have ran until ' + niceDate(B.valid[1]) + ". Times shown are the usual pattern, so check at the stop.</p>"
          : '<p class="unchecked">Timetable from the Compagnie des Autobus de Monaco, valid until ' + niceDate(B.valid[1]) + ".</p>") +
        "</section>";
    },
    mount: function (root) {
      var M = window.MMEMap, esc = ui().esc;
      root.querySelector("#tr-find").addEventListener("click", function () {
        var box = root.querySelector("#tr-near");
        box.innerHTML = '<p class="lede-dark">Finding where you are…</p>';
        M.startLocating(function (msg) { box.innerHTML = '<p class="loc-error">' + esc(msg) + "</p>"; });
        var done = false;
        var stop = M.onLocation(function (pos) {
          if (done) return; done = true; setTimeout(function () { stop(); }, 0);
          var stops = nearStops(pos, 700).slice(0, 3);
          if (!stops.length) { box.innerHTML = '<p class="summary">There are no Monaco bus stops near you. When you’re in Monaco, this shows the next buses from the closest stops.</p>'; return; }
          var now = monacoNow();
          box.innerHTML = stops.map(function (x) {
            var deps = departures(x.i, now, 4);
            return '<div class="stop-card"><p class="stop-name">' + esc(B.stops[x.i][0]) + " <small>" + Math.round(x.d / 10) * 10 + " m away</small></p>" +
              (deps.length ? '<ul class="deps">' + deps.map(function (d) { return "<li>" + badge(d.r) + "<span>to " + esc(d.head) + "</span><strong>" + hhmm(d.at) + "</strong><small>" + inMins(d.at, now) + "</small></li>"; }).join("") + "</ul>" : '<p class="lede-dark">No more buses from here in the next 3 hours.</p>') + "</div>";
          }).join("");
        });
      });
    }
  };

  function niceDate(ymd) { return new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)).toLocaleDateString("en-GB", { day: "numeric", month: "long" }); }

  var lineScreen = {
    html: function (id) {
      var r = B.routes[id], esc = ui().esc;
      if (!r) return '<section class="page"><h1>Line not found</h1></section>';
      var dirs = B.patterns.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.r === +id; })
        .sort(function (a, b) { return b.p.t.length - a.p.t.length; });
      var seen = {}, main = [];
      dirs.forEach(function (x) { if (!seen[x.p.d]) { seen[x.p.d] = 1; main.push(x); } });
      var now = monacoNow();
      return '<section class="page line"><a class="back" href="#/transport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>All lines</a>' +
        "<h1>" + badge(+id) + " " + esc(r.name) + "</h1>" +
        '<div class="map line-map" id="line-map"></div>' +
        main.map(function (x) {
          return '<h2 class="area-h">Towards ' + esc(x.p.h) + '</h2><ol class="line-stops">' + x.p.s.map(function (si, k) {
            if (k === x.p.s.length - 1) return "<li><span>" + esc(B.stops[si][0]) + "</span></li>";
            var next = x.p.t.filter(function (t) { return runs(t[0], now) && t[1 + k] >= now.min; }).slice(0, 2).map(function (t) { return hhmm(t[1 + k]); });
            return "<li><span>" + esc(B.stops[si][0]) + "</span><small>" + (next.length ? next.join(", ") : "No more today") + "</small></li>";
          }).join("") + "</ol>";
        }).join("") + "</section>";
    },
    mount: function (root, id) {
      var M = window.MMEMap, r = B.routes[id];
      if (!r) return;
      var map = M.makeMap(root.querySelector("#line-map"), { zoom: 14 });
      var bounds = L.latLngBounds([]), shown = {};
      B.patterns.forEach(function (p) {
        if (p.r !== +id) return;
        var sh = B.shapes[p.sh];
        if (sh && sh.length && !shown[p.sh]) {
          shown[p.sh] = 1;
          var pts = []; for (var i = 0; i < sh.length; i += 2) pts.push([sh[i] / 1e6, sh[i + 1] / 1e6]);
          L.polyline(pts, { color: r.c, weight: 5, opacity: 0.85 }).addTo(map); pts.forEach(function (q) { bounds.extend(q); });
        }
        p.s.forEach(function (si) { var s = B.stops[si]; L.circleMarker([s[1], s[2]], { radius: 5, color: "#fff", weight: 2, fillColor: r.c, fillOpacity: 1 }).addTo(map).bindPopup(ui().esc(s[0])); bounds.extend([s[1], s[2]]); });
      });
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.08));
      setTimeout(function () { map.invalidateSize(); }, 50);
    }
  };

  // ---------- From Nice airport ----------
  // ZOU! line 80, Nice Airport Terminal 2 to Monaco, timetable valid from 2 June 2026 (every day).
  var ZOU80_FROM_AIRPORT = ["08:30", "09:00", "09:35", "10:05", "10:35", "11:05", "11:35", "12:10", "12:50", "13:25", "14:00", "14:50", "15:15", "15:55", "16:35", "17:10", "18:00", "18:40", "19:25", "19:55", "20:30", "21:10", "22:00"];
  var airportScreen = {
    html: function () {
      var now = monacoNow();
      var next = ZOU80_FROM_AIRPORT.map(function (t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }).filter(function (m) { return m >= now.min; }).slice(0, 3);
      return '<section class="page airport"><a class="back" href="#/transport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>Getting around</a>' +
        "<h1>From Nice airport to Monaco</h1>" +
        '<p class="lede-dark">Four ways in. Prices and times are from published timetables in autumn 2026, so check before you travel.</p>' +
        '<ol class="ways">' +
        '<li class="way"><div class="way-top"><strong>Train</strong><span class="way-tag">Cheapest</span></div>' +
        "<p>Walk about 7 minutes from Terminal 1 to <b>Nice Saint-Augustin</b> station (from Terminal 2, take the free tram one stop). Trains to Monaco Monte-Carlo usually run every 15 minutes through the day and take about 35 minutes. A regional ticket costs a few euros. Evening and Sunday services can be thinner, so check the SNCF Connect app for live times.</p>" +
        '<p class="way-tip">At Monaco, the app picks the best station exit for where you’re staying. Tap “Just arrived?” on the home screen.</p></li>' +
        '<li class="way"><div class="way-top"><strong>Bus: ZOU! line 80</strong><span class="way-tag">Direct</span></div>' +
        "<p>From <b>Terminal 2</b>, every 30 to 50 minutes from 8:30am to 10pm, every day. About an hour to Monaco, stopping at Place d’Armes, the Casino and Larvotto. €21.40, or €21.80 bought on board (pay by tapping your card).</p>" +
        (next.length ? '<p class="way-next">Next buses from the airport: <b>' + next.map(hhmm).join(", ") + "</b></p>" : '<p class="way-next">No more buses from the airport today. The first one tomorrow is at 08:30.</p>') + "</li>" +
        '<li class="way"><div class="way-top"><strong>Taxi</strong><span class="way-tag">Easiest with bags</span></div>' +
        "<p>From the taxi rank at either terminal. A flat fare of about €95 to Monaco for up to four people with luggage, around 30 to 45 minutes depending on traffic. Uber can drop you in Monaco, but can’t collect you there.</p></li>" +
        '<li class="way"><div class="way-top"><strong>Helicopter</strong><span class="way-tag">Fastest</span></div>' +
        "<p>About 7 minutes to Monaco Heliport in Fontvieille, usually with a car to your hotel included. Book ahead with an operator. Shared seats start at around €200.</p></li></ol>" +
        '<p class="unchecked">ZOU! times are from the timetable valid from 2 June 2026. Check zou.maregionsud.fr or SNCF Connect on the day.</p></section>';
    },
    mount: function () {}
  };

  window.MMETransit = { busOption: busOption, departures: departures, monacoNow: monacoNow, hhmm: hhmm, badge: badge, stopName: function (i) { return B.stops[i][0]; }, stopPt: stopPt, transportScreen: transportScreen, lineScreen: lineScreen, airportScreen: airportScreen, ready: !!B };
})();
