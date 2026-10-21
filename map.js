// The live map: every lift and escalator, the main places, and "lifts near me".
(function () {
  "use strict";
  var D = window.MME;
  function t(s, v) { return window.MMEI18N.t(s, v); }
  // Lift names and descriptions: generic English parts are translated, real names are kept.
  function liftName(l) {
    var m = /^Public (lift|escalator)(, (.*))?$/.exec(l.name);
    return m ? t(m[1] === "lift" ? "Public lift" : "Public escalator") + (m[3] ? ", " + m[3] : "") : l.name;
  }
  function liftLinks(l) {
    var m = /^Levels (.+) and (.+)$/.exec(l.links);
    if (m) return t("Levels {a} and {b}", { a: m[1], b: m[2] });
    return t(l.links);
  }

  // One location watcher shared by the map and survey screens.
  var here = null, watchers = [], watchId = null;
  function startLocating(onError) {
    if (!("geolocation" in navigator)) { if (onError) onError(t("This phone can’t share its location.")); return; }
    if (watchId !== null) return;
    watchId = navigator.geolocation.watchPosition(function (pos) {
      here = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, t: pos.timestamp };
      watchers.forEach(function (fn) { fn(here); });
    }, function (err) {
      if (onError) onError(err.code === 1 ? t("Location is switched off for this app. Turn it on in your phone’s settings to see lifts near you.") : t("We couldn’t find your location just now."));
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  function onLocation(fn) { watchers.push(fn); if (here) fn(here); return function () { watchers = watchers.filter(function (f) { return f !== fn; }); }; }

  function distance(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function niceDistance(m) {
    if (m < 1000) return Math.round(m / 10) * 10 + " m";
    return (m / 1000).toFixed(1) + " km";
  }
  function walkMinutes(m) { return Math.max(1, Math.round(m / 70)); } // a gentle 70 m a minute
  // Real walk by the easiest route (with the hills, lifts and escalators). Worked out once per spot you stand on.
  var wCache = { at: null, fn: null };
  function walkTo(pos, p) {
    var R = window.MMERouter;
    if (R && R.timesFrom) {
      if (!wCache.at || distance(wCache.at, pos) > 30) { wCache.at = pos; wCache.fn = R.timesFrom(pos); }
      var w = wCache.fn && wCache.fn(p);
      if (w) return w;
    }
    var d = distance(pos, p) * 1.4;   // no route: allow for Monaco's bends and hills
    return { metres: d, minutes: Math.max(1, Math.round(d / 60)) };
  }
  function walkText(w) { return t("{d} away, about {n} min walk", { d: niceDistance(w.metres), n: w.minutes }); }
  // Nearest first by real walking time: straight-line distance picks the candidates, the route decides the order.
  function byWalk(items, pos, get) {
    items.sort(function (a, b) { return a.d - b.d; });
    items.slice(0, 40).forEach(function (it) { it.w = walkTo(pos, get(it)); });
    items.sort(function (a, b) { return (a.w ? a.w.minutes : 1e9) - (b.w ? b.w.minutes : 1e9) || a.d - b.d; });
  }

  var CARTO_KEY = "cb1_4i7l_1_06eb2a6dadbe6d5079442b67";
  // A Monaco map with a calm, light style so the red lift markers stand out.
  function makeMap(el, opts) {
    var map = L.map(el, { zoomControl: false, attributionControl: true, tap: true }).setView([43.7375, 7.4235], opts && opts.zoom || 15);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    // With no signal, zoom into the saved map tiles rather than showing blank squares.
    // CARTO basemap key: public by design (it's in every tile request). Restrict it to the app's address in the CARTO dashboard.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=" + CARTO_KEY, {
      maxZoom: 20, subdomains: "abcd", maxNativeZoom: navigator.onLine === false ? 17 : 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    return map;
  }

  function liftIcon(l) {
    var ui = window.MMEUI;
    return L.divIcon({
      className: "",
      html: '<span class="mk mk-' + l.type + (l.approx ? " mk-approx" : "") + (X() && X().Reports.status(l.id) ? " mk-down" : "") + '">' + ui.icon(l.type) + "</span>",
      iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16]
    });
  }
  function placeIcon(p) {
    return L.divIcon({ className: "", html: '<span class="mk-place"><i></i>' + window.MMEUI.esc(t(p.short)) + "</span>", iconSize: null, iconAnchor: [7, 7] });
  }
  var meIcon = L.divIcon({ className: "", html: '<span class="mk-me"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });

  function directions(lat, lng) {
    return "https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=" + lat + "," + lng;
  }

  function X() { return window.MMEExtras; }
  function liftPopup(l) {
    var esc = window.MMEUI.esc;
    return '<div class="lift-pop">' + "<strong>" + esc(liftName(l)) + "</strong><br>" + esc(liftLinks(l)) +
      (l.approx ? '<br><em class="pop-approx">' + esc(t("Position approximate, being checked")) + "</em>" : "") +
      '<br><a href="' + directions(l.lat, l.lng) + '" target="_blank" rel="noopener">' + esc(t("Walking directions")) + "</a>" + (X() ? X().reportBox(l) : "") + "</div>";
  }

  // ---------- Essentials: toilets, pharmacies, cash, water, defibrillators (from OpenStreetMap) ----------
  var CATS = [["lifts", "Lifts"], ["toilets", "Toilets"], ["pharmacy", "Pharmacies"], ["atm", "Cash machines"], ["drinking_water", "Drinking water"], ["defibrillator", "Defibrillators"]];
  var CAT_ONE = { toilets: "Toilets", pharmacy: "Pharmacy", atm: "Cash machine", drinking_water: "Drinking water", defibrillator: "Defibrillator" };
  var CAT_COLOR = { toilets: "#6b4fa0", pharmacy: "#18a058", atm: "#b7791f", drinking_water: "#2b8cc4", defibrillator: "#0f6b45" };
  function essList() { return window.MMEEssentials || []; }
  function essTitle(e) { return e.n || t(CAT_ONE[e.k]); }
  function essDetails(e) {
    var d = [];
    if (e.wc === "yes") d.push(t("Wheelchair accessible"));
    if (e.fee === "no") d.push(t("Free"));
    if (e.fee === "yes") d.push(t("Small charge"));
    if (e.baby) d.push(t("Baby changing"));
    if (e.h) d.push(e.h);
    if (e.loc) d.push(e.loc);
    return d.join(" · ");
  }
  function essIcon(e) {
    return L.divIcon({ className: "", html: '<span class="mk mk-ess" style="background:' + CAT_COLOR[e.k] + '">' + window.MMEUI.icon(e.k) + "</span>", iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
  }
  function essPopup(e) {
    var esc = window.MMEUI.esc, det = essDetails(e);
    return '<div class="lift-pop"><strong>' + esc(essTitle(e)) + "</strong>" + (det ? "<br>" + esc(det) : "") +
      '<br><button type="button" class="pop-go" data-goto="' + e.lat + "," + e.lng + '" data-label="' + CAT_ONE[e.k] + '">' + esc(t("Take me there")) + "</button></div>";
  }
  function catNote(cat) {
    if (cat === "pharmacy") return t("At night, on Sundays and on holidays, one pharmacy stays open. In Monaco its name and address are posted on the door of every pharmacy. In Beausoleil, Cap d’Ail and the rest of France, call 3237 to find it.");
    if (cat === "defibrillator") return t("In an emergency, call 112 first. The operator can tell you where the nearest defibrillator is and guide you.");
    return "";
  }

  // ---------- The map screen ----------
  var screen = {
    html: function () {
      var esc = window.MMEUI.esc;
      var cat = currentCat();
      var note = catNote(cat);
      return '<section class="mapscreen' + (cat !== "lifts" ? " cat-" + cat : "") + '">' +
        '<div class="map-wrap"><div id="map" class="map" role="application" aria-label="' + esc(t("Map of Monaco lifts and escalators")) + '"></div>' +
        '<button type="button" class="find-me" id="find-me"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-1-7h2v3.06A8 8 0 0 1 19.94 11H23v2h-3.06A8 8 0 0 1 13 19.94V23h-2v-3.06A8 8 0 0 1 4.06 13H1v-2h3.06A8 8 0 0 1 11 4.06zm1 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>' + esc(t(cat === "lifts" ? "Lifts near me" : "Find the nearest")) + "</button>" +
        '<div class="map-key"><span><i class="mk-k mk-lift"></i>' + esc(t("Lift")) + '</span><span><i class="mk-k mk-escalator"></i>' + esc(t("Escalator")) + '</span><span><i class="mk-k mk-approx-k"></i>' + esc(t("Being checked")) + "</span></div></div>" +
        '<div class="near"><div class="ess-chips" role="group" aria-label="' + esc(t("Show on the map")) + '">' + CATS.map(function (c) {
          return '<a class="chip' + (c[0] === cat ? " on" : "") + '" href="#/map/' + c[0] + '"' + (c[0] === cat ? ' aria-current="true"' : "") + ">" + esc(t(c[1])) + "</a>";
        }).join("") + "</div>" +
        '<h1 id="near-h">' + esc(cat === "lifts" ? t("Lifts and escalators") : t(CATS.filter(function (c) { return c[0] === cat; })[0][1])) + '</h1><p class="lede-dark" id="near-sub">' + esc(cat === "lifts" ? t("Tap “Lifts near me” to sort them by distance, or tap anywhere on the map to get there.") : t("Finding the nearest to you…")) + "</p>" +
        (note ? '<aside class="note note-ess"><p>' + esc(note) + "</p></aside>" : "") +
        '<p class="loc-error" id="loc-error" hidden></p><ul class="lifts" id="near-list"></ul>' +
        '<p class="unchecked">' + esc(cat === "lifts" ? t("Lift positions come from OpenStreetMap and are being checked on the ground.") : t("Locations come from OpenStreetMap and are being checked on the ground.")) + "</p></div></section>";
    },
    mount: function (root) {
      var ui = window.MMEUI;
      var map = makeMap(root.querySelector("#map"));
      var markers = {};
      D.lifts.forEach(function (l) {
        markers[l.id] = L.marker([l.lat, l.lng], { icon: liftIcon(l), title: liftName(l), keyboard: true }).addTo(map).bindPopup(liftPopup(l));
      });
      Object.keys(D.places).forEach(function (id) {
        var p = D.places[id];
        L.marker([p.lat, p.lng], { icon: placeIcon(p), interactive: false, keyboard: false }).addTo(map);
      });
      var me = null, centred = false;
      var list = root.querySelector("#near-list");
      var cat = currentCat();
      if (cat !== "lifts") {
        essList().filter(function (e) { return e.k === cat; }).forEach(function (e) {
          L.marker([e.lat, e.lng], { icon: essIcon(e), title: essTitle(e), keyboard: true, zIndexOffset: 500 }).addTo(map).bindPopup(essPopup(e));
        });
      }

      function drawEss(pos) {
        var all = essList().filter(function (e) { return e.k === cat; });
        var items = all.map(function (e) { return { e: e, d: pos ? distance(pos, e) : null }; });
        if (pos) byWalk(items, pos, function (it) { return it.e; });
        items = items.slice(0, 15);
        list.innerHTML = items.map(function (it) {
          var e = it.e, det = essDetails(e);
          return '<li><span class="step-ico" style="--c:' + CAT_COLOR[e.k] + '">' + ui.icon(e.k) + "</span><div><strong>" + ui.esc(essTitle(e)) + "</strong>" +
            (det ? "<span>" + ui.esc(det) + "</span>" : "") + "<small>" + ui.esc(it.w ? walkText(it.w) : e.a) + "</small></div>" +
            '<button type="button" class="map-mini" data-goto="' + e.lat + "," + e.lng + '" data-label="' + CAT_ONE[e.k] + '">' + ui.esc(t("Take me there")) + "</button></li>";
        }).join("") + '<li class="more-note">' + ui.esc(t(pos ? "The 15 closest of {n}. All of them are on the map." : "{n} in Monaco, Beausoleil and Cap d’Ail. All of them are on the map.", { n: all.length })) + "</li>";
      }

      function drawList(pos) {
        if (cat !== "lifts") { drawEss(pos); return; }
        var items = D.lifts.map(function (l) { return { l: l, d: pos ? distance(pos, l) : null }; });
        if (pos) byWalk(items, pos, function (it) { return it.l; });
        else items.sort(function (a, b) { return (a.l.name.indexOf("Public") === 0) - (b.l.name.indexOf("Public") === 0); });
        var total = items.length;
        items = items.slice(0, pos ? 15 : 20);
        list.innerHTML = items.map(function (it) {
          var l = it.l;
          var down = X() && X().Reports.status(l.id);
          return '<li' + (down ? ' class="is-down"' : "") + '><span class="step-ico" style="--c:' + (down ? "#7a8694" : ui.COLORS[l.type]) + '">' + ui.icon(l.type) + "</span><div><strong>" + ui.esc(liftName(l)) + "</strong>" +
            (down ? '<span class="rep-down">' + ui.esc(X().Reports.label(down)) + "</span>" : "") +
            "<span>" + ui.esc(liftLinks(l)) + "</span><small>" + ui.esc(it.w ? walkText(it.w) : l.where + ", " + l.area) + "</small></div>" +
            '<button type="button" class="map-mini" data-show="' + l.id + '">' + ui.esc(t("Show")) + "</button></li>";
        }).join("") + '<li class="more-note">' + ui.esc(t(pos ? "The 15 closest of {n} lifts and escalators. All of them are on the map." : "20 of {n} lifts and escalators. All of them are on the map.", { n: total })) + "</li>";
      }
      var lastPos = null;
      drawList(null);
      // When reports arrive (or you make one), grey out those lifts on the map and in the list.
      function onReports() {
        if (!document.body.contains(root)) { window.removeEventListener("mme-reports", onReports); return; }
        D.lifts.forEach(function (l) { markers[l.id].setIcon(liftIcon(l)); if (!markers[l.id].isPopupOpen()) markers[l.id].setPopupContent(liftPopup(l)); });
        drawList(lastPos);
      }
      window.addEventListener("mme-reports", onReports);

      list.addEventListener("click", function (e) {
        var b = e.target.closest("[data-show]");
        if (!b) return;
        var l = D.lifts.filter(function (x) { return x.id === b.dataset.show; })[0];
        map.setView([l.lat, l.lng], 18);
        markers[l.id].openPopup();
        root.querySelector(".map-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
      });

      var stop = null;
      function locate() {
        var errBox = root.querySelector("#loc-error");
        startLocating(function (msg) { errBox.textContent = msg; errBox.hidden = false; });
        stop = onLocation(function (pos) {
          if (!document.body.contains(root.querySelector("#map"))) { if (stop) stop(); return; }
          if (!me) me = L.marker([pos.lat, pos.lng], { icon: meIcon, interactive: false, zIndexOffset: 1000 }).addTo(map);
          else me.setLatLng([pos.lat, pos.lng]);
          // Only jump to the person if they're actually in or near Monaco.
          var inArea = distance(pos, { lat: 43.7375, lng: 7.4235 }) < 6000;
          if (!centred && inArea) { map.setView([pos.lat, pos.lng], 17); centred = true; }
          root.querySelector("#near-h").textContent = t("Nearest to you");
          root.querySelector("#near-sub").textContent = inArea ? t("Sorted by distance from where you are now.") : t("You’re not in Monaco yet. When you are, this list sorts itself by what’s closest.");
          lastPos = inArea ? pos : null;
          drawList(lastPos);
        });
      }
      root.querySelector("#find-me").addEventListener("click", locate);

      // Tap anywhere on the map to plan a route there.
      map.on("click", function (e) {
        L.popup().setLatLng(e.latlng).setContent('<button type="button" class="pop-go" data-goto="' + e.latlng.lat.toFixed(6) + "," + e.latlng.lng.toFixed(6) + '">' + window.MMEUI.esc(t("Get me here")) + "</button>").openOn(map);
      });
      root.addEventListener("click", function (e) {
        var b = e.target.closest("[data-goto]");
        if (!b) return;
        var ll = b.dataset.goto.split(",");
        window.MMEPlanner.state.to = { label: b.dataset.label || "Pinned spot on the map", lat: +ll[0], lng: +ll[1], kind: "pin" };
        window.MMEPlanner.state.from = null;
        window.MMEPlanner.state.arrival = null;
        location.hash = "#/plan";
      });
      if (/near/.test(location.hash) || cat !== "lifts") locate();
      if (cat !== "lifts" && window.MMEStats) window.MMEStats.track("Essentials", { type: cat });
      setTimeout(function () { map.invalidateSize(); }, 50);
    }
  };

  function currentCat() { var c = (location.hash.split("/")[2] || "").split("?")[0]; return CAT_ONE[c] ? c : "lifts"; }
  window.MMEMap = { CAT_ONE: CAT_ONE, CAT_COLOR: CAT_COLOR, CARTO_KEY: CARTO_KEY, liftName: liftName, here: function () { return here; }, screen: screen, makeMap: makeMap, liftIcon: liftIcon, meIcon: meIcon, startLocating: startLocating, onLocation: onLocation, distance: distance, niceDistance: niceDistance, walkTo: walkTo };
})();
