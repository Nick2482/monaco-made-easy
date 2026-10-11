// The live map: every lift and escalator, the main places, and "lifts near me".
(function () {
  "use strict";
  var D = window.MME;

  // One location watcher shared by the map and survey screens.
  var here = null, watchers = [], watchId = null;
  function startLocating(onError) {
    if (!("geolocation" in navigator)) { if (onError) onError("This phone can’t share its location."); return; }
    if (watchId !== null) return;
    watchId = navigator.geolocation.watchPosition(function (pos) {
      here = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, t: pos.timestamp };
      watchers.forEach(function (fn) { fn(here); });
    }, function (err) {
      if (onError) onError(err.code === 1 ? "Location is switched off for this app. Turn it on in your phone’s settings to see lifts near you." : "We couldn’t find your location just now.");
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

  // A Monaco map with a calm, light style so the red lift markers stand out.
  function makeMap(el, opts) {
    var map = L.map(el, { zoomControl: false, attributionControl: true, tap: true }).setView([43.7375, 7.4235], opts && opts.zoom || 15);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 20, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    return map;
  }

  function liftIcon(l) {
    var ui = window.MMEUI;
    return L.divIcon({
      className: "",
      html: '<span class="mk mk-' + l.type + (l.approx ? " mk-approx" : "") + '">' + ui.icon(l.type) + "</span>",
      iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16]
    });
  }
  function placeIcon(p) {
    return L.divIcon({ className: "", html: '<span class="mk-place"><i></i>' + window.MMEUI.esc(p.short) + "</span>", iconSize: null, iconAnchor: [7, 7] });
  }
  var meIcon = L.divIcon({ className: "", html: '<span class="mk-me"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });

  function directions(lat, lng) {
    return "https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=" + lat + "," + lng;
  }

  function liftPopup(l) {
    var esc = window.MMEUI.esc;
    return "<strong>" + esc(l.name) + "</strong><br>" + esc(l.links) +
      (l.approx ? '<br><em class="pop-approx">Position approximate, being checked</em>' : "") +
      '<br><a href="' + directions(l.lat, l.lng) + '" target="_blank" rel="noopener">Walking directions</a>';
  }

  // ---------- The map screen ----------
  var screen = {
    html: function () {
      return '<section class="mapscreen">' +
        '<div class="map-wrap"><div id="map" class="map" role="application" aria-label="Map of Monaco lifts and escalators"></div>' +
        '<button type="button" class="find-me" id="find-me"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-1-7h2v3.06A8 8 0 0 1 19.94 11H23v2h-3.06A8 8 0 0 1 13 19.94V23h-2v-3.06A8 8 0 0 1 4.06 13H1v-2h3.06A8 8 0 0 1 11 4.06zm1 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>Lifts near me</button>' +
        '<div class="map-key"><span><i class="mk-k mk-lift"></i>Lift</span><span><i class="mk-k mk-escalator"></i>Escalator</span><span><i class="mk-k mk-approx-k"></i>Being checked</span></div></div>' +
        '<div class="near"><h1 id="near-h">Lifts and escalators</h1><p class="lede-dark" id="near-sub">Tap “Lifts near me” to sort them by distance.</p><p class="loc-error" id="loc-error" hidden></p><ul class="lifts" id="near-list"></ul>' +
        '<p class="unchecked">Map positions are approximate until we’ve pinned and photographed each entrance on the ground.</p></div></section>';
    },
    mount: function (root) {
      var ui = window.MMEUI;
      var map = makeMap(root.querySelector("#map"));
      var markers = {};
      D.lifts.forEach(function (l) {
        markers[l.id] = L.marker([l.lat, l.lng], { icon: liftIcon(l), title: l.name, keyboard: true }).addTo(map).bindPopup(liftPopup(l));
      });
      Object.keys(D.places).forEach(function (id) {
        var p = D.places[id];
        L.marker([p.lat, p.lng], { icon: placeIcon(p), interactive: false, keyboard: false }).addTo(map);
      });
      var me = null, centred = false;
      var list = root.querySelector("#near-list");

      function drawList(pos) {
        var items = D.lifts.map(function (l) { return { l: l, d: pos ? distance(pos, l) : null }; });
        if (pos) items.sort(function (a, b) { return a.d - b.d; });
        list.innerHTML = items.map(function (it) {
          var l = it.l;
          return '<li><span class="step-ico" style="--c:' + ui.COLORS[l.type] + '">' + ui.icon(l.type) + "</span><div><strong>" + ui.esc(l.name) + "</strong>" +
            "<span>" + ui.esc(l.links) + "</span><small>" + (it.d !== null ? niceDistance(it.d) + " away, about " + walkMinutes(it.d) + " min walk" : ui.esc(l.where) + ", " + l.area) + "</small></div>" +
            '<button type="button" class="map-mini" data-show="' + l.id + '">Show</button></li>';
        }).join("");
      }
      drawList(null);

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
          root.querySelector("#near-h").textContent = "Nearest to you";
          root.querySelector("#near-sub").textContent = inArea ? "Sorted by distance from where you are now." : "You’re not in Monaco yet. When you are, this list sorts itself by what’s closest.";
          drawList(inArea ? pos : null);
        });
      }
      root.querySelector("#find-me").addEventListener("click", locate);
      if (/near/.test(location.hash)) locate();
      setTimeout(function () { map.invalidateSize(); }, 50);
    }
  };

  window.MMEMap = { screen: screen, makeMap: makeMap, liftIcon: liftIcon, meIcon: meIcon, startLocating: startLocating, onLocation: onLocation, distance: distance, niceDistance: niceDistance };
})();
