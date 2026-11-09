// Event-day mode (Pro): on Grand Prix days the streets round the circuit close to anyone without a race ticket,
// and on National Day the Rock is busy and closed to cars. On those days every route plans round the closures,
// and the event page shows what's shut, when, and the easy way round.
// Closures come from the official rules (arrêtés) published in the Journal de Monaco for each event.
(function () {
  "use strict";
  function t(x, v) { return window.MMEI18N.t(x, v); }
  function esc(x) { return window.MMEUI.esc(x); }
  function tb(x, v) { return esc(t(x, v)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  function isPro() { return !!(window.MMEPro && window.MMEPro.isPro()); }

  // Circuit streets closed to pedestrians without a ticket or pass (2026 rules, the same circuit each year).
  // Partly closed streets carry a box: only the part inside it closes.
  var CIRCUIT = {
    id: "circuit",
    bbox: [43.7300, 43.7465, 7.4150, 7.4340],
    streets: [
      ["Quai des États-Unis"], ["Route de la Piscine"], ["Boulevard Albert 1er"], ["Avenue d'Ostende"], ["Place du Casino"],
      ["Avenue des Spélugues"], ["Avenue de Monte-Carlo"], ["Boulevard Louis II"], ["Avenue John F. Kennedy"], ["Kennedy"],
      ["Avenue de la Madone", [43.7400, 43.7408, 7.4269, 7.4279]],
      ["Avenue des Citronniers", [43.7409, 43.7430, 7.4284, 7.4294]],
      ["Avenue Princesse Grace", [43.7400, 43.7425, 7.4294, 7.4316]],
      ["Avenue de la Costa", [43.7372, 43.7386, 7.4238, 7.4251]],
      ["Escalier de la Costa"], ["Escalier Sainte-Dévote"],
      ["Boulevard du Larvotto", [43.7435, 43.7452, 7.4296, 7.4326]],
      ["Avenue de la Porte Neuve"], ["Avenue de La Quarantaine"], ["Rue des Remparts"]
    ],
    // Quai Albert 1er (the paddock and fan zone by the port), which has no street name on the map.
    areas: [[43.7347, 43.7368, 7.4218, 7.4262]]
  };

  // Days: [date, from, to] in Monaco time. "From early morning until the day's racing ends": we use 06:00 to 20:00.
  var EVENTS = [
    { id: "national-day-2026", name: "National Day", short: "National Day",
      days: [["2026-11-18", "17:00", "23:30"], ["2026-11-19", "07:00", "15:00"]],
      notes: [
        "**Wednesday 18 November, 20:10:** fireworks over Port Hercule. The quays fill up early; the Rock and the Fontvieille side of the harbour are calmer places to watch.",
        "**Thursday 19 November:** Te Deum at the Cathedral at 9:30, then the ceremony in the Palace courtyard at 11:00 and the parade in Palace Square at 11:30.",
        "**Monaco-Ville is closed to cars from 8:30 to 14:00** on the 19th. The Rock’s public lifts and footpaths stay open, and access may be checked, so allow extra time.",
        "**Monaco’s city buses are free all day on the 19th.** It’s a public holiday, so banks and many shops are closed."
      ] },
    { id: "gp-2027", name: "Formula 1 Grand Prix", short: "Grand Prix", closures: CIRCUIT,
      days: [["2027-06-03", "06:00", "20:00"], ["2027-06-04", "06:00", "20:00"], ["2027-06-05", "06:00", "20:00"], ["2027-06-06", "06:00", "20:00"]],
      notes: [
        "**From early morning until the day’s racing ends, 3 to 6 June,** the streets round the circuit are closed to anyone without a race ticket or pass: the harbour front, Boulevard Albert 1er, Casino Square, the hairpin, the tunnel and Boulevard Louis II, and the Rock’s ramparts.",
        "**Routes in the app plan round them,** using the footbridges, underpasses and lifts that stay open. Expect longer walks and queues at the lifts.",
        "**The circuit reopens in the evening** once the day’s racing is over.",
        "**Trains are the easiest way in and out.** Extra trains run from Nice and Menton, and they’re very full after the race: check your train home early."
      ] }
  ];

  function monacoNow() {
    var T = window.MMETransit; var n = T ? T.monacoNow() : null;
    if (!n) { var d = new Date(); return { ymd: d.toISOString().slice(0, 10).replace(/-/g, ""), min: d.getHours() * 60 + d.getMinutes() }; }
    return n;
  }
  function mins(hm) { var p = hm.split(":"); return +p[0] * 60 + +p[1]; }
  function ymd(d) { return d.replace(/-/g, ""); }
  // The event under way right now, if any.
  function active() {
    var n = monacoNow();
    for (var i = 0; i < EVENTS.length; i++) {
      var E = EVENTS[i];
      for (var j = 0; j < E.days.length; j++) { var D = E.days[j]; if (ymd(D[0]) === n.ymd && n.min >= mins(D[1]) && n.min < mins(D[2])) return E; }
    }
    return null;
  }
  // The next event within `within` days (including one under way today).
  function upcoming(within) {
    var n = monacoNow(), today = n.ymd, lim = new Date(today.slice(0, 4) + "-" + today.slice(4, 6) + "-" + today.slice(6, 8) + "T12:00:00Z");
    lim.setUTCDate(lim.getUTCDate() + (within || 7));
    var limY = lim.toISOString().slice(0, 10).replace(/-/g, "");
    return EVENTS.filter(function (E) { var last = ymd(E.days[E.days.length - 1][0]), first = ymd(E.days[0][0]); return last >= today && first <= limY; })[0] || null;
  }

  // Switch the route-finder's closures on or off. Only Pro plans round them; everyone sees the warning.
  function apply() {
    var R = window.MMERouter, E = active();
    if (!R || !R.setClosed) return;
    R.setClosed(E && E.closures && isPro() ? R.closures(E.closures) : null);
  }
  // A line for the planner: what's going on today and whether the route allows for it.
  function routeNote() {
    var E = active();
    if (!E) return "";
    if (!E.closures) return '<p class="summary ev-note">' + tb("**{name} today.** Expect crowds and road closures. See what’s on and the easy way round.", { name: t(E.name) }) + ' <a href="#/event-day">' + esc(t("Event day")) + "</a></p>";
    if (isPro()) return '<p class="summary ev-note">' + tb("**{name} today:** this route avoids the streets closed round the circuit to people without a race ticket.", { name: t(E.name) }) + ' <a href="#/event-day">' + esc(t("What’s closed")) + "</a></p>";
    return '<p class="summary ev-note ev-warn">' + tb("**{name} today:** streets round the circuit are closed to anyone without a race ticket, so this route may be blocked. Monaco Made Easy Pro plans round the closures.", { name: t(E.name) }) + ' <a href="#/pro">' + esc(t("Get Pro")) + "</a></p>";
  }

  function dayText(D) {
    var d = new Date(D[0] + "T12:00:00Z"), L = window.MMEI18N.lang ? window.MMEI18N.lang() : "en";
    var s; try { s = d.toLocaleDateString(L, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); } catch (e) { s = D[0]; }
    return s + ", " + D[1] + "–" + D[2];
  }

  var screen = {
    html: function () {
      var E = upcoming(400);
      var head = '<section class="page eventday"><h1>' + esc(t("Event day")) + '</h1><p class="lede-dark">' + esc(t("On Grand Prix days and Monaco’s big holidays, streets close and crowds build. Your routes plan round the closures, and this page shows what’s shut and when.")) + "</p>";
      if (!isPro()) return head + window.MMEPro.lockCard("Event day") + "</section>";
      if (!E) return head + '<p class="summary">' + esc(t("No event days coming up just now.")) + "</p></section>";
      var on = active() === E;
      return head + '<div class="ev-card' + (on ? " on" : "") + '"><p class="gh-kicker">' + esc(t(on ? "Today" : "Coming up")) + "</p><h2>" + esc(t(E.name)) + "</h2>" +
        '<ul class="ev-days">' + E.days.map(function (D) { return "<li>" + esc(dayText(D)) + "</li>"; }).join("") + "</ul></div>" +
        (E.closures ? '<h2 class="steps-h">' + esc(t("Closed to people without a ticket")) + '</h2><div id="ev-map" class="ev-map" role="img" aria-label="' + esc(t("Map of the closed streets")) + '"></div>' : "") +
        '<ul class="ev-notes">' + E.notes.map(function (n) { return "<li>" + tb(n) + "</li>"; }).join("") + "</ul>" +
        '<a class="btn btn-red" href="#/get-home">' + esc(t("Get me home")) + "</a>" +
        '<p class="small-print">' + esc(t("From the official rules published by the Government and the Mairie of Monaco. Stewards and police on the day have the final word.")) + "</p></section>";
    },
    mount: function (root) {
      var el = root.querySelector("#ev-map"), E = upcoming(400);
      if (!el || !E || !E.closures || !window.L || !window.MMEMap) return;
      var map = window.MMEMap.makeMap(el, { zoom: 15 }), R = window.MMERouter, arr = R.closures(E.closures), lines = [];
      for (var k = 0; k < arr.length; k++) if (arr[k]) lines.push(R.edgePts(k));
      var layer = L.polyline(lines, { color: "#c8102e", weight: 5, opacity: 0.85 }).addTo(map);
      map.fitBounds(layer.getBounds().pad(0.08));
    }
  };

  apply();
  window.addEventListener("load", apply);
  setInterval(apply, 60000);
  window.addEventListener("mme-pro", apply);
  window.MMEEventDay = { EVENTS: EVENTS, active: active, upcoming: upcoming, apply: apply, routeNote: routeNote, screen: screen };
})();
