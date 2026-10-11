// "Where do you want to go?" From and To boxes with live search, and the plan screen.
// Search uses OpenStreetMap data through Photon (photon.komoot.io), which is free for light use.
// Before launch, swap SEARCH_URL for a provider with a proper free plan (e.g. Geoapify) and a key.
(function () {
  "use strict";
  var D = window.MME;
  var SEARCH_URL = "https://photon.komoot.io/api/";
  var AREA = { minLng: 7.395, minLat: 43.718, maxLng: 7.455, maxLat: 43.760 }; // Monaco and Beausoleil
  var CENTRE = { lat: 43.7385, lng: 7.4240 };

  var state = { from: null, to: null }; // null "from" means "my location"

  function ui() { return window.MMEUI; }
  function M() { return window.MMEMap; }
  function inArea(p) { return p.lat > AREA.minLat && p.lat < AREA.maxLat && p.lng > AREA.minLng && p.lng < AREA.maxLng; }

  // Our own places and lifts come first in suggestions.
  function localMatches(q) {
    q = q.toLowerCase();
    var out = [];
    Object.keys(D.places).forEach(function (id) {
      var p = D.places[id];
      if ((p.name + " " + p.short + " " + p.area).toLowerCase().indexOf(q) !== -1) out.push({ label: p.name, sub: p.area, lat: p.lat, lng: p.lng, kind: "place", placeId: id });
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
        return { label: name, sub: [KIND_LABEL[pr.osm_value] || "", pr.name ? street : "", pr.city || pr.locality || ""].filter(Boolean).join(", "), lat: c[1], lng: c[0], kind: pr.osm_value || "place" };
      }).filter(function (x) { return x && inArea(x); });
    }).catch(function () { return []; });
  }

  // ---------- The planner box on the home screen ----------
  var POPULAR = ["casino", "palace", "port", "larvotto", "museum", "beausoleil", "fontvieille", "station", "exotic"];
  function shortName(id) { var s = D.places[id].short; return s === "Museum" ? "Oceanographic Museum" : s === "Palace" ? "Prince’s Palace" : s; }

  function boxHtml() {
    var esc = ui().esc;
    function field(which, label, ph, val) {
      return '<div class="pl-field" data-field="' + which + '"><span class="pl-dot pl-' + which + '" aria-hidden="true"></span>' +
        '<label for="pl-' + which + '">' + label + "</label>" +
        '<input id="pl-' + which + '" type="search" autocomplete="off" enterkeyhint="search" placeholder="' + ph + '" value="' + (val ? esc(val.label) : "") + '" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pl-' + which + '-list">' +
        '<ul class="pl-sugg" id="pl-' + which + '-list" role="listbox" hidden></ul></div>';
    }
    return '<div class="where planner"><p class="where-h">Where do you want to go?</p>' +
      '<div class="pl-fields">' + field("from", "From", "My location", state.from) + field("to", "To", "Hotel, restaurant, place or address", state.to) + "</div>" +
      '<p class="pl-popular">Popular:</p><div class="dests">' + POPULAR.map(function (id) {
        return '<button type="button" class="dest" data-to-place="' + id + '">' + esc(shortName(id)) + "</button>";
      }).join("") + "</div>" +
      '<p class="pl-err" id="pl-err" role="alert" hidden></p>' +
      '<button type="button" class="btn btn-red pl-go" id="pl-go">Show me the easiest way</button>' +
      '<a class="near-link" href="#/map/near">Or see the lifts near me on the map</a></div>';
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
        if (which === "from") items = [{ label: "My location", sub: "Use where I am now", kind: "me" }].concat(items);
        list.innerHTML = items.map(function (it, i) {
          return '<li role="option" id="pl-' + which + "-o" + i + '" data-i="' + i + '"><strong>' + esc(it.label) + "</strong>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</li>";
        }).join("") || '<li class="pl-none">No matches in Monaco or Beausoleil yet.</li>';
        list.hidden = false; input.setAttribute("aria-expanded", "true");
      }
      function hide() { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
      input.addEventListener("input", function () {
        var q = input.value.trim();
        state[which] = null;
        clearTimeout(timer);
        if (q.length < 2) { if (which === "from") show([]); else hide(); return; }
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
        if (it.kind === "me") { state.from = null; input.value = ""; input.placeholder = "My location"; }
        else { state[which] = it; input.value = it.label; }
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
        box.querySelector("#pl-to").value = p.name;
        box.querySelectorAll("[data-to-place]").forEach(function (x) { x.classList.toggle("on", x === b); });
      }
    });
    box.querySelector("#pl-go").addEventListener("click", function () {
      var err = box.querySelector("#pl-err");
      if (!state.to) { err.textContent = box.querySelector("#pl-to").value.trim() ? "Pick a place from the list as you type." : "Choose where you want to go."; err.hidden = false; return; }
      if (box.querySelector("#pl-from").value.trim() && !state.from) { err.textContent = "Pick your starting point from the list, or clear the box to use your location."; err.hidden = false; return; }
      err.hidden = true;
      location.hash = "#/plan";
    });
  }

  // ---------- Working out the suggestion ----------
  function nearestPlace(pt, maxM) {
    var best = null;
    Object.keys(D.places).forEach(function (id) {
      var d = M().distance(pt, D.places[id]);
      if (d <= maxM && (!best || d < best.d)) best = { id: id, d: d };
    });
    return best;
  }
  // Distance from a point to the straight line between two points, in metres (fine at this scale).
  function offLine(p, a, b) {
    var k = 111320 * Math.cos(a.lat * Math.PI / 180);
    var ax = a.lng * k, ay = a.lat * 110540, bx = b.lng * k, by = b.lat * 110540, px = p.lng * k, py = p.lat * 110540;
    var dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    var t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t: t };
  }

  function planFor(from, to) {
    var straight = M().distance(from, to);
    var walkMin = Math.max(1, Math.round(straight * 1.35 / 70)); // streets wind, so allow a third extra
    var pa = nearestPlace(from, 400), pb = nearestPlace(to, 400);
    var route = null;
    if (pa && pb && pa.id !== pb.id) route = D.routes.filter(function (r) { return r.from === pa.id && r.to === pb.id; })[0] || null;
    var lifts = D.lifts.map(function (l) { var o = offLine(l, from, to); return { l: l, d: o.d, t: o.t }; })
      .filter(function (x) { return x.d < 220 && x.t > 0.02 && x.t < 0.98; })
      .sort(function (a, b) { return a.t - b.t; }).slice(0, 4);
    return { straight: straight, walkMin: walkMin, pa: pa, pb: pb, route: route, lifts: lifts };
  }

  // ---------- The plan screen ----------
  var screen = {
    html: function () {
      var esc = ui().esc;
      if (!state.to) return '<section class="page"><h1>Plan a route</h1><p class="lede-dark">Choose where you want to go on the home screen.</p><p><a class="btn btn-red" href="#/">Back to the start</a></p></section>';
      return '<section class="plan">' +
        '<a class="back" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>Change</a>' +
        '<ol class="pl-ends"><li><span class="pl-dot pl-from"></span><div><small>From</small><strong id="plan-from">' + (state.from ? esc(state.from.label) : "My location") + "</strong></div></li>" +
        '<li><span class="pl-dot pl-to"></span><div><small>To</small><strong>' + esc(state.to.label) + "</strong></div></li></ol>" +
        '<div class="map plan-map" id="plan-map"></div>' +
        '<div id="plan-body"><p class="lede-dark" role="status">' + (state.from ? "Working it out…" : "Finding where you are…") + "</p></div></section>";
    },
    mount: function (root) {
      if (!state.to) return;
      var esc = ui().esc, icon = ui().icon, COLORS = ui().COLORS;
      var map = M().makeMap(root.querySelector("#plan-map"), { zoom: 15 });
      var to = state.to;
      L.marker([to.lat, to.lng], { icon: L.divIcon({ className: "", html: '<span class="mk-end mk-to"></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map);
      var drawn = false;
      function draw(from) {
        if (drawn) return; drawn = true;
        var plan = planFor(from, to);
        L.marker([from.lat, from.lng], { icon: L.divIcon({ className: "", html: '<span class="mk-end mk-from"></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map);
        L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: "#0b2545", weight: 3, dashArray: "6 8", opacity: 0.7 }).addTo(map);
        plan.lifts.forEach(function (x) { L.marker([x.l.lat, x.l.lng], { icon: M().liftIcon(x.l), title: x.l.name }).addTo(map); });
        map.fitBounds(L.latLngBounds([[from.lat, from.lng], [to.lat, to.lng]]).pad(0.35));
        var h = '<ul class="facts"><li><strong>' + M().niceDistance(plan.straight) + "</strong><span>as the crow flies</span></li>" +
          "<li><strong>about " + plan.walkMin + " min</strong><span>on foot</span></li>" +
          "<li><strong>" + plan.lifts.length + "</strong><span>lift" + (plan.lifts.length === 1 ? "" : "s") + " on the way</span></li></ul>";
        if (plan.route) {
          var r = plan.route;
          h += '<h2 class="steps-h">Our easiest way</h2><a class="pl-route" href="#/route/' + r.id + '"><strong>' + esc(r.title) + "</strong><span>" + r.minutes + " min, " + (r.stepFree ? "step-free" : "some steps") + ". " + esc(r.summary) + "</span>" +
            (plan.pa.d > 60 ? "<small>First walk about " + Math.max(1, Math.round(plan.pa.d / 70)) + " min to " + esc(D.places[plan.pa.id].name) + ".</small>" : "") + "</a>";
        }
        if (plan.lifts.length) {
          h += '<h2 class="steps-h">Lifts that can help on the way</h2><ul class="lifts">' + plan.lifts.map(function (x) {
            return '<li><span class="step-ico" style="--c:' + COLORS[x.l.type] + '">' + icon(x.l.type) + "</span><div><strong>" + esc(x.l.name) + "</strong><span>" + esc(x.l.links) + "</span><small>" + esc(x.l.where) + "</small></div></li>";
          }).join("") + "</ul>";
        } else if (!plan.route) {
          h += '<p class="summary">' + (plan.straight < 500 ? "These two places are close together. It’s a short walk." : "We don’t know of public lifts on the direct line between these two places yet.") + "</p>";
        }
        h += '<div class="actions"><a class="btn btn-red" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=' + from.lat + "," + from.lng + "&destination=" + to.lat + "," + to.lng + '">Walking directions in Google Maps</a></div>' +
          '<p class="unchecked">Full step-by-step routes using every lift arrive after our ground survey. For now we show the lifts near your path and our ready-made routes.</p>';
        root.querySelector("#plan-body").innerHTML = h;
      }
      if (state.from) draw(state.from);
      else {
        M().startLocating(function (msg) { root.querySelector("#plan-body").innerHTML = '<p class="loc-error">' + esc(msg) + '</p><p><a class="btn btn-line" href="#/">Choose a starting point instead</a></p>'; });
        var stop = M().onLocation(function (pos) {
          stop && stop();
          if (!inArea(pos)) {
            // Not in Monaco yet (e.g. trying the app at home): start from the station instead.
            root.querySelector("#plan-from").textContent = "Monaco station (you’re not in Monaco yet)";
            draw({ lat: D.places.station.lat, lng: D.places.station.lng });
            root.querySelector("#plan-body").insertAdjacentHTML("afterbegin", '<p class="summary">You’re not in Monaco or Beausoleil right now, so we’ve started from Monaco station. When you’re here, we’ll use where you are.</p>');
            return;
          }
          draw(pos);
        });
      }
      setTimeout(function () { map.invalidateSize(); }, 50);
    }
  };

  // Partner QR codes open the app with "From" already set, e.g.
  // #/from?name=H%C3%B4tel%20Example&lat=43.7391&lng=7.4272
  function fromLink(hash) {
    var q = (hash.split("?")[1] || "").split("&").reduce(function (o, kv) { var p = kv.split("="); if (p[0]) o[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || "").replace(/\+/g, " ")); return o; }, {});
    var lat = parseFloat(q.lat), lng = parseFloat(q.lng);
    if (q.name && isFinite(lat) && isFinite(lng)) state.from = { label: q.name, lat: lat, lng: lng, kind: "partner" };
  }

  window.MMEPlanner = { boxHtml: boxHtml, mountBox: mountBox, screen: screen, fromLink: fromLink, state: state };
})();
