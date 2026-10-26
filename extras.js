// Monaco Made Easy: the things that make it a companion for the whole stay.
// 1. "Back to where I'm staying" in one tap.   2. Events (Grand Prix and more).
// 3. Cruise mode: all-aboard countdown.          4. Save the map for use without mobile data.
// 5. Lift reports shared between visitors (stored in Supabase; no personal data).
(function () {
  "use strict";
  var D = window.MME;
  function t(s, v) { return window.MMEI18N.t(s, v); }
  function esc(s) { return window.MMEUI.esc(s); }
  function lang() { var l = window.MMEI18N.lang(); return l === "en" ? "en-GB" : l === "zh" ? "zh-CN" : l; }

  // Small saved settings on this phone. Never essential: everything works if storage is blocked.
  function load(k) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function now() { return window.MMETransit && window.MMETransit.monacoNow ? window.MMETransit.monacoNow() : { ymd: "", min: 0 }; }
  function ymdOf(s) { return s.replace(/-/g, ""); }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }
  function dayDiff(a, b) { // a, b as "YYYYMMDD"
    function d(x) { return Date.UTC(+x.slice(0, 4), +x.slice(4, 6) - 1, +x.slice(6, 8)); }
    return Math.round((d(b) - d(a)) / 86400000);
  }
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.4 10 4l8 8-8 8-1.4-1.4 6.6-6.6z"/></svg>';

  // ---------------------------------------------------------------------------
  // 1. Where I'm staying
  // ---------------------------------------------------------------------------
  var Home = {
    get: function () { return load("mme-home"); },
    set: function (p) { save("mme-home", { label: p.label, lat: p.lat, lng: p.lng, kind: "home" }); },
    is: function (p) { var h = Home.get(); return !!(h && p && Math.abs(h.lat - p.lat) < 1e-5 && Math.abs(h.lng - p.lng) < 1e-5); }
  };
  var HOUSE = '<svg class="home-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z"/></svg>';
  function homeCard() {
    var h = Home.get();
    if (!h) return '<a class="home-btn home-red" href="#/stay">' + HOUSE + "<span><strong>" + esc(t("Where are you staying?")) + "</strong><small>" +
      esc(t("Save it once, then one tap gets you back from anywhere.")) + "</small></span>" + ARROW + "</a>";
    return '<a class="home-btn home-red" href="#/home-route">' + HOUSE + "<span><strong>" +
      esc(t("Back to {name}", { name: t(h.label) })) + "</strong><small>" + esc(t("The easiest way from where you are now")) + "</small></span>" + ARROW + "</a>" +
      '<a class="home-change" href="#/stay">' + esc(t("Change where I’m staying")) + "</a>";
  }

  // ---------------------------------------------------------------------------
  // 2. Events. Dates checked against the organisers' announcements in October 2026.
  // ---------------------------------------------------------------------------
  var CIRCUIT_TEXT = "While cars are on track, the streets of the circuit are closed to anyone without a ticket. Cross at the footbridges and underpasses, and allow plenty of extra time around the harbour, Casino Square and the tunnel.";
  var PORT = [43.73500, 7.42240], PALACE = [43.731296, 7.421445];
  var EVENTS = [
    { id: "national-day", name: "Monaco National Day", start: "2026-11-19", end: "2026-11-19", kind: "rock",
      about: "Monaco’s national holiday, also called the Fête du Prince.", where: "Place du Palais", ll: PALACE,
      text: "Ceremonies at the Palace and the Cathedral make Monaco-Ville very busy, especially in the morning. Expect crowds and some road closures on the Rock, and allow extra time." },
    { id: "christmas", name: "Christmas Village", start: "2026-12-04", end: "2027-01-03", kind: "festive", tbc: "December to early January",
      about: "Chalets, festive food and shows along the harbour, usually with an ice rink.", where: "Quai Albert 1er, Port Hercule", ll: PORT,
      text: "Busiest in the evenings and at weekends." },
    { id: "rallye", name: "Rallye Monte-Carlo", start: "2027-01-21", end: "2027-01-24", kind: "outside",
      about: "The opening round of the World Rally Championship.", where: "Port Hercule", ll: PORT,
      text: "The official start is at Port Hercule on Thursday 21 January, and the prize-giving is there on Sunday 24 January. Most of the stages are in the mountains." },
    { id: "circus", name: "Monte-Carlo International Circus Festival", start: "2027-01-22", end: "2027-01-31", kind: "show",
      about: "Circus acts from around the world compete under the big top in Fontvieille.", where: "Chapiteau de Fontvieille", ll: [43.726307, 7.418773],
      link: "https://montecarlosbm.com/en/agenda/festival-international-du-cirque-de-monte-carlo",
      text: "Shows often sell out, so book ahead." },
    { id: "sainte-devote", name: "Sainte-Dévote", start: "2027-01-26", end: "2027-01-27", kind: "tradition",
      about: "The feast of Monaco’s patron saint.", where: "Église Sainte-Dévote", ll: [43.737561, 7.420849],
      text: "On the evening of 26 January a boat is set alight in front of the Sainte-Dévote church, followed by fireworks. On the 27th there is a Mass and a procession." },
    { id: "masters", name: "Rolex Monte-Carlo Masters (tennis)", start: "2027-04-03", end: "2027-04-11", kind: "outside",
      about: "One of tennis’s big clay-court tournaments.",
      text: "The tennis is at the Monte-Carlo Country Club, just over the border in Roquebrune-Cap-Martin (France). Roads and buses to the east of Monaco are busier than usual." },
    { id: "eprix", name: "Monaco E-Prix", start: "2027-05-01", end: "2027-05-02", kind: "circuit", about: "Electric single-seater racing on the Grand Prix circuit.", where: "Port Hercule", ll: PORT, text: CIRCUIT_TEXT },
    { id: "gp", name: "Formula 1 Monaco Grand Prix", start: "2027-06-04", end: "2027-06-06", kind: "circuit", about: "The most famous race of the Formula 1 season. In 2027 it has a sprint race for the first time.", where: "Port Hercule", ll: PORT,
      text: CIRCUIT_TEXT, extra: "Barriers and grandstands go up around the harbour in the weeks before, so some pavements are narrower or diverted." },
    { id: "yacht", name: "Monaco Yacht Show", start: "2027-09-22", end: "2027-09-25", kind: "port", about: "One of the world’s biggest superyacht shows.", where: "Port Hercule", ll: PORT,
      text: "The show takes over Port Hercule. Some quayside paths are open only to visitors with a ticket, so allow extra time to get around the harbour." }
  ];
  // Streets that form the Monaco circuit (as named in OpenStreetMap).
  var CIRCUIT = ["Boulevard Albert 1er", "Rond-Point Sainte-Dévote", "Avenue d'Ostende", "Avenue de Monte-Carlo", "Place du Casino",
    "Avenue des Spélugues", "Boulevard Louis II", "Quai des États-Unis", "Route de la Piscine", "Rascasse"];

  function dateRange(a, b) {
    var A = new Date(a + "T12:00:00Z"), B = new Date(b + "T12:00:00Z");
    try {
      var f = new Intl.DateTimeFormat(lang(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      return a === b ? f.format(A) : f.formatRange ? f.formatRange(A, B) : f.format(A) + " – " + f.format(B);
    } catch (e) { return a + (a === b ? "" : " – " + b); }
  }
  function upcoming() {
    var today = now().ymd;
    return EVENTS.filter(function (e) { return ymdOf(e.end) >= today; });
  }
  function eventSoon() { // on now, or starting within a week
    var today = now().ymd;
    return EVENTS.filter(function (e) { return ymdOf(e.end) >= today && dayDiff(today, ymdOf(e.start)) <= 7; })[0] || null;
  }
  function circuitToday() {
    var today = now().ymd;
    return EVENTS.filter(function (e) { return e.kind === "circuit" && ymdOf(e.start) <= today && ymdOf(e.end) >= today; })[0] || null;
  }
  function evDate(e) { return e.tbc ? t(e.tbc) + " (" + t("dates to be confirmed") + ")" : dateRange(e.start, e.end); }
  function eventBanner() {
    var e = eventSoon();
    if (!e) return "";
    var on = ymdOf(e.start) <= now().ymd;
    return '<a class="event-banner" href="#/whats-on"><span class="ev-tag">' + esc(t(on ? "On now" : "Coming up")) + "</span><strong>" + esc(t(e.name)) + '</strong><span class="ev-date">' + esc(evDate(e)) + "</span>" +
      "<p>" + esc(t(e.text)) + (e.extra ? " " + esc(t(e.extra)) : "") + "</p></a>";
  }
  function eventsInfo() { // "Good to know": only the next few events that change how you get around
    var list = upcoming().filter(function (e) { return ["rock", "circuit", "port", "outside"].indexOf(e.kind) !== -1; }).slice(0, 3);
    if (!list.length) return "";
    return '<section class="events-info"><h2>' + esc(t("Events in Monaco")) + '</h2><ul class="ev-list">' + list.map(function (e) {
      return "<li><strong>" + esc(t(e.name)) + '</strong><span class="ev-date">' + esc(evDate(e)) + "</span><p>" + esc(t(e.text)) + (e.extra ? " " + esc(t(e.extra)) : "") + "</p></li>";
    }).join("") + '</ul><a class="know-link" href="#/whats-on">' + esc(t("What’s on in Monaco: shows, concerts and events")) + ARROW + '</a><p class="unchecked">' + esc(t("Dates come from the organisers. Check before you travel.")) + "</p></section>";
  }

  // "What's on": the big events above, the venues' own programmes, and the things that happen every day.
  var VENUES = [
    { name: "Opéra de Monte-Carlo & Les Ballets de Monte-Carlo", what: "Opera and ballet in the Salle Garnier, the theatre inside the Casino building.", ll: [43.73975, 7.4282],
      links: [["Opera", "https://www.opera.mc"], ["Ballet", "https://www.balletsdemontecarlo.com"]] },
    { name: "Monte-Carlo Philharmonic Orchestra", what: "Concerts at the Auditorium Rainier III, from September to July.", ll: [43.738352, 7.429406], links: [["See the programme", "https://www.opmc.mc"]] },
    { name: "Grimaldi Forum", what: "Big shows, concerts and exhibitions by the sea at Larvotto.", ll: [43.7439, 7.431], links: [["See the programme", "https://www.grimaldiforum.com"]] },
    { name: "Théâtre Princesse Grace", what: "Plays, comedy and music, mostly in French.", ll: [43.737651, 7.426034], links: [["See the programme", "https://www.tpgmonaco.mc"]] },
    { name: "AS Monaco", what: "Football at the Stade Louis II in Fontvieille.", ll: [43.727506, 7.41551], links: [["Fixtures and tickets", "https://www.asmonaco.com"]] }
  ];
  var DAILY = [
    { name: "Changing of the Guard", what: "Every day at 11:55 in front of the Prince’s Palace. Arrive by 11:30 for a good spot.", where: "Place du Palais", ll: PALACE },
    { name: "Marché de la Condamine", what: "Fresh food stalls every morning on Place d’Armes, with lunch counters inside the market hall.", where: "Place d’Armes", ll: [43.732633, 7.41953] }
  ];
  function goBtn(label, ll) { return ll ? '<button type="button" class="btn-small" data-wo-go="' + ll[0] + "," + ll[1] + '" data-label="' + esc(label) + '">' + esc(t("Take me there")) + "</button>" : ""; }
  function extLink(label, url) { return '<a class="btn-small wo-ext" href="' + url + '" target="_blank" rel="noopener">' + esc(t(label)) + "</a>"; }
  var whatsOnScreen = {
    html: function () {
      var today = now().ymd, list = upcoming();
      var on = list.filter(function (e) { return ymdOf(e.start) <= today; }), next = list.filter(function (e) { return ymdOf(e.start) > today; });
      function card(e) {
        return '<li class="wo-ev"><span class="ev-date">' + esc(evDate(e)) + "</span><strong>" + esc(t(e.name)) + "</strong>" +
          (e.where ? '<span class="wo-where">' + esc(e.where) + "</span>" : "") +
          "<p>" + (e.about ? esc(t(e.about)) + " " : "") + esc(t(e.text)) + (e.extra ? " " + esc(t(e.extra)) : "") + "</p>" +
          '<div class="wo-acts">' + goBtn(t(e.name), e.ll) + (e.link ? extLink("More information", e.link) : "") + "</div></li>";
      }
      return '<section class="page whats-on"><h1>' + esc(t("What’s on")) + '</h1><p class="lede-dark">' + esc(t("Events, shows and concerts in Monaco, and the easy way to get there.")) + "</p>" +
        (on.length ? "<h2>" + esc(t("On now")) + '</h2><ul class="wo-list">' + on.map(card).join("") + "</ul>" : "") +
        (next.length ? "<h2>" + esc(t("Coming up")) + '</h2><ul class="wo-list">' + next.map(card).join("") + "</ul>" : "") +
        yachtsBox() +
        "<h2>" + esc(t("Theatre, concerts and sport")) + '</h2><p class="wo-note">' + esc(t("Each venue’s own programme, always up to date.")) + '</p><ul class="wo-list">' + VENUES.map(function (v) {
          return '<li class="wo-ev"><strong>' + esc(v.name) + "</strong><p>" + esc(t(v.what)) + '</p><div class="wo-acts">' + v.links.map(function (l) { return extLink(l[0], l[1]); }).join("") + goBtn(v.name, v.ll) + "</div></li>";
        }).join("") + "</ul>" +
        "<h2>" + esc(t("Every day")) + '</h2><ul class="wo-list">' + DAILY.map(function (d) {
          return '<li class="wo-ev"><strong>' + esc(t(d.name)) + '</strong><span class="wo-where">' + esc(d.where) + "</span><p>" + esc(t(d.what)) + '</p><div class="wo-acts">' + goBtn(t(d.name), d.ll) + "</div></li>";
        }).join("") + "</ul>" +
        '<a class="know-link" href="https://monservicepublic.gouv.mc/en/administrative-diary" target="_blank" rel="noopener">' + esc(t("Full calendar of events and public holidays, from the Monaco government")) + ARROW + "</a>" +
        '<p class="unchecked">' + esc(t("Dates come from the organisers. Check before you travel.")) + "</p></section>";
    },
    mount: function (el) {
      if (window.MMEStats) window.MMEStats.track("Whats on opened");
      mountYachts(el);
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-wo-go]");
        if (b) {
          var ll = b.dataset.woGo.split(",");
          window.MMEPlanner.state.to = { label: b.dataset.label, lat: +ll[0], lng: +ll[1], kind: "place" };
          window.MMEPlanner.state.from = null; window.MMEPlanner.state.arrival = null;
          location.hash = "#/plan"; return;
        }
        var x = e.target.closest(".wo-ext");
        if (x && window.MMEStats) window.MMEStats.track("Whats on link", { to: x.hostname });
      });
    }
  };
  // A note for the plan screen when the route uses circuit streets on a race day.
  function routeEventNote(r) {
    var e = circuitToday();
    if (!e || !r || !r.streets) return "";
    var hit = r.streets.filter(function (s) { return CIRCUIT.indexOf(s) !== -1; });
    if (!hit.length) return "";
    return '<aside class="note note-event"><strong>' + esc(t(e.name)) + "</strong><p>" +
      esc(t("This route uses streets on the circuit ({streets}). While cars are on track you can only cross at the footbridges and underpasses, so allow extra time.", { streets: hit.slice(0, 3).join(", ") })) + "</p></aside>";
  }

  // ---------------------------------------------------------------------------
  // 3. Cruise mode
  // ---------------------------------------------------------------------------
  var BUFFER = 30; // minutes to spare at the ship: security, the tender queue, a wrong turn
  function cruise() {
    var c = load("mme-cruise");
    if (!c || c.ymd !== now().ymd) return null;
    return c;
  }
  function shipPoint(c) { return { label: "Your ship", lat: c.ship.lat, lng: c.ship.lng, kind: "ship" }; }
  var walkCache = { key: "", min: null };
  function walkBack(c, here) {
    if (!here || !window.MMERouter) return null;
    var key = here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    if (walkCache.key === key) return walkCache.min;
    var r = window.MMERouter.route(here, c.ship, { avoidSteps: true, blocked: Reports.blockedPoints() });
    walkCache = { key: key, min: r ? r.minutes + Math.round(r.endGap / 70) : null };
    return walkCache.min;
  }
  function cruiseCardInner(c) {
    var here = window.MMEMap && window.MMEMap.here ? window.MMEMap.here() : null;
    var known = walkBack(c, here), walk = known || 25;
    var n = now().min, aboard = c.aboard, leave = aboard - walk - BUFFER;
    var head, sub, urgent = false;
    if (n >= aboard) { head = t("Your all-aboard time has passed."); sub = ""; urgent = true; }
    else if (n >= leave) { head = t("Start heading back now"); urgent = true; sub = t("Allowing {n} min to walk back and 30 min to spare.", { n: walk }); }
    else {
      var left = leave - n, h = Math.floor(left / 60), m = left % 60;
      head = t("Leave by {time}", { time: hhmm(leave) });
      sub = (h ? t("{h} h {m} min to go", { h: h, m: m }) : t("{m} min to go", { m: m })) + "\n" + t("Allowing {n} min to walk back and 30 min to spare.", { n: walk });
    }
    return '<span class="cr-top">' + esc(t("Back on board by {time}", { time: hhmm(aboard) })) + "</span>" +
      '<strong class="cr-head' + (urgent ? " cr-urgent" : "") + '">' + esc(head) + "</strong>" + (sub ? sub.split("\n").map(function (x) { return "<small>" + esc(x) + "</small>"; }).join("") : "") +
      '<span class="cr-go">' + esc(t("Back to the ship")) + ARROW + "</span>";
  }
  function cruiseCard() {
    var c = cruise();
    if (!c) return "";
    return '<a class="cruise-card" id="cruise-card" href="#/ship">' + cruiseCardInner(c) + "</a>";
  }
  var cruiseTimer = null;
  function mountHome(root) {
    clearInterval(cruiseTimer);
    var c = cruise();
    if (!c) return;
    window.MMEMap.startLocating(function () {});
    function tick() {
      var el = document.getElementById("cruise-card");
      if (!el) { clearInterval(cruiseTimer); return; }
      el.innerHTML = cruiseCardInner(c);
    }
    var stop = window.MMEMap.onLocation(function () { if (!document.getElementById("cruise-card")) { stop(); return; } tick(); });
    cruiseTimer = setInterval(tick, 30000);
    if (window.MMERouter) window.MMERouter.ready.then(tick);
  }

  var cruiseScreen = {
    html: function () {
      if (window.MMEPro && !window.MMEPro.isPro()) return '<section class="arrive cruise"><a class="back" href="#/transport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Transport")) + "</a><h1>" + esc(t("Cruise day")) + "</h1>" + window.MMEPro.lockCard("Cruise day") + "</section>";
      var c = load("mme-cruise"), active = cruise();
      var val = c && c.aboard != null ? hhmm(c.aboard) : "17:00";
      return '<section class="arrive cruise"><a class="back" href="#/transport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Transport")) + "</a>" +
        "<h1>" + esc(t("Cruise day")) + '</h1><p class="lede-dark">' + esc(t("Tell us when you need to be back on board. We’ll keep an eye on the time and tell you when to start heading back.")) + "</p>" +
        '<div class="ar-q"><label class="ar-legend" for="cr-time">' + esc(t("All aboard time")) + '</label><input id="cr-time" class="cr-time" type="time" value="' + val + '" required></div>' +
        '<fieldset class="ar-q"><legend>' + esc(t("Where did you come ashore?")) + '</legend><div class="ar-opts">' +
        '<label class="ar-opt"><input type="radio" name="ship" value="port" checked><span><strong>' + esc(t("Port Hercule")) + "</strong><small>" + esc(t("Most cruise passengers land here.")) + "</small></span></label>" +
        '<label class="ar-opt"><input type="radio" name="ship" value="here"><span><strong>' + esc(t("Where I am now")) + "</strong><small>" + esc(t("Use this if you’re standing at your ship or the tender landing.")) + "</small></span></label>" +
        "</div></fieldset>" +
        '<p class="form-err" id="cr-err" role="alert" hidden></p>' +
        '<button type="button" class="btn btn-red ar-go" id="cr-go">' + esc(t("Start cruise mode")) + "</button>" +
        (active ? '<button type="button" class="btn btn-line cr-end" id="cr-end">' + esc(t("End cruise mode")) + "</button>" : "") + "</section>";
    },
    mount: function (root) {
      var err = root.querySelector("#cr-err");
      if (!err) return;
      root.querySelector("#cr-go").addEventListener("click", function () {
        var v = root.querySelector("#cr-time").value;
        if (!/^\d{2}:\d{2}$/.test(v)) { err.textContent = t("Choose your all-aboard time."); err.hidden = false; return; }
        var aboard = (+v.slice(0, 2)) * 60 + (+v.slice(3, 5));
        var port = D.places.port;
        function done(ship) { save("mme-cruise", { ymd: now().ymd, aboard: aboard, ship: ship }); if (window.MMEStats) window.MMEStats.track("Cruise mode started"); location.hash = "#/"; }
        if (root.querySelector("input[name=ship]:checked").value === "here") {
          err.textContent = t("Finding where you are…"); err.hidden = false;
          var fin = false;
          window.MMEMap.startLocating(function () { if (fin) return; fin = true; done({ lat: port.lat, lng: port.lng }); });
          var stop = window.MMEMap.onLocation(function (pos) { if (fin) return; fin = true; setTimeout(function () { stop(); }, 0); done({ lat: pos.lat, lng: pos.lng }); });
          setTimeout(function () { if (!fin) { fin = true; done({ lat: port.lat, lng: port.lng }); } }, 12000);
        } else done({ lat: port.lat, lng: port.lng });
      });
      var end = root.querySelector("#cr-end");
      if (end) end.addEventListener("click", function () { save("mme-cruise", null); location.hash = "#/"; });
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Save the map for use without mobile data
  // ---------------------------------------------------------------------------
  var TILES = "mme-map-tiles";
  var BOX = { s: 43.712, n: 43.776, w: 7.385, e: 7.495 }; // Cap d'Ail to Roquebrune-Cap-Martin
  function tileUrls() {
    var r = (window.devicePixelRatio || 1) > 1 ? "@2x" : "", out = [];
    function tx(lng, z) { return Math.floor((lng + 180) / 360 * Math.pow(2, z)); }
    function ty(lat, z) { var s = Math.sin(lat * Math.PI / 180); return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z)); }
    for (var z = 13; z <= 17; z++) {
      for (var x = tx(BOX.w, z); x <= tx(BOX.e, z); x++) for (var y = ty(BOX.n, z); y <= ty(BOX.s, z); y++) {
        out.push("https://" + "abcd"[Math.abs(x + y) % 4] + ".basemaps.cartocdn.com/rastertiles/voyager/" + z + "/" + x + "/" + y + r + ".png?key=" + window.MMEMap.CARTO_KEY);
      }
    }
    [[8528, 5974], [8528, 5975], [8529, 5973], [8529, 5974], [8529, 5975], [8530, 5971], [8530, 5972], [8530, 5973], [8530, 5974],
      [8531, 5971], [8531, 5972], [8532, 5971], [8532, 5972], [8532, 5973], [8533, 5971], [8533, 5972]].forEach(function (xy) { out.push("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/14/" + xy[0] + "/" + xy[1] + ".png"); });
    return out;
  }
  function offlineSize() { return Math.max(1, Math.round(tileUrls().length * ((window.devicePixelRatio || 1) > 1 ? 0.045 : 0.018))); }
  function saveOffline(progress) {
    if (!("caches" in window)) return Promise.reject(new Error("no-cache"));
    var urls = tileUrls(), done = 0, failed = 0;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    return caches.open(TILES).then(function (c) {
      var i = 0;
      function one(url) {
        return c.match(url, { ignoreVary: true }).then(function (hit) {
          if (hit) return;
          return fetch(url, { mode: "cors" }).then(function (res) { if (!res.ok) throw new Error(res.status); return c.put(url, res); })
            .catch(function () { return fetch(url, { mode: "no-cors" }).then(function (res) { return c.put(url, res); }); });
        }).catch(function () { failed++; }).then(function () { done++; progress(Math.round(done / urls.length * 100)); });
      }
      function worker() { if (i >= urls.length) return Promise.resolve(); return one(urls[i++]).then(worker); }
      return Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]).then(function () {
        if (failed > urls.length * 0.1) throw new Error("failed");
        save("mme-offline", { ymd: now().ymd, n: urls.length });
        if (window.MMEStats) window.MMEStats.track("Map saved offline");
      });
    });
  }
  function offlineCard() {
    if (window.MMEPro && !window.MMEPro.isPro()) return window.MMEPro.lockCard("Use it without mobile data");
    var s = load("mme-offline");
    var when = "";
    if (s && s.ymd) { try { when = new Intl.DateTimeFormat(lang(), { day: "numeric", month: "long" }).format(new Date(Date.UTC(+s.ymd.slice(0, 4), +s.ymd.slice(4, 6) - 1, +s.ymd.slice(6, 8), 12))); } catch (e) { when = s.ymd; } }
    return '<section class="offline-card"><h2>' + esc(t("Use it without mobile data")) + "</h2><p>" +
      esc(t("Save the Monaco map on this phone (about {n} MB), so the map and routes work even with roaming switched off.", { n: offlineSize() })) + "</p>" +
      (s ? '<p class="off-ok" id="off-status">' + esc(t("Map saved on this phone on {date}.", { date: when })) + "</p>" : '<p class="off-status" id="off-status" role="status"></p>') +
      '<div class="off-bar" id="off-bar" hidden><i></i></div>' +
      '<button type="button" class="btn ' + (s ? "btn-line" : "btn-navy") + '" id="off-go">' + esc(t(s ? "Update the saved map" : "Save map for offline")) + "</button></section>";
  }
  function mountOffline(root) {
    var b = root.querySelector("#off-go");
    if (!b) return;
    b.addEventListener("click", function () {
      var st = root.querySelector("#off-status"), bar = root.querySelector("#off-bar");
      b.disabled = true; bar.hidden = false;
      st.className = "off-status";
      saveOffline(function (p) { st.textContent = t("Saving the map… {p}%", { p: p }); bar.firstChild.style.width = p + "%"; })
        .then(function () { st.className = "off-ok"; st.textContent = t("Saved. The map, routes and bus times now work without signal."); b.remove(); bar.hidden = true; })
        .catch(function (e) { st.className = "form-err"; st.textContent = e && e.message === "no-cache" ? t("This phone can’t save maps for offline use.") : t("Couldn’t save the map. Check your connection and try again."); b.disabled = false; bar.hidden = true; });
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Lift reports, shared between visitors
  // ---------------------------------------------------------------------------
  // The publishable key is meant to be public: the database only lets visitors add a report
  // (lift, problem, time) and read the last three days of reports.
  var SB = "https://oimcxmlewxjtcvrbpzop.supabase.co/rest/v1/mme_lift_reports";
  var SB_KEY = "sb_publishable_D1uaOD08d5u6aepRYDXetw_MrLZ2k9r";
  var WINDOW_H = 48; // reports count for two days
  var latest = {};   // lift id -> { problem, at (ms) }

  function mine() { return (load("mme-my-reports") || []).filter(function (r) { return Date.now() - r.at < WINDOW_H * 3600000; }); }
  function apply(list) {
    list.forEach(function (r) { if (!latest[r.lift_id] || latest[r.lift_id].at < r.at) latest[r.lift_id] = { problem: r.problem, at: r.at }; });
  }
  function refresh() {
    latest = {};
    apply(mine());
    var since = new Date(Date.now() - WINDOW_H * 3600000).toISOString();
    return fetch(SB + "?select=lift_id,problem,created_at&order=created_at.asc&created_at=gte." + encodeURIComponent(since), { headers: { apikey: SB_KEY } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        apply((rows || []).map(function (r) { return { lift_id: r.lift_id, problem: r.problem, at: Date.parse(r.created_at) }; }));
        window.dispatchEvent(new Event("mme-reports"));
      }).catch(function () {});
  }
  function send(r) {
    return fetch(SB, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ lift_id: r.lift_id, problem: r.problem }) })
      .then(function (res) { if (!res.ok) throw new Error(res.status); });
  }
  function flush() { // reports made with no signal go up when the phone is back online
    var q = load("mme-report-queue") || [];
    if (!q.length) return;
    save("mme-report-queue", []);
    q.forEach(function (r) { send(r).catch(function () { var qq = load("mme-report-queue") || []; qq.push(r); save("mme-report-queue", qq); }); });
  }
  var Reports = {
    status: function (id) { var s = latest[id]; return s && s.problem !== "working" ? s : null; },
    report: function (id, problem) {
      var r = { lift_id: id, problem: problem, at: Date.now() };
      if (window.MMEStats) window.MMEStats.track("Lift reported", { problem: problem });
      var m = mine(); m.push(r); save("mme-my-reports", m);
      apply([r]);
      window.dispatchEvent(new Event("mme-reports"));
      return send(r).then(function () { return true; }).catch(function () {
        var q = load("mme-report-queue") || []; q.push(r); save("mme-report-queue", q); return false;
      });
    },
    blockedPoints: function () {
      return D.lifts.filter(function (l) { return Reports.status(l.id); }).map(function (l) { return { lat: l.lat, lng: l.lng, id: l.id, name: window.MMEMap ? window.MMEMap.liftName(l) : l.name }; });
    },
    label: function (s) {
      var d = new Date(s.at), today = new Date();
      if (d.toDateString() === today.toDateString()) return t("Reported not working at {time}", { time: ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) });
      return t("Reported not working yesterday");
    },
    refresh: refresh
  };
  function reportBox(l) {
    var s = Reports.status(l.id);
    return '<div class="rep" data-rep="' + esc(l.id) + '">' + (s ? '<p class="rep-down">' + esc(Reports.label(s)) + "</p>" : "") +
      '<button type="button" class="rep-open" data-rep-open>' + esc(t("Report a problem")) + "</button>" +
      '<div class="rep-opts" hidden><button type="button" data-rep-send="out_of_order">' + esc(t("Out of order")) + '</button><button type="button" data-rep-send="closed">' + esc(t("Closed or locked")) + "</button>" +
      (s ? '<button type="button" data-rep-send="working">' + esc(t("Working again")) + "</button>" : "") + '</div><p class="rep-thanks" role="status"></p></div>';
  }
  // One listener handles report buttons wherever they appear (map pop-ups and the lift list).
  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-rep-open]");
    if (open) { var o = open.parentNode.querySelector(".rep-opts"); o.hidden = !o.hidden; return; }
    var b = e.target.closest("[data-rep-send]");
    if (!b) return;
    var box = b.closest("[data-rep]"), msg = box.querySelector(".rep-thanks");
    box.querySelector(".rep-opts").hidden = true;
    Reports.report(box.dataset.rep, b.dataset.repSend).then(function (sent) {
      msg.textContent = sent ? t("Thanks. Other visitors will see this for the next two days.") : t("Saved on this phone. We’ll share it when you have signal.");
    });
  });
  // A note for the plan screen when we've steered round a reported lift.
  function routeReportNote(avoided) {
    if (!avoided.length) return "";
    return '<aside class="note note-report"><strong>' + esc(t("Lift reported out of order")) + "</strong><p>" +
      esc(t("We’ve sent you around {name}, which another visitor reported isn’t working.", { name: avoided.map(function (b) { return b.name; }).join(", ") })) + "</p></aside>";
  }

  refresh();
  window.addEventListener("online", function () { flush(); refresh(); });
  flush();
  setInterval(refresh, 10 * 60000);

  // ---------------------------------------------------------------------------
  // 6. Know before you go: the things visitors usually learn the hard way
  // ---------------------------------------------------------------------------
  var KNOW = [
    ["Phone roaming", "Monaco isn’t in the EU, so free EU roaming doesn’t apply here. Your phone may switch to a Monaco network and charge roaming rates, even on EU and UK plans. Check with your provider before you arrive, or save our map below so it works with roaming switched off."],
    ["Dress in town", "Swimwear and bare chests are for the beach. In the streets, shops and on buses, cover up: the police can ask you to."],
    ["The Casino", "To go into the gaming rooms of the Casino de Monte-Carlo you must be 18 or over and show a passport or national ID card. There’s an entry charge, and smart dress is expected: no sportswear or flip-flops."],
    ["Changing of the Guard", "Every day at 11:55 in front of the Prince’s Palace. Arrive by 11:30 for a good spot. The easiest way up is in the app: plan a route to the Palace."],
    ["Drones", "Flying a drone in Monaco needs permission from the authorities, so leave it in your bag."],
    ["Paying", "Monaco uses the euro and cards are accepted almost everywhere, but some taxis take cash only."],
    ["Water", "Tap water is safe to drink."]
  ];
  function knowCard() {
    return '<section class="know" id="know"><h2>' + esc(t("Know before you go")) + '</h2><dl class="know-list">' + KNOW.map(function (k) {
      return "<div><dt>" + esc(t(k[0])) + "</dt><dd>" + esc(t(k[1])) + "</dd></div>";
    }).join("") + "</dl></section>";
  }
  function knowLink() {
    return '<a class="know-link" href="#/info">' + esc(t("Know before you go: phone roaming, dress rules and the Casino")) + ARROW + "</a>";
  }

  // ---------------------------------------------------------------------------
  // 6. Biggest yachts in port today (from the yachts' own public AIS signals, via /api/yachts)
  // ---------------------------------------------------------------------------
  var FLAG_ISO = { "Albania": "AL", "Antigua and Barbuda": "AG", "Australia": "AU", "Bahamas": "BS", "Barbados": "BB", "Belgium": "BE", "Bermuda": "BM", "British Virgin Islands": "VG",
    "Canada": "CA", "Cayman Islands": "KY", "Cook Islands": "CK", "Croatia": "HR", "Cyprus": "CY", "Denmark": "DK", "France": "FR", "Germany": "DE", "Gibraltar": "GI", "Greece": "GR",
    "Ireland": "IE", "Italy": "IT", "Jamaica": "JM", "Liberia": "LR", "Luxembourg": "LU", "Malta": "MT", "Marshall Islands": "MH", "Mexico": "MX", "Monaco": "MC", "Netherlands": "NL",
    "New Zealand": "NZ", "Norway": "NO", "Panama": "PA", "Poland": "PL", "Portugal": "PT", "Qatar": "QA", "Russia": "RU", "Saudi Arabia": "SA", "Spain": "ES", "St Kitts and Nevis": "KN",
    "St Vincent": "VC", "Sweden": "SE", "Switzerland": "CH", "Turkey": "TR", "United Arab Emirates": "AE", "United Kingdom": "GB", "United States": "US" };
  function flagName(f) {
    var iso = FLAG_ISO[f];
    if (!iso) return f || "";
    try { return new Intl.DisplayNames([window.MMEI18N.lang()], { type: "region" }).of(iso) || f; } catch (e) { return f; }
  }
  function placeName(p) { return !p ? "" : p === "At anchor" ? t("At anchor off Monaco") : t(p); }
  function yachtsBox() { return '<section class="yachts" id="yachts-box" hidden></section>'; }
  function mountYachts(root) {
    var box = root.querySelector("#yachts-box");
    if (!box || !window.fetch) return;
    fetch("/api/yachts").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.ok || !d.top || !d.top.length || !document.body.contains(box)) return;
      var mins = d.updated ? Math.max(1, Math.round((Date.now() - new Date(d.updated).getTime()) / 60000)) : null;
      box.innerHTML = "<h2>" + esc(t("Biggest yachts in port today")) + '</h2><ol class="yt-list">' + d.top.map(function (y) {
        return '<li><span class="yt-len">' + esc(t("{n} m", { n: y.length })) + "</span><span><strong>" + esc(y.name) + "</strong><small>" +
          esc([flagName(y.flag), placeName(y.place)].filter(Boolean).join(" · ")) + "</small></span></li>";
      }).join("") + "</ol>" +
        '<p class="wo-note">' + esc(t("From the yachts’ own public AIS signals. Some switch theirs off in port, so not every yacht shows.")) +
        (mins && mins < 180 ? " " + esc(t("Updated {n} min ago.", { n: mins })) : "") + "</p>";
      box.hidden = false;
    }).catch(function () {});
  }

  window.MMEExtras = { knowCard: knowCard, knowLink: knowLink,
    Home: Home, homeCard: homeCard,
    eventBanner: eventBanner, eventsInfo: eventsInfo, whatsOnScreen: whatsOnScreen, routeEventNote: routeEventNote, EVENTS: EVENTS,
    cruise: cruise, shipPoint: shipPoint, cruiseCard: cruiseCard, cruiseScreen: cruiseScreen, mountHome: mountHome,
    offlineCard: offlineCard, mountOffline: mountOffline, tileUrls: tileUrls,
    Reports: Reports, reportBox: reportBox, routeReportNote: routeReportNote,
    yachtsBox: yachtsBox, mountYachts: mountYachts
  };
})();
