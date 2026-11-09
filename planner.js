// "Where do you want to go?" From and To boxes with live search, and the plan screen.
// Search uses OpenStreetMap data through Photon (photon.komoot.io), which is free for light use.
// Before launch, swap SEARCH_URL for a provider with a proper free plan (e.g. Geoapify) and a key.
(function () {
  "use strict";
  var D = window.MME;
  var t = function (s, v) { return window.MMEI18N.t(s, v); };
  var SEARCH_URL = "https://photon.komoot.io/api/";
  var AREA = { minLng: 7.345, minLat: 43.708, maxLng: 7.535, maxLat: 43.815 }; // Èze to Menton and the Italian border, with the villages above
  var CENTRE = { lat: 43.7385, lng: 7.4240 };

  var state = { from: null, to: null }; // null "from" means "my location"
  // Travelling with a wheelchair or pushchair: remembered on this phone.
  function wheelchairOn() { try { return localStorage.getItem("mme-wheelchair") === "1"; } catch (e) { return false; } }
  function setWheelchair(on) { try { localStorage.setItem("mme-wheelchair", on ? "1" : "0"); } catch (e) {} }

  function ui() { return window.MMEUI; }
  function M() { return window.MMEMap; }
  function inArea(p) { return p.lat > AREA.minLat && p.lat < AREA.maxLat && p.lng > AREA.minLng && p.lng < AREA.maxLng; }

  // Our own places and lifts come first in suggestions.
  function localMatches(q) {
    q = q.toLowerCase();
    var out = [];
    Object.keys(D.places).forEach(function (id) {
      var p = D.places[id];
      if ((p.name + " " + p.short + " " + p.area + " " + t(p.name) + " " + t(p.short) + (id === "station" ? " train gare railway" : "")).toLowerCase().indexOf(q) !== -1) out.push({ label: p.name, sub: id === "station" ? t("We’ll pick the best exit for you") : t(p.area), lat: p.lat, lng: p.lng, kind: id === "station" ? "station" : "place", placeId: id });
    });
    Object.keys(EXTRA).forEach(function (id) {
      var p = EXTRA[id];
      if ((p.name + " " + p.short + " " + p.area + " " + t(p.name) + " " + t(p.short)).toLowerCase().indexOf(q) !== -1) out.push({ label: p.name, sub: t(p.area), lat: p.lat, lng: p.lng, kind: "place" });
    });
    D.lifts.forEach(function (l) {
      if ((l.name + " " + l.where).toLowerCase().indexOf(q) !== -1) out.push({ label: l.name, sub: l.where + ", " + l.area, lat: l.lat, lng: l.lng, kind: l.type });
    });
    return out.slice(0, 4);
  }

  var KIND_LABEL = { hotel: "Hotel", guest_house: "Guest house", apartment: "Apartments", hostel: "Hostel", restaurant: "Restaurant", cafe: "Café", bar: "Bar", pub: "Bar", fast_food: "Food", museum: "Museum", attraction: "Attraction", viewpoint: "Viewpoint", station: "Station", beach: "Beach", park: "Park", casino: "Casino", theatre: "Theatre", supermarket: "Shop", marina: "Marina", parking: "Car park", bus_stop: "Bus stop" };

  var lastController = null;
  function remoteMatches(q) {
    if (lastController) lastController.abort();
    lastController = window.AbortController ? new AbortController() : null;
    var url = SEARCH_URL + "?q=" + encodeURIComponent(q) + "&lat=" + CENTRE.lat + "&lon=" + CENTRE.lng + "&limit=10&bbox=" + [AREA.minLng, AREA.minLat, AREA.maxLng, AREA.maxLat].join(",");
    return fetch(url, lastController ? { signal: lastController.signal } : {}).then(function (r) { return r.ok ? r.json() : { features: [] }; }).then(function (j) {
      return (j.features || []).map(function (f) {
        var pr = f.properties || {}, c = f.geometry && f.geometry.coordinates || [];
        var street = [pr.housenumber, pr.street].filter(Boolean).join(" ");
        var name = pr.name || street;
        if (!name) return null;
        return { label: name, sub: [KIND_LABEL[pr.osm_value] ? t(KIND_LABEL[pr.osm_value]) : "", pr.name ? street : "", pr.city || pr.locality || ""].filter(Boolean).join(", "), lat: c[1], lng: c[0], kind: pr.osm_value || "place" };
      }).filter(function (x) { return x && inArea(x); });
    }).catch(function () { return []; });
  }

  // A location pasted in: a WhatsApp or Google Maps link, or plain "43.7391, 7.4272".
  function parseCoords(text) {
    var m = text.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) ||
            text.match(/[?&](?:q|query|ll|destination|daddr)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i) ||
            text.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
    if (!m) return null;
    var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: lat, lng: lng } : null;
  }

  // ---------- The planner box on the home screen ----------
  // Places outside the height chart (so not in data.js), for the Popular buttons and search.
  var EXTRA = {
    capdail: { name: "Port de Cap d’Ail", short: "Cap d’Ail", area: "Cap d’Ail (France)", lat: 43.72602, lng: 7.41344 },
    roquebrune: { name: "Roquebrune old village", short: "Roquebrune", area: "Roquebrune-Cap-Martin (France)", lat: 43.765206, lng: 7.459182 },
    capmartin: { name: "Parc du Cap-Martin", short: "Cap Martin", area: "Roquebrune-Cap-Martin (France)", lat: 43.755111, lng: 7.474712 },
    menton: { name: "Menton town centre", short: "Menton", area: "Menton (France)", lat: 43.77432, lng: 7.49952 },
    mentonold: { name: "Menton old town", short: "Menton old town", area: "Menton (France)", lat: 43.77640, lng: 7.50750 },
    mentonst: { name: "Menton station", short: "Menton station", area: "Menton (France)", lat: 43.774703, lng: 7.4931157 },
    garavan: { name: "Menton-Garavan", short: "Garavan", area: "Menton (France)", lat: 43.78400, lng: 7.51400 },
    ezevil: { name: "Èze village", short: "Èze", area: "Èze (France)", lat: 43.72820, lng: 7.36150 },
    ezemer: { name: "Èze-sur-Mer", short: "Èze-sur-Mer", area: "Èze (France)", lat: 43.72254, lng: 7.35674 },
    turbie: { name: "La Turbie", short: "La Turbie", area: "La Turbie (France)", lat: 43.74522, lng: 7.39976 },
    agnes: { name: "Sainte-Agnès village", short: "Sainte-Agnès", area: "Sainte-Agnès (France)", lat: 43.80041, lng: 7.46150 },
    gorbio: { name: "Gorbio village", short: "Gorbio", area: "Gorbio (France)", lat: 43.78664, lng: 7.44388 },
    castellar: { name: "Castellar village", short: "Castellar", area: "Castellar (France)", lat: 43.80413, lng: 7.49701 }
  };
  function place(id) { return D.places[id] || EXTRA[id]; }
  var POPULAR = ["casino", "palace", "port", "larvotto", "museum", "beausoleil", "fontvieille", "station", "exotic", "capdail", "roquebrune", "capmartin"];
  function shortName(id) { var s = place(id).short; return t(s === "Museum" ? "Oceanographic Museum" : s === "Palace" ? "Prince’s Palace" : s); }
  // Labels are stored in English (or as the place's own name) and translated when shown.
  function lbl(x) { return x ? t(x.label) : t("My location"); }

  function boxHtml() {
    var esc = ui().esc;
    function field(which, label, ph, val) {
      return '<div class="pl-field" data-field="' + which + '"><span class="pl-dot pl-' + which + '" aria-hidden="true"></span>' +
        '<label for="pl-' + which + '">' + esc(label) + "</label>" +
        '<input id="pl-' + which + '" type="search" autocomplete="off" enterkeyhint="search" placeholder="' + esc(ph) + '" value="' + (val ? esc(lbl(val)) : "") + '" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pl-' + which + '-list">' +
        '<ul class="pl-sugg" id="pl-' + which + '-list" role="listbox" hidden></ul></div>';
    }
    return '<div class="where planner"><p class="where-h">' + esc(t("Where do you want to go?")) + "</p>" +
      '<div class="pl-fields">' + field("from", t("From"), t("My location"), state.from) + field("to", t("To"), t("Hotel, restaurant, place or address"), state.to) + "</div>" +
      '<p class="pl-popular">' + esc(t("Popular:")) + '</p><div class="dests">' + POPULAR.map(function (id) {
        return '<button type="button" class="dest" data-to-place="' + id + '">' + esc(shortName(id)) + "</button>";
      }).join("") + "</div>" +
      '<p class="pl-err" id="pl-err" role="alert" hidden></p>' +
      '<button type="button" class="btn btn-red pl-go" id="pl-go">' + esc(t("Show me the easiest way")) + "</button>" +
      '<div class="meet"><button type="button" class="meet-btn" id="meet-open" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.8-3.4a3 3 0 0 0 0-1.6l6.8-3.4A3 3 0 1 0 15 7a3 3 0 0 0 .1.8L8.3 11.2a3 3 0 1 0 0 3.6l6.8 3.4A3 3 0 1 0 18 16z"/></svg><span><strong>' + esc(t("Meet me here")) + "</strong><small>" + esc(t("Send a friend your spot. The app shows them the easiest way to you.")) + "</small></span></button>" +
      '<div class="meet-panel" id="meet-panel" hidden><label for="meet-name">' + esc(t("Your name (optional)")) + '</label><input id="meet-name" autocomplete="given-name" placeholder="' + esc(t("e.g. Nick")) + '">' +
      '<button type="button" class="btn btn-white" id="meet-share">' + esc(t("Share my location")) + '</button><p class="meet-status" id="meet-status" role="status"></p></div></div>' +
      '<a class="near-link" href="#/map/near">' + esc(t("Or see the lifts near me on the map")) + "</a></div>";
  }

  function mountBox(root) {
    var box = root.querySelector(".planner");
    if (!box) return;
    var esc = ui().esc;
    ["from", "to"].forEach(function (which) {
      var input = box.querySelector("#pl-" + which), list = box.querySelector("#pl-" + which + "-list");
      var timer = null, items = [];
      function show(results) {
        items = results;
        if (which === "from") items = [{ label: "My location", sub: t("Use where I am now"), kind: "me" }].concat(items);
        list.innerHTML = items.map(function (it, i) {
          return '<li role="option" id="pl-' + which + "-o" + i + '" data-i="' + i + '"><strong>' + esc(t(it.label)) + "</strong>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</li>";
        }).join("") || '<li class="pl-none">' + esc(t("No matches in Monaco, Beausoleil, Cap d’Ail or Roquebrune-Cap-Martin yet.")) + "</li>";
        list.hidden = false; input.setAttribute("aria-expanded", "true");
      }
      function hide() { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
      input.addEventListener("input", function () {
        var q = input.value.trim();
        state[which] = null;
        clearTimeout(timer);
        if (q.length < 2) { if (which === "from") show([]); else hide(); return; }
        var pinned = parseCoords(q);
        if (pinned) {
          show([{ label: "Shared location", sub: (inArea(pinned) ? "" : t("Outside Monaco") + ", ") + pinned.lat.toFixed(5) + ", " + pinned.lng.toFixed(5), lat: pinned.lat, lng: pinned.lng, kind: "pin" }]);
          return;
        }
        var local = localMatches(q);
        show(local);
        timer = setTimeout(function () {
          remoteMatches(q).then(function (remote) {
            if (input.value.trim() !== q) return;
            var seen = {};
            show(local.concat(remote).filter(function (it) { var k = it.label.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 8));
          });
        }, 280);
      });
      input.addEventListener("focus", function () { if (which === "from" && !input.value) show(localMatches("").slice(0, 0)); });
      input.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); if (e.key === "Enter" && !list.hidden && items[0]) { e.preventDefault(); pick(0); } });
      input.addEventListener("blur", function () { setTimeout(hide, 180); });
      function pick(i) {
        var it = items[i];
        if (!it) return;
        if (it.kind === "me") { state.from = null; input.value = ""; input.placeholder = t("My location"); }
        else { state[which] = it; input.value = t(it.label); }
        hide();
      }
      list.addEventListener("mousedown", function (e) { e.preventDefault(); });
      list.addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (li) pick(+li.dataset.i); });
    });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-to-place]");
      if (b) {
        var p = place(b.dataset.toPlace);
        state.to = { label: p.name, sub: p.area, lat: p.lat, lng: p.lng, kind: "place", placeId: b.dataset.toPlace };
        box.querySelector("#pl-to").value = t(p.name);
        box.querySelectorAll("[data-to-place]").forEach(function (x) { x.classList.toggle("on", x === b); });
      }
    });
    var openBtn = box.querySelector("#meet-open"), panel = box.querySelector("#meet-panel");
    openBtn.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      openBtn.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) M().startLocating(function (msg) { box.querySelector("#meet-status").textContent = msg; });
    });
    box.querySelector("#meet-share").addEventListener("click", function () {
      var status = box.querySelector("#meet-status");
      var name = box.querySelector("#meet-name").value.trim();
      status.textContent = t("Finding where you are…");
      var done = false;
      var stop = M().onLocation(function (pos) {
        if (done) return; done = true; setTimeout(function () { stop(); }, 0);
        shareSpot(pos, name, status);
      });
    });
    box.querySelector("#pl-go").addEventListener("click", function () {
      var err = box.querySelector("#pl-err");
      if (!state.to) { err.textContent = box.querySelector("#pl-to").value.trim() ? t("Pick a place from the list as you type.") : t("Choose where you want to go."); err.hidden = false; return; }
      if (box.querySelector("#pl-from").value.trim() && !state.from) { err.textContent = t("Pick your starting point from the list, or clear the box to use your location."); err.hidden = false; return; }
      err.hidden = true;
      state.arrival = null;
      location.hash = "#/plan";
    });
  }

  // ---------- The plan screen ----------
  var avoidSteps = true;
  var KIND = { walk: "walk", lift: "lift", escalator: "escalator", steps: "steps" };
  // Route lines: a fine ivory edge under each, rounded ends. Navy for walking, Monaco red for lifts, champagne gold for
  // escalators, and a dotted amber for steps.
  var LINE = { walk: { color: "#0a1f3c", weight: 4.5 }, lift: { color: "#ce1126", weight: 6.5 }, escalator: { color: "#b8923f", weight: 6 }, steps: { color: "#b5542a", weight: 4.5, dashArray: "1 8" } };
  // All the ivory edges go down first, then the coloured lines, so the joins between sections stay unbroken.
  function drawRoute(lines, layer) {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    lines.forEach(function (ln) { var st = LINE[ln.kind] || LINE.walk; L.polyline(ln.pts, { color: dark ? "#18222e" : "#fffdf8", weight: st.weight + 5, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }).addTo(layer); });
    ["walk", "steps", "escalator", "lift"].forEach(function (k) {
      lines.forEach(function (ln) {
        if (ln.kind !== k) return;
        var st = LINE[k];
        L.polyline(ln.pts, { color: dark && k === "walk" ? "#e9edf2" : st.color, weight: st.weight, dashArray: st.dashArray, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }).addTo(layer);
      });
    });
  }
  // Where you catch the bus or train: a small dot in its colour with an ivory ring.
  function stopDot(p, fill, layer) {
    L.circleMarker([p.lat, p.lng], { radius: 7, color: "#fffdf8", weight: 3, fillColor: fill, fillOpacity: 1, interactive: false }).addTo(layer);
    L.circleMarker([p.lat, p.lng], { radius: 10.5, color: "#b8923f", weight: 1.2, fill: false, interactive: false }).addTo(layer);
  }
  var STEP_LABEL = { walk: "Walk", lift: "Lift", escalator: "Escalator", steps: "Steps", arrive: "Arrive" };

  function curatedFor(fromLbl, to) {
    // Extra tips we've written for popular journeys (e.g. Changing of the Guard).
    return D.routes.filter(function (r) { return to.placeId === r.to && (!state.from || state.from.placeId === r.from); })[0] || null;
  }

  var screen = {
    html: function () {
      var esc = ui().esc;
      if (!state.to) return '<section class="page"><h1>' + esc(t("Plan a route")) + '</h1><p class="lede-dark">' + esc(t("Choose where you want to go on the home screen.")) + '</p><p><a class="btn btn-red" href="#/">' + esc(t("Back to the start")) + "</a></p></section>";
      var fromLabel = lbl(state.from);
      return '<section class="plan">' +
        '<a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Change")) + "</a>" +
        '<ol class="pl-ends"><li><span class="pl-dot pl-from"></span><div><small>' + esc(t("From")) + '</small><strong id="plan-from">' + esc(fromLabel) + "</strong></div></li>" +
        '<li><span class="pl-dot pl-to"></span><div><small>' + esc(t("To")) + "</small><strong>" + esc(lbl(state.to)) + "</strong></div></li></ol>" +
        (state.leg && state.leg.stop === state.to ? '<div class="leg-banner"><p>' + esc(state.leg.then) + '</p><button type="button" class="btn-small" id="leg-back">' +
          esc(t("Back to all the ways to {place}", { place: lbl(state.leg.back) })) + "</button></div>" : "") +
        '<div class="map plan-map" id="plan-map"></div>' +
        '<div id="plan-body"><p class="lede-dark" role="status">' + esc(state.from ? t("Working out the easiest way…") : t("Finding where you are…")) + "</p></div></section>";
    },
    mount: function (root) {
      if (!state.to) return;
      var esc = ui().esc, icon = ui().icon;
      var map = M().makeMap(root.querySelector("#plan-map"), { zoom: 15 });
      var to = state.to, layer = L.layerGroup().addTo(map), fromPt = null;
      L.marker([to.lat, to.lng], { icon: L.divIcon({ className: "", html: '<span class="mk-end mk-to"></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map);

      var lastNote = null, blockedKey = "", tracked = false, voiceList = [];
      var replan = function () { location.replace(location.hash === "#/plan" ? "#/plan/" : "#/plan"); };
      var back0 = root.querySelector("#leg-back");
      if (back0) back0.addEventListener("click", function () { state.to = state.leg.back; state.leg = null; replan(); });
      root.addEventListener("click", function (e) {
        var b = e.target.closest(".leg-go");
        if (!b) return;
        var stop = { label: b.getAttribute("data-stop"), lat: +b.getAttribute("data-lat"), lng: +b.getAttribute("data-lng"), kind: "stop" };
        state.leg = { back: state.leg && state.leg.stop === state.to ? state.leg.back : state.to, stop: stop, then: b.getAttribute("data-then") };
        state.to = stop;
        if (window.MMEStats) window.MMEStats.track("Way to the stop");
        replan();
        window.scrollTo(0, 0);
      });
      function draw(from, note) {
        fromPt = from; lastNote = note;
        if (window.MMEEventDay) window.MMEEventDay.apply();   // event-day closures (Pro) for this route
        layer.clearLayers();
        var isStation = !!(from && from.kind === "station");
        var X = window.MMEExtras, blocked = X ? X.Reports.blockedPoints() : [];
        blockedKey = blocked.map(function (b) { return b.id; }).join(",");
        var wc = wheelchairOn();
        var R0 = window.MMERouter, exit0 = isStation && R0 ? R0.fromStation(to, { avoidSteps: avoidSteps, blocked: blocked, wheelchair: wc }, from) : null;
        if (exit0) from = { lat: exit0.exit.lat, lng: exit0.exit.lng };
        L.marker([from.lat, from.lng], { icon: L.divIcon({ className: "", html: '<span class="mk-end mk-from"></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(layer);
        var R = window.MMERouter, exit = null, r = null;
        if (R) {
          if (isStation) { var best = exit0; if (best) { exit = best.exit; r = best.r; } }
          else r = R.route(from, to, { avoidSteps: avoidSteps, blocked: blocked, wheelchair: wc });
        }
        var other = R && !exit && !wc ? R.route(from, to, { avoidSteps: !avoidSteps, blocked: blocked }) : null;
        // Which reported lifts would the usual route have used? Those are the ones we've steered round.
        var avoided = [];
        if (R && r && blocked.length) {
          var plain = exit ? R.route({ lat: exit.lat, lng: exit.lng }, to, { avoidSteps: avoidSteps, wheelchair: wc }) : R.route(from, to, { avoidSteps: avoidSteps, wheelchair: wc });
          if (plain) avoided = blocked.filter(function (b) {
            return plain.liftPts.some(function (pt) { return M().distance(pt, b) < 45; });
          });
        }
        var h = note ? '<p class="summary">' + note + "</p>" : "";
        if (window.MMEEventDay) h += window.MMEEventDay.routeNote();
        h += '<label class="wc-toggle"><input type="checkbox" id="wc-on"' + (wc ? " checked" : "") + '><span class="wc-sw" aria-hidden="true"></span><span>' + esc(t("Wheelchair or pushchair")) + "<small>" + esc(t("Lifts and level paths only: no steps or escalators")) + "</small></span></label>";
        var outside = r && (r.startGap > 300 || r.endGap > 300), opts = "";
        if (!r) {
          h += '<p class="summary">' + esc(wc ? t("We couldn’t find a way between these two places without steps or escalators. A taxi is the easiest option.") : t("We couldn’t find a walking route between these two places on our Monaco map.")) + "</p>";
          L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: "#0b2545", weight: 3, dashArray: "6 8" }).addTo(layer);
        } else {
          // Casings first, then the lines, so a lift or escalator always sits on top of the walk either side.
          drawRoute(r.lines, layer);
          if (r.startGap > 40) L.polyline([[from.lat, from.lng], r.start], { color: "#b8923f", weight: 3, dashArray: "1 7", lineCap: "round" }).addTo(layer);
          if (r.endGap > 40) L.polyline([r.end, [to.lat, to.lng]], { color: "#b8923f", weight: 3, dashArray: "1 7", lineCap: "round" }).addTo(layer);
          var vert = r.heights
            ? "<li><strong>" + esc(r.climbed < 5 ? t("Hardly any climb") : t("{n} m climb", { n: r.climbed })) + "</strong><span>" + esc(r.saved > 4 ? t("lifts do {n} m for you", { n: r.saved }) : r.lifts ? t(r.lifts === 1 ? "1 lift on the way" : "{n} lifts on the way", { n: r.lifts }) : t("on foot")) + "</span></li>"
            : "<li><strong>" + esc(t(r.lifts === 1 ? "1 lift" : "{n} lifts", { n: r.lifts })) + "</strong><span>" + esc(r.escalators ? t(r.escalators === 1 ? "and 1 escalator" : "and {n} escalators", { n: r.escalators }) : t("on the way")) + "</span></li>";
          var walkAt = h.length;
          h += '<ul class="facts"><li><strong>' + esc(t("{n} min", { n: r.minutes })) + "</strong><span>" + esc(t("{d} on foot", { d: r.metres >= 1000 ? (r.metres / 1000).toFixed(1) + " km" : r.metres + " m" })) + "</span></li>" +
            "<li><strong>" + esc(r.stepFree ? t("No steps") : t(r.steps === 1 ? "1 set of steps" : "{n} sets of steps", { n: r.steps })) + "</strong><span>" + esc(r.stepFree ? (wc ? t("no escalators") : r.escalators ? t("but uses escalators") : t("step-free")) : t("on this route")) + "</span></li>" + vert + "</ul>";
          if (wc) {
            // Say what the wheelchair setting changed compared with the usual route.
            var usual = isStation ? null : R.route(from, to, { avoidSteps: true, blocked: blocked });
            var diff = "";
            if (usual) {
              if (usual.steps && usual.escalators) diff = t("Compared with the usual route, this one avoids {s} sets of steps and {e} escalators.", { s: usual.steps, e: usual.escalators });
              else if (usual.escalators) diff = t(usual.escalators === 1 ? "Compared with the usual route, this one avoids an escalator." : "Compared with the usual route, this one avoids {e} escalators.", { e: usual.escalators });
              else if (usual.steps) diff = t(usual.steps === 1 ? "Compared with the usual route, this one avoids a set of steps." : "Compared with the usual route, this one avoids {s} sets of steps.", { s: usual.steps });
              else if (Math.abs(usual.metres - r.metres) > 30) diff = t("This route keeps to gentler slopes and lifts than the usual one.");
              else diff = t("The usual route here is already step-free with no escalators, so it’s the same.");
            }
            h += '<aside class="note note-wc"><strong>' + esc(t("Wheelchair or pushchair")) + "</strong><p>" + (diff ? esc(diff) + " " : "") + esc(t("Some of Monaco’s streets are steep even without steps. Lift access comes from OpenStreetMap and is being checked on the ground.")) + "</p></aside>";
          }
          if (other && Math.abs(other.minutes - r.minutes) >= 3 && other.steps !== r.steps) {
            h += avoidSteps
              ? '<button type="button" class="alt-btn" data-mode="steps">' + esc(t(other.steps === 1 ? "Happy with steps? There’s a quicker way: {m} min with 1 set of steps" : "Happy with steps? There’s a quicker way: {m} min with {n} sets of steps", { m: other.minutes, n: other.steps })) + "</button>"
              : '<button type="button" class="alt-btn" data-mode="easy">' + esc(t(other.stepFree ? "Show the easiest way instead: {m} min, no steps" : "Show the easiest way instead: {m} min", { m: other.minutes })) + "</button>";
          }
          var list = [];
          if (exit) list.push({ kind: "walk", text: t("Inside the station, follow the signs for the “{exit}” exit.", { exit: exit.name }) });
          if (r.startGap > 40) list.push({ kind: "walk", text: t("Walk about {n} m to the start of the route.", { n: Math.round(r.startGap / 10) * 10 }) });
          list = list.concat(r.directions);
          list.push({ kind: "arrive", text: (outside && r.endGap > 300 ? t("From here it’s about {n} min further, outside our mapped area.", { n: Math.round(r.endGap / 70) }) : t("Arrive at {place}.", { place: lbl(to) })), at: [to.lat, to.lng] });
          voiceList = list;
          h += '<h2 class="steps-h">' + esc(t("Step by step")) + "</h2>" + (Voice.ok() ? '<button type="button" class="voice-btn" id="voice-go"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>' + esc(t("Read the directions aloud")) + "</button>" : "") + '<ol class="steps">' + list.map(function (st) {
            var k = st.kind === "steps" ? "steps" : st.kind;
            return '<li class="step step-' + k + '"><span class="step-ico" style="--c:' + (k === "steps" ? "#d9480f" : ui().COLORS[k] || "#0b2545") + '">' + icon(k === "steps" ? "steps" : k) + "</span>" +
              '<div><span class="step-type">' + esc(t(STEP_LABEL[k] || "Arrive")) + "</span><p>" + esc(st.text) + "</p></div></li>";
          }).join("") + "</ol>";
          if (!r.stepFree) h += '<aside class="note"><strong>' + esc(t("Steps on this route")) + "</strong><p>" + esc(t("This is the easiest way we can find, but it still has some steps. A taxi may be easier with heavy bags.")) + "</p></aside>";
          if (outside) h += '<aside class="note"><strong>' + esc(t("Beyond our map")) + "</strong><p>" + esc(t("Part of this journey is outside the area we cover (from Èze to Menton and the villages above). Use Google Maps for that part.")) + "</p></aside>";
          var T = window.MMETransit, bus = T && T.ready ? T.busOption(from, to) : null;
          // "Show the way to the stop": opens the walk to where you catch it, with the rest of the journey kept at the top.
          var legBtn = function (pt, place, then) {
            return '<button type="button" class="btn btn-line leg-go" data-lat="' + pt.lat + '" data-lng="' + pt.lng + '" data-stop="' + esc(place) + '" data-then="' + esc(then) + '">' +
              esc(t("Show the way to {place}", { place: place })) + "</button>";
          };
          if (bus && (bus.minutes + 2 < r.minutes || (r.climbed > 30 && bus.minutes < r.minutes + 8) || (!r.stepFree && bus.minutes < r.minutes + 8))) {
            var now = T.monacoNow();
            var B_ = function (x) { return "<b>" + esc(x) + "</b>"; };
            opts += '<div class="bus-opt"><div class="bus-opt-top">' + T.badge(bus.p.r) + "<span>" + esc(t("Or take the bus: about {n} min in total", { n: bus.minutes })) + "</span></div>" +
              "<p>" + esc(t("Walk {a} min to {stop}.", { a: Math.max(1, bus.walkTo), stop: "\u0001" })).replace("\u0001", B_(T.stopName(bus.from))) + " " +
              esc(t("Next bus towards {dest} at {time} ({wait}).", { dest: bus.p.h, time: "\u0002", wait: bus.wait <= 0 ? t("now") : t("in {n} min", { n: bus.wait }) })).replace("\u0002", B_(T.hhmm(bus.dep))) + " " +
              esc(t("Ride {r} min to {stop}, then walk {w} min.", { r: bus.ride, stop: "\u0003", w: Math.max(1, bus.walkFrom) })).replace("\u0003", B_(T.stopName(bus.to))) + "</p>" +
              "<small>" + esc(now.ymd > window.MMEBus.valid[1] ? t("Times from the Monaco bus timetable (may have changed).") : t("Times from the Monaco bus timetable.")) + "</small>" +
              legBtn(T.stopPt(bus.from), T.stopName(bus.from), t("Then bus {r} at {time}, {ride} min to {stop}.", { r: window.MMEBus.routes[bus.p.r].n, time: T.hhmm(bus.dep), ride: bus.ride, stop: T.stopName(bus.to) })) + "</div>";
            var a = T.stopPt(bus.from), z = T.stopPt(bus.to);
            [a, z].forEach(function (p) { stopDot(p, window.MMEBus.routes[bus.p.r].c, layer); });
          }
          var cb = T && T.coastOption && r.minutes >= 20 ? T.coastOption(from, to) : null;
          if (cb && (cb.generic || cb.minutes + 5 < r.minutes || r.minutes >= 40)) {
            var Bc = function (x) { return "<b>" + esc(x) + "</b>"; };
            var L1 = cb.legs[0], L2 = cb.legs[1];
            var badgeOf = function (L) { return '<span class="bus-badge" style="background:' + L.c + ";color:" + (L.tc || "#fff") + '">' + esc(L.r) + "</span>"; };
            var nets = cb.legs.map(function (L) { return L.net; }).filter(function (n, k, a) { return n && a.indexOf(n) === k; }).join(" / ");
            var hasCam = cb.legs.some(function (L) { return !L.net; });
            var head = cb.generic ? t("Bus {r} towards {dest}", { r: L1.r, dest: L1.dest })
              : L2 ? t("Bus {r}, then bus {r2}: about {n} min door to door", { r: L1.r, r2: L2.r, n: cb.minutes })
              : t("Bus {r}: {ride} min to {stop}", { r: L1.r, ride: L1.arr - L1.dep, stop: L1.to });
            var body = esc(t("Walk {a} min to {stop}.", { a: Math.max(1, cb.walkTo), stop: "\u0001" })).replace("\u0001", Bc(L1.from)) + " ";
            var noneTonight = cb.generic && cb.known && cb.later == null;   // the timetable has nothing more today
            if (noneTonight) {
              head = t("No more {r} buses tonight", { r: L1.r });   // unless the live feed shows one coming (it replaces this card)
              body = esc(cb.last != null ? t("In the timetable, the last bus {r} from {stop} was at {time}.", { r: L1.r, stop: L1.from, time: T.hhmm(cb.last) }) : t("No bus {r} runs from {stop} for the rest of today.", { r: L1.r, stop: L1.from })) +
                (cb.first != null ? " " + esc(t("First bus tomorrow: {time}.", { time: T.hhmm(cb.first) })) : "");
            } else if (cb.generic && cb.later != null) {
              body += esc(t("Next bus {r} towards {dest} at {time}, {ride} min to {stop}.", { r: L1.r, dest: L1.dest, time: T.hhmm(cb.later), ride: L1.arr - L1.dep, stop: L1.to })) + " " + esc(t("Then walk {w} min.", { w: Math.max(1, cb.walkFrom) }));
            } else if (cb.generic) {
              body += esc(L1.r === "600" ? t("Buses run about every 15 minutes in the day (every 20 at weekends). Get off at {stop}, then walk {w} min.", { stop: "\u0003", w: Math.max(1, cb.walkFrom) })
                : t("There are no more buses on this line in the next couple of hours. Get off at {stop}, then walk {w} min.", { stop: "\u0003", w: Math.max(1, cb.walkFrom) })).replace("\u0003", Bc(L1.to));
            } else {
              body += esc(t("Bus {r} towards {dest} at {time} ({wait}), {ride} min to {stop}.", { r: L1.r, dest: L1.dest, time: "\u0002", wait: cb.wait <= 0 ? t("now") : t("in {n} min", { n: cb.wait }), ride: L1.arr - L1.dep, stop: "\u0003" }))
                .replace("\u0002", Bc(T.hhmm(L1.dep))).replace("\u0003", Bc(L1.to)) + " ";
              if (L2) body += esc(t("Change to bus {r} towards {dest} at {time}, {ride} min to {stop}.", { r: L2.r, dest: L2.dest, time: "\u0002", ride: L2.arr - L2.dep, stop: "\u0003" }))
                .replace("\u0002", Bc(T.hhmm(L2.dep))).replace("\u0003", Bc(L2.to)) + " ";
              body += esc(t("Then walk {w} min.", { w: Math.max(1, cb.walkFrom) }));
            }
            opts += '<div class="bus-opt cb-opt' + (noneTonight ? " tr-gone" : "") + '"' + (cb.generic && L1.net === "ZOU!" ? ' id="cb-live"' : "") + '><div class="bus-opt-top">' + badgeOf(L1) + (L2 ? badgeOf(L2) : "") + "<span>" + esc(head) + "</span></div><p>" + body + "</p>" +
              (!cb.generic && (cb.hurry || cb.after) ? '<p class="opt-more">' + esc([cb.hurry ? t("If you hurry: {time}", { time: T.hhmm(cb.hurry) }) : "", cb.after ? t("The one after: {time}", { time: T.hhmm(cb.after) }) : ""].filter(Boolean).join(" · ")) + "</p>" : "") +
              "<small>" + esc((cb.generic ? "" : t("About {n} min door to door, including the walks and the wait for the bus.", { n: cb.minutes }) + " ") + t("{net} timetable. Live times are in the {net} app. Pay on board.", { net: nets }) + (hasCam ? " " + t("Monaco city buses: CAM timetable.") : "")) + "</small>" +
              (noneTonight ? "" : legBtn(L1.fromPt, L1.from, cb.generic ? t("Then bus {r} towards {dest}, to {stop}.", { r: L1.r, dest: L1.dest, stop: L1.to }) : t("Then bus {r} at {time}, {ride} min to {stop}.", { r: L1.r, time: T.hhmm(L1.dep), ride: L1.arr - L1.dep, stop: L1.to }))) + "</div>";
            cb.legs.forEach(function (Lg) { [Lg.fromPt, Lg.toPt].forEach(function (pt) { stopDot(pt, Lg.c, layer); }); });
          }
          var tr = T && T.trainOption && r.minutes >= 25 ? T.trainOption(from, to) : null;
          // Towards Nice the published 600 timetable is thin, so leave a slot for the next live 600 (filled in after the page draws).
          if (r.minutes >= 20 && to.lng < from.lng - 0.01 && !(cb && cb.generic && cb.legs[0].net === "ZOU!") && T && T.coastLive) opts += '<div class="bus-opt cb-opt" id="cb-live" hidden></div>';
          var busBest = cb && !cb.generic ? cb.minutes : null;
          if (tr && tr.wait > 120) tr = null;   // the next train is hours away (overnight): the "no more trains tonight" card says so instead
          if (tr && (tr.minutes + 5 < r.minutes || r.minutes >= 40) && tr.walkTo + tr.walkFrom <= 45 && !(busBest !== null && tr.minutes > busBest + 30)) {
            var Bt = function (x) { return "<b>" + esc(x) + "</b>"; };
            opts += '<div class="bus-opt tr-opt"><div class="bus-opt-top"><span class="bus-badge" style="background:#0b2545;color:#fff">' + esc(t("Train")) + "</span><span>" + esc(t("Train: {r} min to {stop}", { r: tr.ride, stop: t(tr.to) })) + "</span></div>" +
              "<p>" + esc(t("Walk {a} min to {stop}.", { a: Math.max(1, tr.walkTo), stop: "\u0001" })).replace("\u0001", Bt(t(tr.from))) + " " +
              esc(t("Train at {time} ({wait}), {r} min to {stop}, then walk {w} min.", { time: "\u0002", wait: tr.wait <= 0 ? t("now") : t("in {n} min", { n: tr.wait }), r: tr.ride, stop: "\u0003", w: Math.max(1, tr.walkFrom) })).replace("\u0002", Bt(T.hhmm(tr.dep))).replace("\u0003", Bt(t(tr.to))) + "</p>" +
              (tr.hurry != null || tr.after != null ? '<p class="opt-more">' + esc([tr.hurry != null ? t("If you hurry: {time}", { time: T.hhmm(tr.hurry) }) : "", tr.after != null ? t("The one after: {time}", { time: T.hhmm(tr.after) }) : ""].filter(Boolean).join(" · ")) + "</p>" : "") +
              "<small>" + esc(t("About {n} min door to door, including the walks and the wait for the train.", { n: tr.minutes })) + " " + esc(t("Planned SNCF timetable. Check the SNCF Connect app for delays.")) + "</small>" +
              legBtn(tr.fromPt, t(tr.from), t("Then the train at {time}, {r} min to {stop}.", { time: T.hhmm(tr.dep), r: tr.ride, stop: t(tr.to) })) + "</div>";
            [tr.fromPt, tr.toPt].forEach(function (p) { stopDot(p, "#0a1f3c", layer); });
          }
          // No train left tonight on a journey trains usually serve: say so, rather than leaving people wondering.
          if (!(tr && (tr.minutes + 5 < r.minutes || r.minutes >= 40)) && r.minutes >= 25 && T && T.trainsGone) {
            var gone = T.trainsGone(from, to);
            if (gone) opts += '<div class="bus-opt tr-opt tr-gone"><div class="bus-opt-top"><span class="bus-badge" style="background:#0b2545;color:#fff">' + esc(t("Train")) + "</span><span>" + esc(t(gone.noneToday ? "No trains today" : "No more trains tonight")) + "</span></div><p>" +
              (gone.noneToday ? esc(t("SNCF has no trains planned today, which usually means engineering works or a strike.")) : esc(t("The last train from {st} left at {t}.", { st: t(gone.from), t: T.hhmm(gone.last) }))) + " " + esc(gone.first != null ? t("First train tomorrow: {t}.", { t: T.hhmm(gone.first) }) : t("SNCF has no trains planned on this line tomorrow, which usually means engineering works or a strike. Check the SNCF Connect app for replacement buses.")) + "</p></div>";
          }
          // Long journeys: lead with the train, bus and taxi, and put the walk last.
          if (r.minutes >= 40) {
            if (opts && window.MMEGetHome) opts += '<a class="gh-link" href="#/get-home">' + icon("clock") + "<span><strong>" + esc(t("Countdown to your train home")) + "</strong><small>" +
              esc(t("When to leave, and the last train or bus tonight")) + "</small></span>" + (window.MMEPro && !window.MMEPro.isPro() ? window.MMEPro.badge() : "") + "</a>";
            opts += '<div class="bus-opt tx-opt"><div class="bus-opt-top"><span class="bus-badge" style="background:#5b4b8a;color:#fff">' + esc(t("Taxi")) + "</span><span>" + esc(t("Or take a taxi")) + "</span></div><p>" +
              esc(t("The easiest way with bags. Monaco taxis can take you anywhere but only pick up in Monaco; in France, book a local taxi.")) + ' <a href="#/taxis">' + esc(t("Taxi numbers and ranks")) + "</a></p>" +
              (function () {   // the nearest Monaco taxi rank, when you're in Monaco
                if (!T || !T.ranks || !T.inMonaco(from)) return "";
                var best = null;
                T.ranks().forEach(function (k) { var d = M().distance(from, { lat: k[1], lng: k[2] }); if (!best || d < best.d) best = { k: k, d: d }; });
                return best ? legBtn({ lat: best.k[1], lng: best.k[2] }, t(best.k[0]), t("Then a taxi to {place}.", { place: lbl(to) })) : "";
              })() + "</div>";
            h = h.slice(0, walkAt) + (opts ? '<h2 class="steps-h">' + esc(t("Best ways to get there")) + "</h2>" + opts : "") +
              '<h2 class="steps-h">' + esc(t("Or walk all the way")) + "</h2>" + h.slice(walkAt);
          } else h += opts;
          if (X) h = X.routeReportNote(avoided) + X.routeEventNote(r) + h;
          if (state.arrival) h = '<aside class="note note-welcome"><strong>' + esc(t("Welcome to Monaco")) + "</strong><p>" + esc(t(arrivalTip())) + (r.minutes > 20 || !r.stepFree ? " " + esc(t("With heavy bags, a taxi may be easier for this one.")) : "") + "</p>" + (state.arrival === "ship" ? '<a class="btn btn-navy ship-link" href="#/cruise">' + esc(t("Set your all-aboard time")) + "</a>" : "") + "</aside>" + h;
          var cur = curatedFor(state.from, to);
          if (cur && cur.tip) h += '<aside class="note"><strong>' + esc(t("Tip")) + "</strong><p>" + esc(t(cur.tip)) + "</p></aside>";
          var b = L.latLngBounds([[from.lat, from.lng], [to.lat, to.lng]]);
          r.lines.forEach(function (ln) { ln.pts.forEach(function (p) { b.extend(p); }); });
          map.fitBounds(b.pad(0.12));
        }
        var canSave = window.MMEExtras && to.kind !== "ship" && to.kind !== "home" && !window.MMEExtras.Home.is(to);
        h += '<div class="actions">' + (canSave ? '<button type="button" class="btn btn-line save-home" id="save-home">' + esc(t("Save as where I’m staying")) + "</button>" : "") + '<a class="btn btn-line" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=' + from.lat + "," + from.lng + "&destination=" + to.lat + "," + to.lng + '">' + esc(t("Compare in Google Maps")) + "</a></div>" +
          '<div class="route-fb" id="route-fb"><span>' + esc(t("Was this route right?")) + '</span><button type="button" class="btn-small" data-fb="yes">' + esc(t("Yes")) + '</button><button type="button" class="btn-small" data-fb="no">' + esc(t("No")) + "</button></div>" +
          '<p class="unchecked">' + esc(t("Routes are worked out from OpenStreetMap. Lifts can be closed for repairs, so follow the blue “Ascenseur public” signs on the day.")) + "</p>";
        var body = root.querySelector("#plan-body");
        Voice.stop();
        body.innerHTML = h;
        // Coastal bus towards Nice: swap the "how often" card for the next live bus when the ZOU! feed has one.
        var liveCard = body.querySelector("#cb-live");
        if (liveCard && window.MMETransit && window.MMETransit.coastLive) window.MMETransit.coastLive(from, to, function (lv) {
          if (!lv || !liveCard.isConnected) return;
          liveCard.hidden = false;
          liveCard.classList.remove("tr-gone");
          var firstBus = body.querySelector(".cb-opt");   // a live bus goes to the top of the list
          if (firstBus && firstBus !== liveCard) firstBus.parentNode.insertBefore(liveCard, firstBus);
          var Bl = function (x) { return "<b>" + esc(x) + "</b>"; }, TT = window.MMETransit;
          liveCard.innerHTML = '<div class="bus-opt-top"><span class="bus-badge" style="background:#E47F0B;color:#fff">' + esc(lv.r) + "</span><span>" +
            esc(t("Bus {r}: {ride} min to {stop}", { r: lv.r, ride: lv.ride, stop: lv.to })) + ' <span class="live-dot">' + esc(t("Live")) + "</span></span></div><p>" +
            esc(t("Walk {a} min to {stop}.", { a: Math.max(1, lv.walkTo), stop: "\u0001" })).replace("\u0001", Bl(lv.from)) + " " +
            esc(t("Bus {r} towards {dest} at {time} ({wait}), {ride} min to {stop}.", { r: lv.r, dest: to.lng < from.lng ? "Nice" : "Menton", time: "\u0002", wait: lv.wait <= 0 ? t("now") : t("in {n} min", { n: lv.wait }), ride: lv.ride, stop: "\u0003" }))
              .replace("\u0002", Bl(TT.hhmm(lv.dep))).replace("\u0003", Bl(lv.to)) + " " + esc(t("Then walk {w} min.", { w: Math.max(1, lv.walkFrom) })) + "</p><small>" +
            esc(t("About {n} min door to door, including the walks and the wait for the bus.", { n: lv.minutes }) + " " + t("Live time from ZOU!. Pay on board.")) + "</small>" +
            (typeof legBtn === "function" ? legBtn(lv.fromPt, lv.from, t("Then bus {r} at {time}, {ride} min to {stop}.", { r: lv.r, time: TT.hhmm(lv.dep), ride: lv.ride, stop: lv.to })) : "");
        });
        var vg = body.querySelector("#voice-go");
        if (vg) vg.addEventListener("click", function () { Voice.start(voiceList, body.querySelector("ol.steps")); });
        if (r && window.MMEPro) window.MMEPro.tipAfterRoute(body);
        var wcBox = body.querySelector("#wc-on");
        if (wcBox) wcBox.addEventListener("change", function () { setWheelchair(wcBox.checked); avoidSteps = true; draw0(fromPt, lastNote); });
        if (!tracked) { tracked = true; if (r && window.MMEInstall && window.MMEInstall.routeUsed) window.MMEInstall.routeUsed(); if (window.MMEStats) window.MMEStats.track("Route planned", { wheelchair: wc ? "yes" : "no", found: r ? "yes" : "no" }); }
        // "Was this route right?" A "No" opens an email to us with the route details filled in.
        var fb = body.querySelector("#route-fb");
        if (fb) fb.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-fb]");
          if (!btn) return;
          var ans = btn.dataset.fb;
          if (window.MMEStats) window.MMEStats.track("Route feedback", { answer: ans });
          if (ans === "no") {
            var lines = [t("What was wrong? You can write in any language."), "", "", "", "---",
              "From: " + lbl(state.from) + " (" + from.lat.toFixed(5) + ", " + from.lng.toFixed(5) + ")",
              "To: " + lbl(to) + " (" + to.lat.toFixed(5) + ", " + to.lng.toFixed(5) + ")",
              r ? "Route: " + r.minutes + " min, " + r.metres + " m, " + r.lifts + " lifts, " + r.escalators + " escalators, " + r.steps + " sets of steps" : "Route: none found",
              "Wheelchair mode: " + (wc ? "on" : "off") + " · Language: " + window.MMEI18N.lang(),
              "Streets: " + (r && r.streets ? r.streets.slice(0, 8).join(", ") : "")];
            location.href = "mailto:hello@monacomadeeasy.com?subject=" + encodeURIComponent("Route feedback: " + lbl(to)) + "&body=" + encodeURIComponent(lines.join("\n"));
          }
          fb.innerHTML = "<span>" + esc(t("Thanks for letting us know.")) + "</span>";
        });
        var sh = body.querySelector("#save-home");
        if (sh) sh.addEventListener("click", function () {
          window.MMEExtras.Home.set(to);
          var ok = document.createElement("p"); ok.className = "off-ok"; ok.setAttribute("role", "status");
          ok.textContent = t("Saved. Tap “Back to {name}” on the home screen any time.", { name: lbl(to) });
          sh.replaceWith(ok);
        });
        var alt = body.querySelector(".alt-btn");
        if (alt) alt.addEventListener("click", function () { avoidSteps = alt.dataset.mode === "easy"; draw0(fromPt, note); });
        if (!r) map.fitBounds(L.latLngBounds([[from.lat, from.lng], [to.lat, to.lng]]).pad(0.3));
      }

      // Lift reports can arrive after the route is drawn (slow signal): redraw if they change it.
      function onReports() {
        if (!document.body.contains(root)) { window.removeEventListener("mme-reports", onReports); return; }
        var X = window.MMEExtras, key = X ? X.Reports.blockedPoints().map(function (b) { return b.id; }).join(",") : "";
        if (fromPt && key !== blockedKey) draw0(fromPt, lastNote);
      }
      window.addEventListener("mme-reports", onReports);
      avoidSteps = true;
      var heightsReady = window.MMERouter ? window.MMERouter.ready : Promise.resolve(false);
      var draw0 = draw;
      draw = function (f, n) { heightsReady.then(function () { draw0(f, n); }); };
      if (state.from) draw(state.from);
      else {
        // Start from Monaco station when we can't use where you are (too far away, no fix yet, or no signal),
        // and switch to your real position if a fix inside the area arrives afterwards.
        var fromStation = false, slow = null;
        function stationStart(note) {
          if (fromPt && !fromStation) return;
          fromStation = true;
          root.querySelector("#plan-from").textContent = t("Monaco station (you’re not in Monaco yet)");
          state.from = { label: "Monaco Monte-Carlo station", lat: D.places.station.lat, lng: D.places.station.lng, kind: "station" };
          draw(state.from, esc(note));
          state.from = null;
        }
        M().startLocating(function (msg, code) {
          if (fromPt && !fromStation) return;
          if (code === 1) { clearTimeout(slow); stationStart(t("Location is switched off for this app, so we’ve started from Monaco station. Turn it on in your phone’s settings, or tap Change to pick your starting point.")); return; }
          stationStart(t("We couldn’t find where you are just now, so we’ve started from Monaco station. Tap Change to pick your starting point."));
        });
        slow = setTimeout(function () {
          if (!fromPt && document.body.contains(root)) stationStart(t("Still finding where you are, so for now we’ve started from Monaco station. The route will update when your phone finds you."));
        }, 8000);
        var done = false;
        var stop = M().onLocation(function (pos) {
          if (done) return;
          if (!inArea(pos)) {
            done = true; clearTimeout(slow); setTimeout(function () { stop(); }, 0);
            stationStart(t("You’re not on this stretch of coast right now (Èze to Menton), so we’ve started from Monaco station. When you’re here, we’ll use where you are."));
            return;
          }
          done = true; clearTimeout(slow); setTimeout(function () { stop(); }, 0);
          fromStation = false;
          root.querySelector("#plan-from").textContent = t("My location");
          draw(pos);
        });
      }
      // A blue dot that follows you along the route (only when you're in Monaco, Beausoleil or Cap d'Ail).
      M().startLocating(function () {});
      var meMk = null;
      var stopMe = M().onLocation(function (p) {
        if (!document.body.contains(root)) { setTimeout(function () { stopMe(); }, 0); return; }
        if (!inArea(p)) return;
        if (!meMk) meMk = L.marker([p.lat, p.lng], { icon: M().meIcon, interactive: false, zIndexOffset: 1000 }).addTo(map);
        else meMk.setLatLng([p.lat, p.lng]);
      });
      setTimeout(function () { map.invalidateSize(); }, 50);
    }
  };

  // ---------- Just arrived ----------
  var ARRIVALS = [
    { id: "train", label: "By train", sub: "Monaco Monte-Carlo station", tip: "Monaco’s station is underground, with exits that come out at different heights. Using the right exit can save you a climb, so we’ve picked the best one for you." },
    { id: "bus", label: "By bus from Nice airport", sub: "ZOU! line 80, we’ll start from where you get off", tip: "The ZOU! 80 airport bus stops at Place d’Armes, the Casino and Larvotto. We’ve started from where you are now." },
    { id: "ship", label: "From a cruise ship", sub: "Port Hercule", tip: "Cruise passengers come ashore at Port Hercule, right in the middle of Monaco. We’ve started from where you are now." },
    { id: "heli", label: "By helicopter", sub: "Monaco Heliport, Fontvieille", tip: "The heliport is in Fontvieille, at the far western edge of Monaco. With luggage, most people take a taxi or a hotel car from here." },
    { id: "car", label: "By car or taxi", sub: "Being dropped off", tip: "Give your driver the full address. Once you’re dropped off, this shows the last bit on foot." }
  ];
  var HELIPORT = { label: "Monaco Heliport", lat: 43.7254, lng: 7.4195, kind: "place" }; // approximate

  var arriveScreen = {
    html: function () {
      var esc = ui().esc;
      return '<section class="arrive"><a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Home")) + "</a>" +
        "<h1>" + esc(t("Welcome to Monaco")) + '</h1><p class="lede-dark">' + esc(t("Two quick questions, and we’ll show you the easiest way to where you’re staying, with as few steps as possible.")) + "</p>" +
        '<a class="ar-airport" href="#/airport">' + esc(t("Still at Nice airport? See the best way to Monaco")) + "</a>" +
        '<fieldset class="ar-q"><legend>' + esc(t("How did you arrive?")) + '</legend><div class="ar-opts">' + ARRIVALS.map(function (a, i) {
          return '<label class="ar-opt"><input type="radio" name="arrival" value="' + a.id + '"' + (i === 0 ? " checked" : "") + '><span><strong>' + esc(t(a.label)) + "</strong><small>" + esc(t(a.sub)) + "</small></span></label>";
        }).join("") + "</div></fieldset>" +
        '<div class="ar-q"><label class="ar-legend" for="ar-stay">' + esc(t("Where are you staying?")) + "</label>" +
        '<div class="ar-search"><input id="ar-stay" type="search" autocomplete="off" placeholder="' + esc(t("Hotel name or address")) + '" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ar-list"><ul class="pl-sugg" id="ar-list" role="listbox" hidden></ul></div>' +
        '<p class="ar-hint">' + esc(t("Type the hotel name or the apartment address from your booking. You can also paste the location link your host sent you.")) + "</p></div>" +
        '<label class="wc-toggle wc-arrive"><input type="checkbox" id="ar-wc"' + (wheelchairOn() ? " checked" : "") + '><span class="wc-sw" aria-hidden="true"></span><span>' + esc(t("Travelling with a wheelchair or pushchair?")) + "<small>" + esc(t("We’ll only use lifts and level paths.")) + "</small></span></label>" +
        '<p class="form-err" id="ar-err" role="alert" hidden></p>' +
        '<button type="button" class="btn btn-red ar-go" id="ar-go">' + esc(t("Show me the way")) + "</button></section>";
    },
    mount: function (root) {
      var esc = ui().esc, input = root.querySelector("#ar-stay"), list = root.querySelector("#ar-list"), items = [], picked = null, timer = null;
      function show(res) {
        items = res;
        list.innerHTML = res.map(function (it, i) { return '<li role="option" data-i="' + i + '"><strong>' + esc(t(it.label)) + "</strong>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</li>"; }).join("") || '<li class="pl-none">' + esc(t("No matches in Monaco, Beausoleil, Cap d’Ail or Roquebrune-Cap-Martin yet.")) + "</li>";
        list.hidden = false; input.setAttribute("aria-expanded", "true");
      }
      function hide() { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
      input.addEventListener("input", function () {
        var q = input.value.trim(); picked = null; clearTimeout(timer);
        if (q.length < 2) { hide(); return; }
        var pin = parseCoords(q);
        if (pin) { show([{ label: "Your accommodation", sub: pin.lat.toFixed(5) + ", " + pin.lng.toFixed(5), lat: pin.lat, lng: pin.lng, kind: "pin" }]); return; }
        timer = setTimeout(function () { remoteMatches(q).then(function (r) { if (input.value.trim() === q) show(localMatches(q).concat(r).slice(0, 8)); }); }, 280);
      });
      input.addEventListener("blur", function () { setTimeout(hide, 180); });
      list.addEventListener("mousedown", function (e) { e.preventDefault(); });
      list.addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (!li) return; picked = items[+li.dataset.i]; input.value = t(picked.label); hide(); });
      root.querySelector("#ar-go").addEventListener("click", function () {
        var err = root.querySelector("#ar-err");
        if (!picked) { err.textContent = input.value.trim() ? t("Pick your accommodation from the list as you type.") : t("Tell us where you’re staying."); err.hidden = false; return; }
        var how = root.querySelector("input[name=arrival]:checked").value;
        setWheelchair(root.querySelector("#ar-wc").checked);
        if (window.MMEStats) window.MMEStats.track("Just arrived", { how: how });
        state.to = picked;
        state.arrival = how;
        if (window.MMEExtras) window.MMEExtras.Home.set(picked);
        state.from = how === "train" ? { label: "Monaco Monte-Carlo station", lat: D.places.station.lat, lng: D.places.station.lng, kind: "station" }
          : how === "heli" ? HELIPORT : null;
        location.hash = "#/plan";
      });
    }
  };
  function arrivalTip() { var a = ARRIVALS.filter(function (x) { return x.id === state.arrival; })[0]; return a ? a.tip : ""; }

  // ---------- Meet me here ----------
  // The link carries just the name, so your friend sees "Meet Nick here" in their own language.
  function spotLink(pos, name) {
    return location.origin + location.pathname + "#/to?" + (name ? "who=" + encodeURIComponent(name) + "&" : "") + "lat=" + pos.lat.toFixed(6) + "&lng=" + pos.lng.toFixed(6);
  }
  function shareSpot(pos, name, status) {
    var url = spotLink(pos, name);
    if (window.MMEStats) window.MMEStats.track("Meet me here shared");
    var text = name ? t("{name} is here. Tap for the easiest way, using Monaco’s free lifts and escalators:", { name: name }) : t("Meet me here. Tap for the easiest way, using Monaco’s free lifts and escalators:");
    var note = pos.acc > 40 ? " " + t("Your location is only accurate to about {n} m, so you may want to add a landmark.", { n: Math.round(pos.acc) }) : "";
    if (navigator.share) {
      navigator.share({ title: t("Meet me here"), text: text, url: url }).then(function () { status.textContent = t("Sent.") + note; })
        .catch(function () { status.textContent = ""; });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + " " + url).then(function () { status.textContent = t("Link copied. Paste it into WhatsApp or a text.") + note; });
    } else {
      status.textContent = url;
    }
  }

  // A shared "meet me here" link: set the destination and plan from wherever the friend is.
  function toLink(hash) {
    var q = params(hash);
    var lat = parseFloat(q.lat), lng = parseFloat(q.lng);
    if (!isFinite(lat) || !isFinite(lng)) return false;
    state.to = { label: q.who ? t("Meet {name} here", { name: q.who }) : (q.name || t("Meeting point")), lat: lat, lng: lng, kind: "meet" };
    state.arrival = null;
    state.from = null;
    return true;
  }
  function params(hash) {
    return (hash.split("?")[1] || "").split("&").reduce(function (o, kv) { var p = kv.split("="); if (p[0]) o[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || "").replace(/\+/g, " ")); return o; }, {});
  }

  // Partner QR codes open the app with "From" already set, e.g.
  // #/from?name=H%C3%B4tel%20Example&lat=43.7391&lng=7.4272
  function fromLink(hash) {
    var q = params(hash);
    var lat = parseFloat(q.lat), lng = parseFloat(q.lng);
    if (q.name && isFinite(lat) && isFinite(lng)) {
      state.from = { label: q.name, lat: lat, lng: lng, kind: "partner" };
      // Lets you tell a hotel how many guests used its card.
      if (window.MMEStats) window.MMEStats.track("Hotel QR opened", { place: q.name.slice(0, 60), ref: (q.ref || "link").slice(0, 20) });
    }
  }

  function placeRef(id) { var p = D.places[id]; return { label: p.name, sub: p.area, lat: p.lat, lng: p.lng, kind: id === "station" ? "station" : "place", placeId: id }; }
  function go(routeId) {
    var r = D.routes.filter(function (x) { return x.id === routeId; })[0];
    if (!r) return false;
    state.from = placeRef(r.from); state.to = placeRef(r.to); state.arrival = null;
    return true;
  }

  function homeRoute() {
    var h = window.MMEExtras && window.MMEExtras.Home.get();
    if (!h) return false;
    state.to = h; state.from = null; state.arrival = null; return true;
  }
  function shipRoute() {
    var c = window.MMEExtras && window.MMEExtras.cruise();
    if (!c) return false;
    state.to = window.MMEExtras.shipPoint(c); state.from = null; state.arrival = null; return true;
  }

  // ---------- Where I'm staying (for "Back to …" on the home screen) ----------
  var stayScreen = {
    html: function () {
      var esc = ui().esc;
      return '<section class="arrive"><a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>' + esc(t("Home")) + "</a>" +
        "<h1>" + esc(t("Where are you staying?")) + '</h1><p class="lede-dark">' + esc(t("Save it once, then one tap gets you back from anywhere.")) + "</p>" +
        '<div class="ar-q"><div class="ar-search"><input id="st-stay" type="search" autocomplete="off" placeholder="' + esc(t("Hotel name or address")) + '" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="st-list"><ul class="pl-sugg" id="st-list" role="listbox" hidden></ul></div>' +
        '<p class="ar-hint">' + esc(t("Type the hotel name or the apartment address from your booking. You can also paste the location link your host sent you.")) + "</p></div>" +
        '<p class="form-err" id="st-err" role="alert" hidden></p>' +
        '<button type="button" class="btn btn-red ar-go" id="st-go">' + esc(t("Save")) + "</button>" +
        '<button type="button" class="btn btn-line st-here" id="st-here">' + esc(t("I’m there now: use where I am")) + "</button></section>";
    },
    mount: function (root) {
      var esc = ui().esc, input = root.querySelector("#st-stay"), list = root.querySelector("#st-list"), items = [], picked = null, timer = null;
      var cur = window.MMEExtras && window.MMEExtras.Home.get();
      if (cur) input.value = t(cur.label);
      function show(res) {
        items = res;
        list.innerHTML = res.map(function (it, i) { return '<li role="option" data-i="' + i + '"><strong>' + esc(t(it.label)) + "</strong>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</li>"; }).join("") || '<li class="pl-none">' + esc(t("No matches in Monaco, Beausoleil, Cap d’Ail or Roquebrune-Cap-Martin yet.")) + "</li>";
        list.hidden = false; input.setAttribute("aria-expanded", "true");
      }
      function hide() { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
      input.addEventListener("input", function () {
        var q = input.value.trim(); picked = null; clearTimeout(timer);
        if (q.length < 2) { hide(); return; }
        var pin = parseCoords(q);
        if (pin) { show([{ label: "Your accommodation", sub: pin.lat.toFixed(5) + ", " + pin.lng.toFixed(5), lat: pin.lat, lng: pin.lng, kind: "pin" }]); return; }
        timer = setTimeout(function () { remoteMatches(q).then(function (r) { if (input.value.trim() === q) show(localMatches(q).concat(r).slice(0, 8)); }); }, 280);
      });
      input.addEventListener("blur", function () { setTimeout(hide, 180); });
      list.addEventListener("mousedown", function (e) { e.preventDefault(); });
      list.addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (!li) return; picked = items[+li.dataset.i]; input.value = t(picked.label); hide(); });
      function done(p) {
        window.MMEExtras.Home.set(p);
        if (window.MMEStats) window.MMEStats.track("Home saved");
        location.hash = "#/";
      }
      root.querySelector("#st-go").addEventListener("click", function () {
        var err = root.querySelector("#st-err");
        if (!picked) { err.textContent = input.value.trim() ? t("Pick your accommodation from the list as you type.") : t("Tell us where you’re staying."); err.hidden = false; return; }
        done(picked);
      });
      root.querySelector("#st-here").addEventListener("click", function () {
        var err = root.querySelector("#st-err"), b = this;
        b.disabled = true;
        M().startLocating(function (msg) { err.textContent = msg; err.hidden = false; b.disabled = false; });
        var got = false, stop = M().onLocation(function (pos) {
          if (got) return; got = true; setTimeout(function () { stop(); }, 0);
          done({ label: "Your accommodation", lat: pos.lat, lng: pos.lng, kind: "pin" });
        });
      });
    }
  };

  // ---------- Spoken directions ----------
  // Reads each step aloud in the app's language with the phone's own voice (speechSynthesis), and moves on
  // by itself when you reach the start of the next step. Back / Repeat / Next work by hand too.
  var VOICE_LANG = { en: "en-GB", fr: "fr-FR", it: "it-IT", de: "de-DE", es: "es-ES", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU" };
  var Voice = (function () {
    var list = [], ol = null, idx = 0, upto = 0, bar = null, stopLoc = null, wake = null, active = false;
    function at(i) { return list[i] && list[i].at ? { lat: list[i].at[0], lng: list[i].at[1] } : null; }
    function same(i, j) { var a = at(i), b = at(j); return !!(a && b && M().distance(a, b) < 15); }
    function ok() { return typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined"; }
    function code() { return VOICE_LANG[window.MMEI18N.lang()] || "en-GB"; }
    function voiceFor(c) {
      var vs = window.speechSynthesis.getVoices() || [], base = c.split("-")[0];
      return vs.filter(function (v) { return v.lang && v.lang.replace("_", "-") === c; })[0] || vs.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(base) === 0; })[0] || null;
    }
    function say(text) {
      var u = new SpeechSynthesisUtterance(text), c = code(), v = voiceFor(c);
      u.lang = c; if (v) u.voice = v; u.rate = 0.95;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    }
    function show(i) {
      idx = Math.max(0, Math.min(list.length - 1, i));
      var st = list[idx];
      if (ol) [].forEach.call(ol.children, function (li, k) { li.classList.toggle("step-now", k === idx); });
      var cur = ol && ol.children[idx]; if (cur) cur.scrollIntoView({ behavior: "smooth", block: "center" });
      bar.querySelector(".vb-count").textContent = t("Step {n} of {total}", { n: idx + 1, total: list.length });
      bar.querySelector("[data-v=back]").disabled = idx === 0;
      bar.querySelector("[data-v=next]").disabled = false;
      // Steps that start at the same spot (a lift, then the walk from its top) are read together.
      var text = st.text; upto = idx;
      while (upto + 1 < list.length && same(upto + 1, idx)) { upto++; text += " " + list[upto].text; }
      bar.querySelector(".vb-text").textContent = text;
      bar.querySelector("[data-v=next]").disabled = upto >= list.length - 1;
      say(text);
    }
    function near(p) {
      if (!active || upto >= list.length - 1) return;
      var nx = at(upto + 1);
      if (!nx) return;
      var d = M().distance(p, nx), lim = Math.max(20, Math.min(p.acc || 25, 40));
      if (d <= lim) show(upto + 1);
    }
    function start(l, olEl) {
      if (!ok() || !l.length) return;
      stop(); list = l; ol = olEl; active = true;
      var esc = ui().esc;
      bar = document.createElement("div");
      bar.className = "voice-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", t("Voice directions"));
      bar.innerHTML = '<div class="vb-top"><span class="vb-count"></span><button type="button" class="vb-x" data-v="stop" aria-label="' + esc(t("Stop")) + '">×</button></div>' +
        '<p class="vb-text" aria-live="polite"></p>' +
        '<div class="vb-btns"><button type="button" data-v="back">' + esc(t("Back")) + '</button><button type="button" data-v="repeat">' + esc(t("Repeat")) + '</button><button type="button" class="vb-next" data-v="next">' + esc(t("Next")) + "</button></div>" +
        '<p class="vb-note">' + esc(t("We’ll read the next step when you reach it.")) + "</p>";
      document.body.appendChild(bar); document.body.classList.add("voice-on");
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-v]"); if (!b) return;
        var v = b.dataset.v;
        if (v === "stop") stop(); else if (v === "back") show(idx - 1); else if (v === "next") show(upto + 1); else say(bar.querySelector(".vb-text").textContent);
      });
      // Check there's a voice for this language (voices can load a moment later).
      function checkVoice() {
        if (!bar) return;
        var c = code(), vs = window.speechSynthesis.getVoices() || [];
        if (vs.length && !voiceFor(c) && !bar.querySelector(".vb-warn")) {
          var w = document.createElement("p"); w.className = "vb-warn";
          w.textContent = t("Your phone has no voice for this language yet. You can add one in its text-to-speech settings.");
          bar.appendChild(w);
        }
      }
      if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = checkVoice;
      setTimeout(checkVoice, 800);
      try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(function (w) { wake = w; }).catch(function () {}); } catch (e) {}
      M().startLocating(function () {});
      stopLoc = M().onLocation(near);
      if (window.MMEStats) window.MMEStats.track("Voice directions", { lang: window.MMEI18N.lang() });
      show(0);
    }
    function stop() {
      active = false;
      try { window.speechSynthesis.cancel(); } catch (e) {}
      if (stopLoc) { var s0 = stopLoc; stopLoc = null; setTimeout(s0, 0); }
      if (wake) { try { wake.release(); } catch (e) {} wake = null; }
      if (bar) { bar.remove(); bar = null; }
      document.body.classList.remove("voice-on");
      if (ol) [].forEach.call(ol.children, function (li) { li.classList.remove("step-now"); });
    }
    window.addEventListener("hashchange", stop);
    return { ok: ok, start: start, stop: stop };
  })();

  window.MMEPlanner = { stayScreen: stayScreen, homeRoute: homeRoute, shipRoute: shipRoute, arriveScreen: arriveScreen, placeRef: placeRef, go: go, boxHtml: boxHtml, mountBox: mountBox, screen: screen, fromLink: fromLink, toLink: toLink, state: state };
})();
