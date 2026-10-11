// "Where do you want to go?" From and To boxes with live search, and the plan screen.
// Search uses OpenStreetMap data through Photon (photon.komoot.io), which is free for light use.
// Before launch, swap SEARCH_URL for a provider with a proper free plan (e.g. Geoapify) and a key.
(function () {
  "use strict";
  var D = window.MME;
  var t = function (s, v) { return window.MMEI18N.t(s, v); };
  var SEARCH_URL = "https://photon.komoot.io/api/";
  var AREA = { minLng: 7.395, minLat: 43.718, maxLng: 7.455, maxLat: 43.760 }; // Monaco and Beausoleil
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
  var POPULAR = ["casino", "palace", "port", "larvotto", "museum", "beausoleil", "fontvieille", "station", "exotic"];
  function shortName(id) { var s = D.places[id].short; return t(s === "Museum" ? "Oceanographic Museum" : s === "Palace" ? "Prince’s Palace" : s); }
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
        }).join("") || '<li class="pl-none">' + esc(t("No matches in Monaco or Beausoleil yet.")) + "</li>";
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
        var p = D.places[b.dataset.toPlace];
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
  var LINE = { walk: { color: "#0b2545", weight: 5 }, lift: { color: "#ce1126", weight: 8 }, escalator: { color: "#1d6fa5", weight: 7 }, steps: { color: "#d9480f", weight: 6, dashArray: "4 6" } };
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
        '<div class="map plan-map" id="plan-map"></div>' +
        '<div id="plan-body"><p class="lede-dark" role="status">' + esc(state.from ? t("Working out the easiest way…") : t("Finding where you are…")) + "</p></div></section>";
    },
    mount: function (root) {
      if (!state.to) return;
      var esc = ui().esc, icon = ui().icon;
      var map = M().makeMap(root.querySelector("#plan-map"), { zoom: 15 });
      var to = state.to, layer = L.layerGroup().addTo(map), fromPt = null;
      L.marker([to.lat, to.lng], { icon: L.divIcon({ className: "", html: '<span class="mk-end mk-to"></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map);

      var lastNote = null, blockedKey = "";
      function draw(from, note) {
        fromPt = from; lastNote = note;
        layer.clearLayers();
        var isStation = !!(from && from.kind === "station");
        var X = window.MMEExtras, blocked = X ? X.Reports.blockedPoints() : [];
        blockedKey = blocked.map(function (b) { return b.id; }).join(",");
        var wc = wheelchairOn();
        var R0 = window.MMERouter, exit0 = isStation && R0 ? R0.fromStation(to, { avoidSteps: avoidSteps, blocked: blocked, wheelchair: wc }) : null;
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
        h += '<label class="wc-toggle"><input type="checkbox" id="wc-on"' + (wc ? " checked" : "") + '><span class="wc-sw" aria-hidden="true"></span><span>' + esc(t("Wheelchair or pushchair")) + "<small>" + esc(t("Lifts and level paths only: no steps or escalators")) + "</small></span></label>";
        var outside = r && (r.startGap > 300 || r.endGap > 300);
        if (!r) {
          h += '<p class="summary">' + esc(wc ? t("We couldn’t find a way between these two places without steps or escalators. A taxi is the easiest option.") : t("We couldn’t find a walking route between these two places on our Monaco map.")) + "</p>";
          L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: "#0b2545", weight: 3, dashArray: "6 8" }).addTo(layer);
        } else {
          r.lines.forEach(function (ln) { L.polyline(ln.pts, LINE[ln.kind]).addTo(layer); });
          if (r.startGap > 40) L.polyline([[from.lat, from.lng], r.start], { color: "#0b2545", weight: 3, dashArray: "2 8" }).addTo(layer);
          if (r.endGap > 40) L.polyline([r.end, [to.lat, to.lng]], { color: "#0b2545", weight: 3, dashArray: "2 8" }).addTo(layer);
          var vert = r.heights
            ? "<li><strong>" + esc(r.climbed < 5 ? t("Hardly any climb") : t("{n} m climb", { n: r.climbed })) + "</strong><span>" + esc(r.saved > 4 ? t("lifts do {n} m for you", { n: r.saved }) : r.lifts ? t(r.lifts === 1 ? "1 lift on the way" : "{n} lifts on the way", { n: r.lifts }) : t("on foot")) + "</span></li>"
            : "<li><strong>" + esc(t(r.lifts === 1 ? "1 lift" : "{n} lifts", { n: r.lifts })) + "</strong><span>" + esc(r.escalators ? t(r.escalators === 1 ? "and 1 escalator" : "and {n} escalators", { n: r.escalators }) : t("on the way")) + "</span></li>";
          h += '<ul class="facts"><li><strong>' + esc(t("{n} min", { n: r.minutes })) + "</strong><span>" + esc(t("{d} on foot", { d: r.metres >= 1000 ? (r.metres / 1000).toFixed(1) + " km" : r.metres + " m" })) + "</span></li>" +
            "<li><strong>" + esc(r.stepFree ? t("No steps") : t(r.steps === 1 ? "1 set of steps" : "{n} sets of steps", { n: r.steps })) + "</strong><span>" + esc(r.stepFree ? (wc ? t("no escalators") : r.escalators ? t("but uses escalators") : t("step-free")) : t("on this route")) + "</span></li>" + vert + "</ul>";
          if (wc) h += '<aside class="note note-wc"><strong>' + esc(t("Wheelchair or pushchair")) + "</strong><p>" + esc(t("Some of Monaco’s streets are steep even without steps. Lift access comes from OpenStreetMap and is being checked on the ground.")) + "</p></aside>";
          if (other && Math.abs(other.minutes - r.minutes) >= 3 && other.steps !== r.steps) {
            h += avoidSteps
              ? '<button type="button" class="alt-btn" data-mode="steps">' + esc(t(other.steps === 1 ? "Happy with steps? There’s a quicker way: {m} min with 1 set of steps" : "Happy with steps? There’s a quicker way: {m} min with {n} sets of steps", { m: other.minutes, n: other.steps })) + "</button>"
              : '<button type="button" class="alt-btn" data-mode="easy">' + esc(t(other.stepFree ? "Show the easiest way instead: {m} min, no steps" : "Show the easiest way instead: {m} min", { m: other.minutes })) + "</button>";
          }
          var list = [];
          if (exit) list.push({ kind: "walk", text: t("Inside the station, follow the signs for the “{exit}” exit.", { exit: exit.name }) });
          if (r.startGap > 40) list.push({ kind: "walk", text: t("Walk about {n} m to the start of the route.", { n: Math.round(r.startGap / 10) * 10 }) });
          list = list.concat(r.directions);
          list.push({ kind: "arrive", text: (outside && r.endGap > 300 ? t("From here it’s about {n} min further, outside our mapped area.", { n: Math.round(r.endGap / 70) }) : t("Arrive at {place}.", { place: lbl(to) })) });
          h += '<h2 class="steps-h">' + esc(t("Step by step")) + '</h2><ol class="steps">' + list.map(function (st) {
            var k = st.kind === "steps" ? "steps" : st.kind;
            return '<li class="step step-' + k + '"><span class="step-ico" style="--c:' + (k === "steps" ? "#d9480f" : ui().COLORS[k] || "#0b2545") + '">' + icon(k === "steps" ? "steps" : k) + "</span>" +
              '<div><span class="step-type">' + esc(t(STEP_LABEL[k] || "Arrive")) + "</span><p>" + esc(st.text) + "</p></div></li>";
          }).join("") + "</ol>";
          if (!r.stepFree) h += '<aside class="note"><strong>' + esc(t("Steps on this route")) + "</strong><p>" + esc(t("This is the easiest way we can find, but it still has some steps. A taxi may be easier with heavy bags.")) + "</p></aside>";
          if (outside) h += '<aside class="note"><strong>' + esc(t("Beyond our map")) + "</strong><p>" + esc(t("Part of this journey is outside the area we cover (Monaco and Beausoleil). Use Google Maps for that part.")) + "</p></aside>";
          var T = window.MMETransit, bus = T && T.ready ? T.busOption(from, to) : null;
          if (bus && (bus.minutes + 2 < r.minutes || (r.climbed > 30 && bus.minutes < r.minutes + 8) || (!r.stepFree && bus.minutes < r.minutes + 8))) {
            var now = T.monacoNow();
            var B_ = function (x) { return "<b>" + esc(x) + "</b>"; };
            h += '<div class="bus-opt"><div class="bus-opt-top">' + T.badge(bus.p.r) + "<span>" + esc(t("Or take the bus: about {n} min in total", { n: bus.minutes })) + "</span></div>" +
              "<p>" + esc(t("Walk {a} min to {stop}.", { a: Math.max(1, bus.walkTo), stop: "\u0001" })).replace("\u0001", B_(T.stopName(bus.from))) + " " +
              esc(t("Next bus towards {dest} at {time} ({wait}).", { dest: bus.p.h, time: "\u0002", wait: bus.wait <= 0 ? t("now") : t("in {n} min", { n: bus.wait }) })).replace("\u0002", B_(T.hhmm(bus.dep))) + " " +
              esc(t("Ride {r} min to {stop}, then walk {w} min.", { r: bus.ride, stop: "\u0003", w: Math.max(1, bus.walkFrom) })).replace("\u0003", B_(T.stopName(bus.to))) + "</p>" +
              "<small>" + esc(now.ymd > window.MMEBus.valid[1] ? t("Times from the Monaco bus timetable (may have changed).") : t("Times from the Monaco bus timetable.")) + "</small></div>";
            var a = T.stopPt(bus.from), z = T.stopPt(bus.to);
            [a, z].forEach(function (p) { L.circleMarker([p.lat, p.lng], { radius: 9, color: "#fff", weight: 3, fillColor: window.MMEBus.routes[bus.p.r].c, fillOpacity: 1 }).addTo(layer); });
          }
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
          '<p class="unchecked">' + esc(t("Routes are worked out from OpenStreetMap. Lifts can be closed for repairs, so follow the blue “Ascenseur public” signs on the day.")) + "</p>";
        var body = root.querySelector("#plan-body");
        body.innerHTML = h;
        var wcBox = body.querySelector("#wc-on");
        if (wcBox) wcBox.addEventListener("change", function () { setWheelchair(wcBox.checked); avoidSteps = true; draw0(fromPt, lastNote); });
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
        M().startLocating(function (msg) { root.querySelector("#plan-body").innerHTML = '<p class="loc-error">' + esc(msg) + '</p><p><a class="btn btn-line" href="#/">' + esc(t("Choose a starting point instead")) + "</a></p>"; });
        var done = false;
        var stop = M().onLocation(function (pos) {
          if (done) return; done = true; setTimeout(function () { stop(); }, 0);
          if (!inArea(pos)) {
            root.querySelector("#plan-from").textContent = t("Monaco station (you’re not in Monaco yet)");
            state.from = { label: "Monaco Monte-Carlo station", lat: D.places.station.lat, lng: D.places.station.lng, kind: "station" };
            draw(state.from, esc(t("You’re not in Monaco or Beausoleil right now, so we’ve started from the train station. When you’re here, we’ll use where you are.")));
            state.from = null;
            return;
          }
          draw(pos);
        });
      }
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
        list.innerHTML = res.map(function (it, i) { return '<li role="option" data-i="' + i + '"><strong>' + esc(t(it.label)) + "</strong>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</li>"; }).join("") || '<li class="pl-none">' + esc(t("No matches in Monaco or Beausoleil yet.")) + "</li>";
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
    if (q.name && isFinite(lat) && isFinite(lng)) state.from = { label: q.name, lat: lat, lng: lng, kind: "partner" };
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

  window.MMEPlanner = { homeRoute: homeRoute, shipRoute: shipRoute, arriveScreen: arriveScreen, placeRef: placeRef, go: go, boxHtml: boxHtml, mountBox: mountBox, screen: screen, fromLink: fromLink, toLink: toLink, state: state };
})();
