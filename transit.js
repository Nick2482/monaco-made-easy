// Buses (Monaco's CAM network, from its open timetable) and getting here from Nice airport.
(function () {
  "use strict";
  var B = window.MMEBus;
  var D = window.MME;
  function ui() { return window.MMEUI; }
  function t(x, v) { return window.MMEI18N.t(x, v); }
  // Translated text that may contain **bold** parts.
  function tb(x, v) { return ui().esc(t(x, v)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }

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
  function inMins(at, now) { var m = at - now.min; return m <= 0 ? t("now") : t("in {n} min", { n: m }); }

  // ---------- Screens ----------
  var LINE_ORDER = function () { return B.routes.map(function (r, i) { return i; }); };

  // ---------- Trains (SNCF timetable, saved on the phone) ----------
  var TR = window.MMETrains;
  function trDay(ymd) {   // days since the timetable starts
    var a = new Date(TR.start + "T12:00:00Z"), b = new Date(ymd.slice(0, 4) + "-" + ymd.slice(4, 6) + "-" + ymd.slice(6, 8) + "T12:00:00Z");
    return Math.round((b - a) / 864e5);
  }
  function trRuns(svc, day) { if (day < 0 || day >= TR.days) return false; var h = TR.svc[svc]; var byte = parseInt(h.substr((day >> 3) * 2, 2), 16); return !!(byte >> (day & 7) & 1); }
  // Every departure in the next ~26 hours that matches pick(o) -> time; returns [{o, at (minutes from today's midnight)}], soonest first.
  function trNext(pick, now) {
    var day = trDay(now.ymd), out = [];
    if (!TR || day >= TR.days) return null;
    TR.dep.forEach(function (o) {
      var tm = pick(o); if (tm == null || tm < 0) return;
      for (var dd = -1; dd <= 1; dd++) {
        if (!trRuns(o[4], day + dd)) continue;
        var at = tm + dd * 1440;
        if (at >= now.min - 1 && at < now.min + 1560) out.push({ o: o, at: at, svcDay: dd });
      }
    });
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }
  function trStationIdx(name) { return TR.places.indexOf(name); }
  function trBoard(fromName, west, now) {
    var esc = ui().esc, si = trStationIdx(fromName), K = TR.keys;
    var list = trNext(function (o) { return o[0] === si && o[2] === west ? o[1] : null; }, now);
    if (list === null) return '<p class="tr-none">' + tb("This timetable has expired. Check the SNCF Connect app.") + "</p>";
    // Last train of tonight's service (trains after midnight still count as tonight).
    var tonight = list.filter(function (x) { return x.at < now.min + (now.min < 240 ? 300 : 1440 + 240 - now.min); });
    var last = tonight.length ? tonight[tonight.length - 1] : null;
    var rows = list.slice(0, 5).map(function (x) {
      var o = x.o, inMin = x.at - now.min;
      var arr = west ? [o[5][0] >= 0 ? tb("Nice-Ville {t}", { t: hhmm(o[5][0]) }) : "", o[5][1] >= 0 ? tb("Nice Saint-Augustin (airport) {t}", { t: hhmm(o[5][1]) }) : ""].filter(Boolean).join(" · ")
                     : (o[5][2] >= 0 ? tb("Menton {t}", { t: hhmm(o[5][2]) }) : "");
      return '<li><b class="tr-time">' + hhmm(x.at) + '</b><span class="tr-to">' + (tb("to {place}", { place: TR.places[o[3]] })) + (arr ? "<small>" + arr + "</small>" : "") + "</span>" +
        '<span class="tr-in">' + (inMin <= 0 ? tb("now") : inMin < 60 ? tb("in {n} min", { n: inMin }) : x.at >= 1440 + 240 || (now.min >= 240 && x.at >= 1440 && x.at - now.min > 300) ? tb("tomorrow") : "") + "</span></li>";
    }).join("");
    return (rows ? '<ul class="tr-board">' + rows + "</ul>" : '<p class="tr-none">' + tb("No more trains today.") + "</p>") +
      (last ? '<p class="tr-last">' + tb("**Last train tonight:** {t} to {place}", { t: hhmm(last.at), place: TR.places[last.o[3]] }) + "</p>" : '<p class="tr-last">' + tb("**No more trains tonight.** The times above are tomorrow’s.") + "</p>");
  }
  // Trains from Nice airport (Nice Saint-Augustin) to Monaco, for the airport page.
  function trFromAirport(now) {
    var esc = ui().esc, mon = trStationIdx("Monaco-Monte-Carlo");
    var list = trNext(function (o) { return o[0] === mon && o[2] === 0 && o[5][1] >= 0 && o[5][1] < o[1] ? o[5][1] : null; }, now);
    if (!list) return "";
    var tonight = list.filter(function (x) { return x.at < now.min + (now.min < 240 ? 300 : 1440 + 240 - now.min); });
    var last = tonight.length ? tonight[tonight.length - 1] : null;
    return '<div class="tr-trains"><h3>' + tb("Next trains from Nice Saint-Augustin to Monaco") + '</h3><ul class="tr-board">' + list.slice(0, 4).map(function (x) {
      return '<li><b class="tr-time">' + hhmm(x.at) + '</b><span class="tr-to">' + (tb("Monaco-Monte-Carlo {t}", { t: hhmm(x.at - x.o[5][1] + x.o[1]) })) + "</span>" +
        '<span class="tr-in">' + (x.at - now.min < 60 ? tb("in {n} min", { n: Math.max(0, x.at - now.min) }) : x.at - now.min > 300 && x.at >= 1440 ? tb("tomorrow") : "") + "</span></li>";
    }).join("") + "</ul>" + (last ? '<p class="tr-last">' + tb("**Last train tonight:** {t} to {place}", { t: hhmm(last.at), place: "Monaco-Monte-Carlo" }) + "</p>" : "") +
      '<p class="tr-note">' + tb("Planned SNCF timetable. Check the SNCF Connect app for delays.") + "</p></div>";
  }
  function trainsCard() {
    if (!TR) return "";
    var st = [["Monaco-Monte-Carlo", "Monaco"], ["Cap-d'Ail", "Cap d’Ail"], ["Roquebrune-Cap-Martin", "Roquebrune"]];
    return '<section class="tr-trains tr-sec" id="tr-trains"><h2 class="tr-sec-h">' + tb("Trains") + "</h2>" +
      '<div class="ess-chips" role="group" aria-label="' + tb("Station") + '">' + st.map(function (x, i) { return '<button type="button" class="chip' + (i ? "" : " on") + '" data-st="' + x[0] + '">' + tb(x[1]) + "</button>"; }).join("") + "</div>" +
      '<div class="tr-dir" role="group"><button type="button" class="chip on" data-w="1">' + tb("Towards Nice") + '</button><button type="button" class="chip" data-w="0">' + tb("Towards Menton and Italy") + "</button></div>" +
      '<div id="tr-board"></div><p class="tr-note">' + tb("Planned SNCF timetable, saved on your phone. Check the SNCF Connect app for delays and platforms.") + "</p></section>";
  }
  function mountTrains(root) {
    var box = root.querySelector("#tr-trains"); if (!box) return;
    var st = "Monaco-Monte-Carlo", w = 1;
    function draw() { var b = root.querySelector("#tr-board"); if (b) b.innerHTML = trBoard(st, w, monacoNow()); }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-st],[data-w]"); if (!b) return;
      if (b.dataset.st) { st = b.dataset.st; box.querySelectorAll("[data-st]").forEach(function (x) { x.classList.toggle("on", x === b); }); }
      else { w = +b.dataset.w; box.querySelectorAll("[data-w]").forEach(function (x) { x.classList.toggle("on", x === b); }); }
      draw();
    });
    draw();
    var tick = setInterval(function () { if (!document.body.contains(box)) { clearInterval(tick); return; } draw(); }, 30000);
  }

  // Sightseeing: the little tourist train from the Rock, and the hop-on hop-off bus (checked Oct 2026, visitmonaco.com / monacolegrandtour.com).
  var TRAIN_STOP = [43.73085, 7.425];
  function sightseeing(now) {
    var md = +String(now.ymd).slice(4, 8), on = md >= 201 && md <= 1115;
    return '<section class="tr-sec"><h2 class="tr-sec-h">' + tb("Sightseeing tours") + "</h2>" +
      '<div class="tr-card tr-train tr-sight"><strong>' + tb("The little tourist train (Monaco Tours)") + "</strong><span>" +
        tb("A 30 to 40 minute loop from the Rock: Place d’Armes, the harbour, the Grand Prix circuit and Casino Square, then back up past the Palace and the Cathedral. It leaves from opposite the Oceanographic Museum. €12, children aged 2 to 10 €6, cash or card.") + "</span>" +
        '<span class="tr-season' + (on ? "" : " off") + '">' + tb(on ? "Runs every day from February to mid-November, weather and events permitting." : "Not running now: the little train is off for the winter and starts again in February.") + "</span>" +
        '<span class="tr-small">' + tb("Wheelchair access depends on works, so call first: +377 92 05 64 38.") + "</span>" +
        '<div class="tr-acts"><button type="button" class="btn-small" data-tr-go="' + TRAIN_STOP.join(",") + '" data-label="' + ui().esc(t("The little tourist train (Monaco Tours)")) + '">' + tb("Take me there") + "</button></div></div>" +
      '<div class="tr-card tr-train tr-sight"><strong>' + tb("Monaco Le Grand Tour (hop-on, hop-off bus)") + "</strong><span>" +
        tb("An open-top bus with 12 stops, including the Rock, the Casino, the station, Fontvieille and the cruise terminal. A bus every 30 minutes from 10:00 to 17:30, and your ticket lasts all day. Wheelchair space, and room for 2 folded pushchairs. Tickets from the driver.") + "</span>" +
        '<span class="tr-small">' + tb("Closed on National Day (19 November).") + "</span>" +
        '<div class="tr-acts"><a class="btn-small" href="https://www.monacolegrandtour.com/en/" target="_blank" rel="noopener">' + tb("More information") + "</a></div></div>" +
      "</section>";
  }
  var transportScreen = {
    html: function () {
      var esc = ui().esc, now = monacoNow();
      return '<section class="page transport"><h1>' + tb("Getting around") + "</h1>" +
        '<a class="tr-card tr-airport" href="#/airport"><strong>' + tb("From Nice airport") + "</strong><span>" + tb("Train, bus, taxi or helicopter, and how long each takes") + "</span></a>" +
        '<a class="tr-card tr-cruise" href="#/cruise"><strong>' + tb("On a cruise?") + "</strong><span>" + tb("Set your all-aboard time and we’ll tell you when to head back.") + "</span></a>" +
        '<a class="tr-card tr-taxi" href="#/taxis"><strong>' + tb("Taxis") + "</strong><span>" + tb("Numbers, ranks, fixed fares, and the border rule for Beausoleil and Cap d’Ail") + "</span></a>" +
        trainsCard() +
        '<section class="tr-sec"><h2 class="tr-sec-h">' + tb("Buses along the coast") + "</h2>" +
        '<div class="tr-card tr-train"><strong>' + tb("Bus 600: Nice, Monaco, Menton") + "</strong><span>" + tb("The coastal bus, about every 10 to 15 minutes (every 20 at weekends). It runs from Nice (Square Normandie-Niemen) through Villefranche, Beaulieu, Èze-sur-Mer and Cap d’Ail into Monaco, then on to Roquebrune and Menton. In Monaco it stops near the station (Sainte-Dévote), the Casino and Place des Moulins. €2.10 if you tap your card or phone on board, €2.50 in cash. Live times are in the ZOU! app. Night bus 601 runs Thursday to Saturday.") + "</span></div>" +
        '<div class="tr-card tr-train"><strong>' + tb("Bus 80: Nice airport, Monaco, Menton") + "</strong><span>" + tb("The express airport bus, every 25 to 50 minutes from early morning to about 10pm, every day. About an hour from **Terminal 2** to Monaco, stopping at Place d’Armes, the tourist office, the Casino and Larvotto. €21.40 if bought in advance, €21.80 on board (tap your card).") + " " + tb("Travelling as a group of 3 to 9? A group ticket bought on board starts at €45.80 for everyone, which is much cheaper.") + '</span><a class="tr-more" href="#/airport/bus">' + tb("Next buses from the airport") + "</a></div>" +
        "</section>" +
        sightseeing(now) +
        '<section class="tr-sec"><h2 class="tr-sec-h">' + tb("Buses in Monaco") + "</h2>" +
        '<h3 class="tr-sub">' + tb("Next buses near you") + '</h3><div id="tr-near"><button type="button" class="btn btn-red" id="tr-find"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-1-7h2v3.06A8 8 0 0 1 19.94 11H23v2h-3.06A8 8 0 0 1 13 19.94V23h-2v-3.06A8 8 0 0 1 4.06 13H1v-2h3.06A8 8 0 0 1 11 4.06zm1 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>' + tb("Show buses near me") + "</button></div>" +
        '<h3 class="tr-sub">' + tb("Monaco bus lines") + '</h3><p class="lede-dark">' + tb("Buses cover almost all of Monaco and climb the hills for you. Tickets cost a couple of euros and can be bought on board. Check the price on the day.") + "</p>" +
        '<ul class="lines">' + LINE_ORDER().map(function (i) {
          var r = B.routes[i];
          return '<li><a href="#/bus/' + i + '">' + badge(i) + "<span>" + esc(r.name) + "</span></a></li>";
        }).join("") + "</ul></section>" +
        '<p class="unchecked">' + (expired(now) ? tb("The bus timetable we have ran until {date}. Times shown are the usual pattern, so check at the stop.", { date: niceDate(B.valid[1]) })
          : tb("Timetable from the Compagnie des Autobus de Monaco, valid until {date}.", { date: niceDate(B.valid[1]) })) + "</p>" +
        "</section>";
    },
    mount: function (root) {
      var M = window.MMEMap, esc = ui().esc;
      mountTrains(root);
      root.addEventListener("click", function (e) {
        var b = e.target.closest("[data-tr-go]"); if (!b) return;
        var ll = b.dataset.trGo.split(",");
        window.MMEPlanner.state.to = { label: b.dataset.label, lat: +ll[0], lng: +ll[1], kind: "place" };
        window.MMEPlanner.state.from = null; window.MMEPlanner.state.arrival = null;
        location.hash = "#/plan";
      });
      root.querySelector("#tr-find").addEventListener("click", function () {
        var box = root.querySelector("#tr-near");
        box.innerHTML = '<p class="lede-dark">' + tb("Finding where you are…") + "</p>";
        M.startLocating(function (msg) { box.innerHTML = '<p class="loc-error">' + esc(msg) + "</p>"; });
        var done = false;
        var stop = M.onLocation(function (pos) {
          if (done) return; done = true; setTimeout(function () { stop(); }, 0);
          var stops = nearStops(pos, 700).slice(0, 3);
          if (!stops.length) { box.innerHTML = '<p class="summary">' + tb("There are no Monaco bus stops near you. When you’re in Monaco, this shows the next buses from the closest stops.") + "</p>"; return; }
          var now = monacoNow();
          box.innerHTML = stops.map(function (x) {
            var deps = departures(x.i, now, 4);
            return '<div class="stop-card"><p class="stop-name">' + esc(B.stops[x.i][0]) + " <small>" + tb("{n} m away", { n: Math.round(x.d / 10) * 10 }) + "</small></p>" +
              (deps.length ? '<ul class="deps">' + deps.map(function (d) { return "<li>" + badge(d.r) + "<span>" + tb("to {dest}", { dest: d.head }) + "</span><strong>" + hhmm(d.at) + "</strong><small>" + esc(inMins(d.at, now)) + "</small></li>"; }).join("") + "</ul>" : '<p class="lede-dark">' + tb("No more buses from here in the next 3 hours.") + "</p>") + "</div>";
          }).join("");
        });
      });
    }
  };

  function niceDate(ymd) {
    var loc = { en: "en-GB", zh: "zh-CN" }[window.MMEI18N.lang()] || window.MMEI18N.lang();
    try { return new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)).toLocaleDateString(loc, { day: "numeric", month: "long" }); }
    catch (e) { return ymd.slice(6, 8) + "/" + ymd.slice(4, 6); }
  }

  var lineScreen = {
    html: function (id) {
      var r = B.routes[id], esc = ui().esc;
      if (!r) return '<section class="page"><h1>' + tb("Line not found") + "</h1></section>";
      var dirs = B.patterns.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.r === +id; })
        .sort(function (a, b) { return b.p.t.length - a.p.t.length; });
      var seen = {}, main = [];
      dirs.forEach(function (x) { if (!seen[x.p.d]) { seen[x.p.d] = 1; main.push(x); } });
      var now = monacoNow();
      return '<section class="page line"><a class="back" href="#/transport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + tb("All lines") + "</a>" +
        "<h1>" + badge(+id) + " " + esc(r.name) + "</h1>" +
        '<div class="map line-map" id="line-map"></div>' +
        main.map(function (x) {
          return '<h2 class="area-h">' + tb("Towards {dest}", { dest: x.p.h }) + '</h2><ol class="line-stops">' + x.p.s.map(function (si, k) {
            if (k === x.p.s.length - 1) return "<li><span>" + esc(B.stops[si][0]) + "</span></li>";
            var next = x.p.t.filter(function (t) { return runs(t[0], now) && t[1 + k] >= now.min; }).slice(0, 2).map(function (t) { return hhmm(t[1 + k]); });
            return "<li><span>" + esc(B.stops[si][0]) + "</span><small>" + (next.length ? next.join(", ") : tb("No more today")) + "</small></li>";
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
      return '<section class="page airport"><a class="back" href="#/transport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + tb("Getting around") + "</a>" +
        "<h1>" + tb("From Nice airport to Monaco") + "</h1>" +
        '<p class="lede-dark">' + tb("Four ways in. Prices and times are from published timetables in autumn 2026, so check before you travel.") + "</p>" +
        '<ol class="ways">' +
        '<li class="way"><div class="way-top"><strong>' + tb("Train") + '</strong><span class="way-tag">' + tb("Cheapest") + "</span></div>" +
        "<p>" + tb("Walk about 7 minutes from Terminal 1 to **Nice Saint-Augustin** station (from Terminal 2, take the free tram one stop). Trains to Monaco Monte-Carlo usually run every 15 minutes through the day and take about 35 minutes. A regional ticket costs a few euros. Evening and Sunday services can be thinner, so check the SNCF Connect app for live times.") + "</p>" +
        (TR ? trFromAirport(monacoNow()) : "") +
        '<p class="way-tip">' + tb("At Monaco, the app picks the best station exit for where you’re staying. Tap “Just arrived?” on the home screen.") + "</p></li>" +
        '<li class="way" id="way-bus"><div class="way-top"><strong>' + tb("Bus: ZOU! line 80") + '</strong><span class="way-tag">' + tb("Direct") + "</span></div>" +
        "<p>" + tb("From **Terminal 2**, every 30 to 50 minutes from 8:30am to 10pm, every day. About an hour to Monaco, stopping at Place d’Armes, the Casino and Larvotto. €21.40, or €21.80 bought on board (pay by tapping your card).") + " " + tb("Travelling as a group of 3 to 9? A group ticket bought on board starts at €45.80 for everyone, which is much cheaper.") + "</p>" +
        (next.length ? '<p class="way-next">' + tb("Next buses from the airport: {times}", { times: "**" + next.map(hhmm).join(", ") + "**" }) + "</p>" : '<p class="way-next">' + tb("No more buses from the airport today. The first one tomorrow is at 08:30.") + "</p>") + "</li>" +
        '<li class="way"><div class="way-top"><strong>' + tb("Taxi") + '</strong><span class="way-tag">' + tb("Easiest with bags") + "</span></div>" +
        "<p>" + tb("From the taxi rank at either terminal. A flat fare of about €95 to Monaco for up to four people with luggage, around 30 to 45 minutes depending on traffic. Uber can drop you in Monaco, but can’t collect you there.") + "</p></li>" +
        '<li class="way"><div class="way-top"><strong>' + tb("Helicopter") + '</strong><span class="way-tag">' + tb("Fastest") + "</span></div>" +
        "<p>" + tb("About 7 minutes to Monaco Heliport in Fontvieille, usually with a car to your hotel included. Book ahead with an operator. Shared seats start at around €200.") + "</p></li></ol>" +
        '<p class="unchecked">' + tb("ZOU! times are from the timetable valid from 2 June 2026. Check zou.maregionsud.fr or SNCF Connect on the day.") + "</p></section>";
    },
    mount: function (root) {
      // Arriving from "Next buses from the airport": jump straight to the bus.
      if (/^#\/airport\/bus/.test(location.hash)) setTimeout(function () { var b = root.querySelector("#way-bus"); if (b) { b.scrollIntoView({ block: "start" }); window.scrollBy(0, -80); b.classList.add("way-hl"); } }, 60);
    }
  };

  // ---------- Monaco or France? ----------
  function inMonaco(p) {
    var rings = window.MMEBorder || [], inside = false;
    rings.forEach(function (r) {
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        var a = r[i], b = r[j];
        if (((a[0] > p.lat) !== (b[0] > p.lat)) && (p.lng < (b[1] - a[1]) * (p.lat - a[0]) / (b[0] - a[0]) + a[1])) inside = !inside;
      }
    });
    return inside;
  }

  // ---------- Taxis ----------
  var TAXI_TEL = "+37793150101";
  var taxiScreen = {
    html: function () {
      return '<section class="page taxis"><a class="back" href="#/transport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + tb("Getting around") + "</a>" +
        "<h1>" + tb("Taxis") + "</h1>" +
        '<div id="taxi-here" class="taxi-here"><button type="button" class="btn btn-line" id="taxi-where">' + tb("Which taxi can I use where I am?") + "</button></div>" +
        '<div class="taxi-call"><a class="btn btn-red" href="tel:' + TAXI_TEL + '">' + tb("Call Taxi Monaco: {tel}", { tel: "+377 93 15 01 01" }) + "</a><p>" + tb("Day and night. There’s also the official **TAXI MONACO** app for Android and iPhone, with card payment and live tracking.") + "</p></div>" +
        '<aside class="note note-rule"><strong>' + tb("The border rule") + "</strong><p>" + tb("Monaco taxis can only pick you up in Monaco. French taxis, Uber and Bolt can drop you off in Monaco but can’t collect you there. So:") + "</p>" +
        '<ul class="rule-list"><li>' + tb("**In Monaco:** use a Monaco taxi, from a rank or by phone or app.") + "</li><li>" + tb("**In Beausoleil, Cap d’Ail or Roquebrune (France):** book a French taxi, or use Uber or Bolt, though cars can be scarce. A Monaco taxi can take you to these towns, but not collect you from them.") + "</li><li>" + tb("**From Nice airport to Monaco:** take a French taxi from the airport rank, which has a flat fare of about €95. **Going back to the airport** from Monaco, use a Monaco taxi.") + "</li></ul></aside>" +
        '<h2 class="area-h">' + tb("Taxi ranks in Monaco") + '</h2><ul class="info-list">' +
        "<li>" + tb("**Casino Square** (Avenue de Monte-Carlo), 24 hours") + "</li><li>" + tb("**Monaco Monte-Carlo station**, 24 hours") + "</li><li><b>Place des Moulins</b></li><li><b>Avenue de la Costa</b></li><li><b>Fontvieille</b></li><li>" + tb("**Larvotto**, by the Méridien Beach Plaza") + "</li></ul>" +
        '<h2 class="area-h">' + tb("Taxis in Beausoleil (France)") + '</h2><ul class="info-list">' +
        "<li>" + tb("**Beausoleil taxi rank**, Place Simone Veil") + ' · <a href="tel:+33493783923">04 93 78 39 23</a></li></ul>' +
        '<h2 class="area-h">' + tb("What it costs") + '</h2><ul class="info-list">' +
        "<li>" + tb("Monaco taxis use **fixed fares**, not a meter.") + "</li><li>" + tb("Within Monaco: about **€18** if you hail one, about **€28** if you book ahead.") + "</li><li>" + tb("To the towns next door, such as Beausoleil or Cap d’Ail: about **€25**.") + "</li><li>" + tb("To Nice airport: about **€95 to €100**.") + "</li><li>" + tb("Waiting or slow traffic: about €1.33 a minute after the first 3 minutes.") + "</li><li>" + tb("Some taxis take cash only, so carry some euros.") + "</li></ul>" +
        '<p class="unchecked">' + tb("Fares were published in 2025 and 2026. Confirm the price with the driver before you set off.") + "</p></section>";
    },
    mount: function (root) {
      var M = window.MMEMap;
      root.querySelector("#taxi-where").addEventListener("click", function () {
        var box = root.querySelector("#taxi-here");
        box.innerHTML = '<p class="lede-dark">' + tb("Finding where you are…") + "</p>";
        M.startLocating(function (msg) { box.innerHTML = '<p class="loc-error">' + ui().esc(msg) + "</p>"; });
        var done = false;
        var stop = M.onLocation(function (pos) {
          if (done) return; done = true; setTimeout(function () { stop(); }, 0);
          var near = metres(pos, { lat: 43.7385, lng: 7.4240 }) < 5000;
          box.innerHTML = !near
            ? '<p class="taxi-verdict">' + tb("You’re not near Monaco right now. When you are, this tells you which taxi can collect you.") + "</p>"
            : inMonaco(pos)
              ? '<p class="taxi-verdict ok">' + tb("**You’re in Monaco.** Call a Monaco taxi or go to a rank. Uber and Bolt can’t collect you here.") + "</p>"
              : '<p class="taxi-verdict fr">' + tb("**You’re in France**, just outside Monaco. Monaco taxis can’t collect you here. Book a French taxi or try Uber or Bolt, or walk into Monaco and use a Monaco taxi.") + "</p>";
        });
      });
    }
  };

  // A fresh timetable: our server fetches the latest one from the open data portal every day.
  // If that fails (or there's no signal), the timetable bundled with the app is used instead.
  function refreshBus() {
    if (!window.fetch || location.protocol === "file:") return;
    fetch("/api/bus").then(function (r) { return r.ok ? r.json() : null; }).then(function (nb) {
      if (!nb || !nb.valid || !nb.patterns || !nb.patterns.length) return;
      if (B && nb.valid[1] < B.valid[1]) return;
      B = nb; window.MMEBus = nb; window.MMETransit.ready = true;
      window.dispatchEvent(new Event("mme-bus"));
    }).catch(function () {});
  }
  setTimeout(refreshBus, 300);

  window.MMETransit = { refreshBus: refreshBus, inMonaco: inMonaco, taxiScreen: taxiScreen, busOption: busOption, departures: departures, monacoNow: monacoNow, hhmm: hhmm, badge: badge, stopName: function (i) { return B.stops[i][0]; }, stopPt: stopPt, transportScreen: transportScreen, lineScreen: lineScreen, airportScreen: airportScreen, ready: !!B };
})();
