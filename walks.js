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
      photos: ["img/rock-palace-dusk.jpg", "img/cathedral.jpg"], portrait: true,
      stops: [
        { name: "Port Hercule", lat: D.places.port.lat, lng: D.places.port.lng, text: "Start by the harbour. The lifts in the Parking des Pêcheurs take you up the cliff, so there’s no long climb." },
        { name: "Oceanographic Museum", lat: 43.73103, lng: 7.42564, text: "Jacques Cousteau’s museum, built into the cliff edge. Its rooftop terrace has one of the best views in Monaco." },
        { name: "Saint-Martin Gardens", lat: 43.72983, lng: 7.42347, text: "Shady gardens along the cliff top, with benches and views out to sea." },
        { name: "Monaco Cathedral", lat: 43.73043, lng: 7.42273, text: "Monaco’s cathedral, where Princess Grace and Prince Rainier III are buried." },
        { name: "Prince's Palace", lat: 43.73131, lng: 7.42142, text: "The Changing of the Guard takes place in the palace square every day at 11:55. The square looks out over the harbour." },
        { name: "Back to Port Hercule", lat: D.places.port.lat, lng: D.places.port.lng, text: "Back down to the harbour the easy way." }
      ] },
    { id: "montecarlo", title: "Monte-Carlo and the Casino", sub: "From the harbour up to Casino Square, then on to the gardens and the beach",
      photos: ["img/mc-casino.jpg", "img/mc-garden-bridge.jpg"],
      stops: [
        { name: "Port Hercule", lat: D.places.port.lat, lng: D.places.port.lng, text: "Start by the harbour, where the superyachts moor." },
        { name: "Casino Square", lat: D.places.casino.lat, lng: D.places.casino.lng, text: "The Belle Époque Casino, the Hôtel de Paris and the Café de Paris around one famous square." },
        { name: "Japanese Garden", lat: 43.74237, lng: 7.43101, text: "A free, peaceful Japanese garden with ponds, a waterfall and a tea house." },
        { name: "Grimaldi Forum", lat: 43.74383, lng: 7.43192, text: "Monaco’s congress and exhibition centre, with a big exhibition every summer." },
        { name: "Larvotto Beach", lat: D.places.larvotto.lat, lng: D.places.larvotto.lng, text: "Monaco’s public beach, with a promenade, cafés and restaurants." }
      ] },
    { id: "gp", title: "The Grand Prix lap", sub: "Walk the Formula 1 circuit, from the starting grid all the way round to the finish line",
      photos: ["img/gp-1992.jpg"], photoCredit: "The Swimming Pool section at the 1992 Monaco Grand Prix. Photo: Nick Hutton",
      stops: [
        { name: "Start line", lat: 43.7350, lng: 7.4212, text: "The start and finish straight on Boulevard Albert 1er. On race day the grid lines up here, and the Prince watches from the royal box beside the finish line. In race weeks barriers go up and parts of this walk are closed, so check What’s on first." },
        { name: "Sainte-Dévote", lat: 43.7369, lng: 7.4217, text: "The first corner, a tight right-hander beside the little church of Monaco’s patron saint. With the whole field arriving at once, it’s where many first-lap accidents happen." },
        { name: "Beau Rivage", lat: 43.7374, lng: 7.4240, text: "The long climb up Avenue d’Ostende, taken flat out by the cars. On foot it’s a steady uphill walk. If you’d rather skip it, the public lifts by the Auditorium Rainier III on the harbour take you up to the Casino terraces." },
        { name: "Massenet", lat: 43.7385, lng: 7.4279, text: "A long, fast left-hander at the top of the hill, sweeping round towards Casino Square." },
        { name: "Casino Square", lat: 43.7394, lng: 7.4274, text: "The most glamorous corner in motor racing, between the Casino, the Hôtel de Paris and the Café de Paris. The cars crest a bump here and dive right, downhill." },
        { name: "Mirabeau", lat: 43.7403, lng: 7.4277, text: "A sharp right-hander at the bottom of the run down from the Casino, with the barriers just inches from the cars." },
        { name: "The Grand Hotel hairpin", lat: 43.7411, lng: 7.4287, text: "The slowest corner in Formula 1, taken at around 50 km/h, wrapped round the Fairmont hotel. One of the most photographed spots on the calendar: stand on the outside of the bend for the classic view." },
        { name: "Portier", lat: 43.7406, lng: 7.4304, text: "The right-hander that brings the cars down to the sea, just before the tunnel. Ayrton Senna crashed out here in 1988 while leading the race." },
        { name: "The tunnel", lat: 43.7383, lng: 7.4291, text: "The only covered section of any Formula 1 track. The drivers go through it flat out, at close to 290 km/h, and burst out of the dark into bright sunlight. You can walk it on the pavement beside the traffic: it’s noisy, so keep children close. It takes about 4 minutes, and you come out into daylight at the harbour, just as the drivers do." },
        { name: "Nouvelle Chicane", lat: 43.7378, lng: 7.4280, text: "The chicane at the tunnel exit, where the drivers brake hard from top speed. It’s one of the few real overtaking places in Monaco." },
        { name: "Tabac", lat: 43.7369, lng: 7.4237, text: "A fast left-hander along the harbour, named after the kiosk that once stood on the corner. The yachts are moored just feet away." },
        { name: "Swimming Pool", lat: 43.7350, lng: 7.4223, text: "A quick pair of chicanes around the Rainier III swimming pool, one of the most demanding sections of the lap. In winter the pool becomes an ice rink." },
        { name: "La Rascasse", lat: 43.73238, lng: 7.42298, text: "A tight right-hander round the famous Rascasse bar, one of the best places to watch the race." },
        { name: "Anthony Noghès", lat: 43.73286, lng: 7.42217, text: "The last corner, named after Antony Noghès, who organised the first Monaco Grand Prix in 1929." },
        { name: "Finish line", lat: 43.7350, lng: 7.4212, text: "You’re back where you started: one lap of the Monaco Grand Prix, about 3.3 km. In 1992 Nigel Mansell had the race won until a puncture sent him into the pits. Ayrton Senna swept into the lead, and Mansell, in a much faster car, hunted him down. For the last laps Senna made his car as wide as the narrow streets would allow and held on to win by two tenths of a second, one of the greatest finishes in Formula 1 history. Both men were exhausted: Senna could barely lift the trophy, and Mansell was close to collapse. Chequered flag!" }
      ] },
    { id: "seapath", title: "The sea path from Cap d’Ail", sub: "Our favourite walk: along the water from Mala beach to Monaco’s heliport", coast: true,
      photos: ["img/seapath-arch.jpg", "img/seapath-coast.jpg"],
      stops: [
        { name: "Plage de la Mala", lat: 43.72205, lng: 7.39085, text: "A small cove with clear water, below the villas of Cap d’Ail. There are steps down to the beach and the path. Cap d’Ail station is about 10 minutes’ walk away." },
        { name: "Pointe des Douaniers", lat: 43.71995, lng: 7.40465, text: "The path follows the rocks round the headland, with the sea right beside you and views back along the coast." },
        { name: "Plage Marquet", lat: 43.72395, lng: 7.41095, text: "A sandy beach in a sheltered bay, with a beach restaurant." },
        { name: "Port de Cap d’Ail", lat: 43.72602, lng: 7.41344, text: "Cap d’Ail’s marina, with cafés and restaurants on the quay." },
        { name: "Monaco Heliport", lat: 43.72634, lng: 7.41755, text: "You’re in Monaco. Fontvieille’s shops and restaurants are a few minutes further on." }
      ] },
    { id: "corbusier", title: "Promenade Le Corbusier", sub: "Round Cap Martin by the sea, from Roquebrune station to Carnolès", coast: true,
      photos: ["img/corbusier-waves.jpg", "img/corbusier-carnoles.jpg"],
      stops: [
        { name: "Roquebrune-Cap-Martin station", lat: 43.76073, lng: 7.45765, text: "Start at the station. The path begins just below it, by the sea." },
        { name: "Cap Moderne", lat: 43.75991, lng: 7.46317, text: "Le Corbusier’s Cabanon and Eileen Gray’s Villa E-1027 sit right beside the path. Visits are guided only and must be booked ahead." },
        { name: "La Dragonnière", lat: 43.75632, lng: 7.46896, text: "The path hugs the rocks round Cap Martin, with views back to Monaco." },
        { name: "Cap Martin point", lat: 43.75095, lng: 7.4772, text: "The tip of the cape, among pines and villas, looking out to sea." },
        { name: "Empress Elisabeth monument", lat: 43.75179, lng: 7.48637, text: "A monument to Empress Elisabeth of Austria, “Sissi”, who loved to stay on Cap Martin." },
        { name: "Carnolès seafront", lat: 43.7578, lng: 7.4818, text: "Finish by the beaches and cafés of Carnolès. Carnolès station is about 10 minutes’ walk inland." }
      ] }
  ];

  function legsFor(w) {
    var R = window.MMERouter, X = window.MMEExtras, wc = wheelchair();
    var blocked = X ? X.Reports.blockedPoints() : [];
    var legs = [];
    // Coastal paths have steps of their own, so follow the path rather than detouring by road to avoid them.
    for (var i = 1; i < w.stops.length; i++) legs.push(R ? R.route(w.stops[i - 1], w.stops[i], { avoidSteps: !w.coast, wheelchair: wc, blocked: blocked }) : null);
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
    return '<li><a class="walk-card wk-' + w.id + '" href="#/walk/' + w.id + '"><span class="wk-title">' + esc(t(w.title)) + "</span><span class=\"wk-sub\">" + esc(t(w.sub)) + "</span>" +
      (w.coast ? '<span class="wk-tag">' + esc(t("Coastal path, with some steps")) + "</span>" : "") +
      '<span class="wk-stops">' + w.stops.map(function (s) { return esc(t(s.name)); }).join(" · ") + "</span></a></li>";
  }
  function walksBlock() {
    var esc = ui().esc;
    return '<section class="block walks-block"><div class="block-head"><h2>' + esc(t("Walks")) + "</h2>" + (window.MMEPro ? window.MMEPro.badge() : "") + '</div><p class="block-lede">' + esc(t("Sightseeing walks that use the lifts, and two coastal walks right by the sea.")) + '</p><ul class="walk-list">' + WALKS.map(walkCard).join("") + "</ul></section>";
  }

  var walkScreen = {
    html: function (id) {
      var w = WALKS.filter(function (x) { return x.id === id; })[0], esc = ui().esc;
      if (!w) return '<section class="page"><h1>' + esc(t("Walks")) + '</h1><ul class="walk-list">' + WALKS.map(walkCard).join("") + "</ul></section>";
      if (window.MMEPro && !window.MMEPro.isPro()) return '<section class="plan walk"><a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Home")) + "</a><h1>" + esc(t(w.title)) + '</h1><p class="lede-dark">' + esc(t(w.sub)) + "</p>" + window.MMEPro.lockCard("Walks") + "</section>";
      return '<section class="plan walk"><a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Home")) + "</a>" +
        "<h1>" + esc(t(w.title)) + '</h1><p class="lede-dark">' + esc(t(w.sub)) + "</p>" +
        (w.photos ? '<div class="wk-photos wk-p' + w.photos.length + (w.coast || w.portrait ? " wk-portrait" : "") + '">' + w.photos.map(function (p) { return '<img src="' + p + '" alt="" loading="lazy">'; }).join("") + "</div>" : "") + (w.photoCredit ? '<p class="wk-credit">' + esc(t(w.photoCredit)) + "</p>" : "") +
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
        if (w.coast) h += '<aside class="note"><strong>' + esc(t("Good to know")) + "</strong><p>" + esc(t("This path is right by the sea, with uneven ground and some steps, so it isn’t suitable for wheelchairs or pushchairs. It can be closed in rough seas, so check the signs at each end. Wear good shoes and take water.")) + "</p></aside>";
        if (!s.ok && !w.coast) h += '<aside class="note"><p>' + esc(t("We couldn’t find a way between these two places without steps or escalators. A taxi is the easiest option.")) + "</p></aside>";
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
