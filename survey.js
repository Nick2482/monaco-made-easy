// Survey mode, for checking Monaco on the ground. Open the app at #/survey.
// Everything is saved on the phone itself (it works with no signal) until it's exported.
(function () {
  "use strict";
  var D = window.MME;

  // ---------- Storage on the phone (IndexedDB) ----------
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open("mme-survey", 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        d.createObjectStore("pins", { keyPath: "id" });
        var ph = d.createObjectStore("photos", { keyPath: "id" });
        ph.createIndex("pinId", "pinId");
        d.createObjectStore("walks", { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out;
        out = fn(s);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("Storage is full")); };
      });
    });
  }
  function all(store) { return tx(store, "readonly", function (s) { return s.getAll(); }); }
  function put(store, v) { return tx(store, "readwrite", function (s) { s.put(v); }); }
  function del(store, id) { return tx(store, "readwrite", function (s) { s.delete(id); }); }
  function photosFor(pinId) { return tx("photos", "readonly", function (s) { return s.index("pinId").getAll(pinId); }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- Photos: shrink on the phone so hundreds fit ----------
  function shrinkPhoto(file) {
    var MAX = 2000;
    function draw(src, w, h) {
      var scale = Math.min(1, MAX / Math.max(w, h));
      var c = document.createElement("canvas");
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res({ blob: b, w: c.width, h: c.height }); }, "image/jpeg", 0.82); });
    }
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) { return draw(bmp, bmp.width, bmp.height); })
        .catch(function () { return viaImg(); });
    }
    return viaImg();
    function viaImg() {
      return new Promise(function (res, rej) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { draw(img, img.naturalWidth, img.naturalHeight).then(function (r) { URL.revokeObjectURL(url); res(r); }); };
        img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("That photo couldn’t be read.")); };
        img.src = url;
      });
    }
  }

  var TYPES = [["lift", "Lift"], ["escalator", "Escalator"], ["walkway", "Moving walkway"], ["entrance", "Lift entrance"], ["steps", "Steps"], ["ramp", "Ramp"], ["toilet", "Toilet"], ["bus", "Bus stop"], ["hotel", "Hotel entrance"], ["restaurant", "Restaurant or café"], ["photo", "View or photo"], ["other", "Other"]];
  var MARKS = ["Lift in", "Lift out", "Escalator", "Steps", "Steep bit", "Turn here", "Sign"];

  // ---------- Walk recording ----------
  var walk = null; // { id, started, points: [], marks: [], watch, wake, timer }
  function metres(points) {
    var m = 0;
    for (var i = 1; i < points.length; i++) m += window.MMEMap.distance({ lat: points[i - 1][0], lng: points[i - 1][1] }, { lat: points[i][0], lng: points[i][1] });
    return m;
  }
  function n(count, word) { return count + " " + word + (count === 1 ? "" : "s"); }
  function clock(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  function startWalk(onTick) {
    walk = { id: uid(), started: Date.now(), points: [], marks: [] };
    walk.watch = navigator.geolocation.watchPosition(function (p) {
      var pt = [+p.coords.latitude.toFixed(6), +p.coords.longitude.toFixed(6), Math.round(p.coords.accuracy), p.timestamp, p.coords.altitude === null ? null : Math.round(p.coords.altitude)];
      var last = walk.points[walk.points.length - 1];
      // Keep a point when we've moved 4 m or 10 seconds have passed.
      if (!last || window.MMEMap.distance({ lat: last[0], lng: last[1] }, { lat: pt[0], lng: pt[1] }) > 4 || pt[3] - last[3] > 10000) walk.points.push(pt);
      onTick();
    }, function () {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    // Keep the screen on, as phones stop sharing location when they lock.
    if (navigator.wakeLock) navigator.wakeLock.request("screen").then(function (w) { walk.wake = w; }).catch(function () {});
    walk.timer = setInterval(onTick, 1000);
  }
  function stopWalk() {
    navigator.geolocation.clearWatch(walk.watch);
    clearInterval(walk.timer);
    if (walk.wake) walk.wake.release().catch(function () {});
    var w = walk; walk = null; return w;
  }

  // ---------- Export: one zip with the data, the walks as GPX, and the photos ----------
  function gpx(walks) {
    var out = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Monaco Made Easy survey" xmlns="http://www.topografix.com/GPX/1/1">\n';
    walks.forEach(function (w) {
      w.marks.forEach(function (m) { out += '<wpt lat="' + m.lat + '" lon="' + m.lng + '"><name>' + xml(w.name + ": " + m.label) + "</name><time>" + new Date(m.t).toISOString() + "</time></wpt>\n"; });
      out += "<trk><name>" + xml(w.name) + "</name><trkseg>\n";
      w.points.forEach(function (p) { out += '<trkpt lat="' + p[0] + '" lon="' + p[1] + '">' + (p[4] !== null && p[4] !== undefined ? "<ele>" + p[4] + "</ele>" : "") + "<time>" + new Date(p[3]).toISOString() + "</time></trkpt>\n"; });
      out += "</trkseg></trk>\n";
    });
    return out + "</gpx>\n";
  }
  function xml(s) { return String(s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }

  function buildZip(withPhotos) {
    return Promise.all([all("pins"), all("walks"), withPhotos ? all("photos") : Promise.resolve([])]).then(function (r) {
      var pins = r[0], walks = r[1], photos = r[2];
      var zip = new JSZip();
      var byPin = {};
      photos.forEach(function (ph) { (byPin[ph.pinId] = byPin[ph.pinId] || []).push(ph); });
      var pinsOut = pins.map(function (p) {
        var files = (byPin[p.id] || []).map(function (ph, i) {
          var name = "photos/" + new Date(p.created).toISOString().slice(0, 10) + "-" + (p.name || p.type).replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-" + p.id + "-" + (i + 1) + ".jpg";
          zip.file(name, ph.blob);
          return name;
        });
        var copy = Object.assign({}, p); copy.photoFiles = files; return copy;
      });
      zip.file("survey.json", JSON.stringify({ exported: new Date().toISOString(), pins: pinsOut, walks: walks }, null, 2));
      zip.file("walks.gpx", gpx(walks));
      return zip.generateAsync({ type: "blob" });
    });
  }

  // ---------- The survey screen ----------
  var screen = {
    html: function () {
      return '<section class="survey">' +
        '<div class="sv-head"><p class="sv-kicker">Survey mode</p><h1>Check Monaco on the ground</h1>' +
        '<p class="lede-dark">Pin each lift, escalator and entrance, take photos, and record routes as you walk them. Everything is saved on this phone until you export it.</p></div>' +
        '<div class="sv-gps" id="sv-gps"><span class="gps-dot"></span><span id="sv-gps-text">Finding your location…</span></div>' +
        '<div class="sv-map-wrap"><div id="sv-map" class="map sv-map"></div></div>' +
        '<div class="sv-actions"><button type="button" class="btn btn-red" id="sv-pin">Pin this spot</button><button type="button" class="btn btn-navy" id="sv-walk">Record a walk</button></div>' +
        '<div id="sv-panel"></div>' +
        '<h2 class="sv-h">Saved on this phone</h2><p class="sv-counts" id="sv-counts"></p><ul class="sv-list" id="sv-list"></ul>' +
        '<div class="sv-export"><h2 class="sv-h">Send to Claude</h2><p>Do this every evening. It makes one file you can send by WhatsApp, email or Google Drive.</p>' +
        '<button type="button" class="btn btn-red" id="sv-export">Export everything</button>' +
        '<button type="button" class="btn btn-line" id="sv-export-lite">Export without photos (small file)</button>' +
        '<p class="sv-status" id="sv-status" role="status"></p></div>' +
        '<p class="unchecked">Tip: keep the screen on while recording a walk. Most phones stop sharing location when the screen locks.</p>' +
        "</section>";
    },
    mount: function (root) {
      var ui = window.MMEUI, M = window.MMEMap;
      var map = M.makeMap(root.querySelector("#sv-map"), { zoom: 15 });
      D.lifts.forEach(function (l) { L.marker([l.lat, l.lng], { icon: M.liftIcon(l), title: l.name }).addTo(map).bindPopup("<strong>" + ui.esc(l.name) + "</strong><br>Approximate position from published sources"); });
      var pinLayer = L.layerGroup().addTo(map);
      var trackLine = L.polyline([], { color: "#ce1126", weight: 5 }).addTo(map);
      var me = null, here = null, centred = false;
      var gpsText = root.querySelector("#sv-gps-text"), gpsBox = root.querySelector("#sv-gps");
      M.startLocating(function (msg) { gpsText.textContent = msg; gpsBox.className = "sv-gps bad"; });
      var stopLoc = M.onLocation(function (pos) {
        if (!document.body.contains(root)) { stopLoc(); return; }
        here = pos;
        gpsText.textContent = "Location found, accurate to about " + Math.round(pos.acc) + " m" + (pos.acc > 25 ? ". Step into the open for a better fix." : "");
        gpsBox.className = "sv-gps " + (pos.acc <= 25 ? "good" : "fair");
        if (!me) me = L.marker([pos.lat, pos.lng], { icon: M.meIcon, interactive: false, zIndexOffset: 1000 }).addTo(map); else me.setLatLng([pos.lat, pos.lng]);
        if (!centred) { map.setView([pos.lat, pos.lng], 18); centred = true; }
      });
      setTimeout(function () { map.invalidateSize(); }, 50);

      var panel = root.querySelector("#sv-panel");
      var status = root.querySelector("#sv-status");

      function refresh() {
        Promise.all([all("pins"), all("walks"), all("photos")]).then(function (r) {
          var pins = r[0].sort(function (a, b) { return b.created - a.created; }), walks = r[1].sort(function (a, b) { return b.started - a.started; }), photos = r[2];
          var thumbs = {};
          photos.forEach(function (ph) { if (!thumbs[ph.pinId]) thumbs[ph.pinId] = ph; });
          root.querySelector("#sv-counts").textContent = n(pins.length, "pin") + ", " + n(photos.length, "photo") + ", " + n(walks.length, "walk") + " recorded";
          pinLayer.clearLayers();
          pins.forEach(function (p) {
            L.circleMarker([p.lat, p.lng], { radius: 8, color: "#fff", weight: 2, fillColor: "#0b2545", fillOpacity: 1 }).addTo(pinLayer).bindPopup("<strong>" + ui.esc(p.name || p.typeLabel) + "</strong><br>" + ui.esc(p.typeLabel));
          });
          walks.forEach(function (w) { L.polyline(w.points.map(function (p) { return [p[0], p[1]]; }), { color: "#1d6fa5", weight: 4, opacity: 0.8 }).addTo(pinLayer); });
          var list = root.querySelector("#sv-list");
          list.querySelectorAll("img").forEach(function (img) { URL.revokeObjectURL(img.src); });
          list.innerHTML = walks.map(function (w) {
            return '<li><span class="sv-thumb walk">' + ui.icon("walk") + "</span><div><strong>" + ui.esc(w.name) + "</strong><small>Walk, " + clock(w.ended - w.started) + ", " + M.niceDistance(w.metres) + ", " + n(w.marks.length, "marker") + "</small></div>" +
              '<button type="button" class="sv-del" data-del-walk="' + w.id + '" aria-label="Delete ' + ui.esc(w.name) + '">Delete</button></li>';
          }).join("") + pins.map(function (p) {
            var t = thumbs[p.id];
            return "<li>" + (t ? '<img class="sv-thumb" alt="" src="' + URL.createObjectURL(t.blob) + '">' : '<span class="sv-thumb">' + ui.icon(p.type === "escalator" ? "escalator" : p.type === "bus" ? "bus" : p.type === "lift" || p.type === "entrance" ? "lift" : "arrive") + "</span>") +
              "<div><strong>" + ui.esc(p.name || p.typeLabel) + "</strong><small>" + ui.esc(p.typeLabel) + ", " + new Date(p.created).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) + ", ±" + p.acc + " m" + (p.working === "no" ? ", NOT WORKING" : "") + "</small></div>" +
              '<button type="button" class="sv-del" data-del-pin="' + p.id + '" aria-label="Delete">Delete</button></li>';
          }).join("") || '<li class="sv-empty">Nothing saved yet. Start with “Pin this spot”.</li>';
        });
      }
      refresh();

      // ----- Pin form -----
      root.querySelector("#sv-pin").addEventListener("click", function () {
        if (walk) return;
        var pos = here;
        var photos = [];
        panel.innerHTML = '<form class="sv-form" id="sv-form">' +
          '<h2 class="sv-h">New pin</h2>' +
          '<p class="sv-pos" id="sv-pos">' + (pos ? "Position: ±" + Math.round(pos.acc) + " m" : "Waiting for your location…") + ' <button type="button" class="link-btn" id="sv-repos">Update position</button></p>' +
          '<fieldset><legend>What is it?</legend><div class="sv-chips">' + TYPES.map(function (t, i) { return '<label class="sv-chip"><input type="radio" name="type" value="' + t[0] + '"' + (i === 0 ? " checked" : "") + "><span>" + t[1] + "</span></label>"; }).join("") + "</div></fieldset>" +
          '<label class="sv-field">Which one is it?<select name="lift"><option value="">New, or not in our list</option>' + D.lifts.map(function (l) { return '<option value="' + l.id + '">' + ui.esc(l.name) + "</option>"; }).join("") + "</select></label>" +
          '<label class="sv-field">Name or what the sign says<input name="name" placeholder="e.g. Ascenseur public Sainte-Dévote"></label>' +
          '<fieldset><legend>Which end are you at?</legend><div class="sv-chips">' + [["bottom", "Bottom"], ["top", "Top"], ["middle", "A middle level"], ["na", "Not a lift"]].map(function (o, i) { return '<label class="sv-chip"><input type="radio" name="end" value="' + o[0] + '"' + (i === 0 ? " checked" : "") + "><span>" + o[1] + "</span></label>"; }).join("") + "</div></fieldset>" +
          '<fieldset><legend>Working today?</legend><div class="sv-chips">' + [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]].map(function (o, i) { return '<label class="sv-chip"><input type="radio" name="working" value="' + o[0] + '"' + (i === 0 ? " checked" : "") + "><span>" + o[1] + "</span></label>"; }).join("") + "</div></fieldset>" +
          '<fieldset><legend>Step-free to reach it?</legend><div class="sv-chips">' + [["yes", "Yes"], ["no", "No, steps"], ["unsure", "Not sure"]].map(function (o, i) { return '<label class="sv-chip"><input type="radio" name="stepfree" value="' + o[0] + '"' + (i === 0 ? " checked" : "") + "><span>" + o[1] + "</span></label>"; }).join("") + "</div></fieldset>" +
          '<label class="sv-field">Opening hours on the sign<input name="hours" placeholder="e.g. 24 hours, or 6:00–00:30"></label>' +
          '<label class="sv-field">Where does it go from and to?<input name="links" placeholder="e.g. Boulevard Albert 1er up to Rue Grimaldi"></label>' +
          '<label class="sv-field">Notes<textarea name="notes" rows="3" placeholder="How to find the door, landmarks, anything useful"></textarea></label>' +
          '<div class="sv-photos"><label class="btn btn-line sv-cam">Add photos<input type="file" accept="image/*" capture="environment" multiple id="sv-files" hidden></label><div class="sv-previews" id="sv-previews"></div></div>' +
          '<p class="form-err" id="sv-err" role="alert" hidden></p>' +
          '<div class="sv-actions"><button class="btn btn-red" type="submit">Save pin</button><button type="button" class="btn btn-line" id="sv-cancel">Cancel</button></div></form>';
        var posEl = panel.querySelector("#sv-pos");
        var stopPos = M.onLocation(function (p) { if (!pos) { pos = p; posEl.firstChild.textContent = "Position: ±" + Math.round(p.acc) + " m "; } });
        panel.querySelector("#sv-repos").addEventListener("click", function () { if (here) { pos = here; posEl.firstChild.textContent = "Position updated: ±" + Math.round(here.acc) + " m "; } });
        panel.querySelector("#sv-files").addEventListener("change", function (e) {
          var files = Array.prototype.slice.call(e.target.files);
          e.target.value = "";
          var box = panel.querySelector("#sv-previews");
          files.forEach(function (f) {
            var slot = document.createElement("span"); slot.className = "sv-prev busy"; slot.textContent = "…"; box.appendChild(slot);
            shrinkPhoto(f).then(function (r) {
              photos.push(r);
              slot.className = "sv-prev"; slot.textContent = "";
              var img = new Image(); img.alt = ""; img.src = URL.createObjectURL(r.blob); slot.appendChild(img);
            }).catch(function (err) { slot.textContent = "!"; slot.title = err.message; });
          });
        });
        panel.querySelector("#sv-cancel").addEventListener("click", function () { stopPos(); panel.innerHTML = ""; });
        panel.querySelector("#sv-form").addEventListener("submit", function (e) {
          e.preventDefault();
          var err = panel.querySelector("#sv-err");
          if (!pos) { err.textContent = "No location yet. Wait a moment, or step outside, and try again."; err.hidden = false; return; }
          var f = e.target;
          var type = f.elements["type"].value;
          var pin = {
            id: uid(), created: Date.now(), lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6), acc: Math.round(pos.acc),
            type: type, typeLabel: TYPES.filter(function (t) { return t[0] === type; })[0][1],
            liftId: f.elements["lift"].value || null, end: f.elements["end"].value, name: f.elements["name"].value.trim(), working: f.elements["working"].value, stepFree: f.elements["stepfree"].value,
            hours: f.elements["hours"].value.trim(), links: f.elements["links"].value.trim(), notes: f.elements["notes"].value.trim()
          };
          put("pins", pin).then(function () {
            return Promise.all(photos.map(function (ph, i) { return put("photos", { id: pin.id + "-" + i, pinId: pin.id, blob: ph.blob, w: ph.w, h: ph.h }); }));
          }).then(function () {
            stopPos(); panel.innerHTML = '<p class="sv-saved" role="status">Saved. ' + photos.length + " photo" + (photos.length === 1 ? "" : "s") + ".</p>"; refresh();
            setTimeout(function () { var s = panel.querySelector(".sv-saved"); if (s) s.remove(); }, 4000);
          }).catch(function (x) { err.textContent = "Couldn’t save: " + (x && x.message || "the phone may be out of space") + ". Export now, then try again."; err.hidden = false; });
        });
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      // ----- Walk recording -----
      root.querySelector("#sv-walk").addEventListener("click", function () {
        if (walk) return;
        panel.innerHTML = '<div class="sv-rec" id="sv-rec"><p class="sv-rec-top"><span class="rec-dot"></span>Recording a walk <strong id="rec-time">0:00</strong></p>' +
          '<p class="sv-rec-sub" id="rec-sub">Waiting for GPS…</p>' +
          '<p class="sv-rec-label">Tap as you pass something:</p><div class="sv-marks">' + MARKS.map(function (m) { return '<button type="button" class="sv-mark" data-mark="' + m + '">' + m + "</button>"; }).join("") + "</div>" +
          '<div class="sv-actions"><button type="button" class="btn btn-red" id="rec-stop">Stop and save</button><button type="button" class="btn btn-line" id="rec-cancel">Discard</button></div></div>';
        startWalk(function () {
          if (!walk) return;
          panel.querySelector("#rec-time").textContent = clock(Date.now() - walk.started);
          panel.querySelector("#rec-sub").textContent = walk.points.length ? M.niceDistance(metres(walk.points)) + " walked, " + n(walk.marks.length, "marker") : "Waiting for GPS…";
          trackLine.setLatLngs(walk.points.map(function (p) { return [p[0], p[1]]; }));
        });
        panel.querySelectorAll("[data-mark]").forEach(function (b) {
          b.addEventListener("click", function () {
            var last = walk.points[walk.points.length - 1] || (here ? [here.lat, here.lng] : null);
            if (!last) return;
            walk.marks.push({ label: b.dataset.mark, t: Date.now(), lat: last[0], lng: last[1] });
            b.classList.add("hit"); setTimeout(function () { b.classList.remove("hit"); }, 400);
          });
        });
        panel.querySelector("#rec-cancel").addEventListener("click", function () { stopWalk(); trackLine.setLatLngs([]); panel.innerHTML = ""; });
        panel.querySelector("#rec-stop").addEventListener("click", function () {
          var w = stopWalk();
          panel.innerHTML = '<form class="sv-form" id="walk-form"><h2 class="sv-h">Save this walk</h2>' +
            '<label class="sv-field">Name the route<input name="name" required placeholder="e.g. Station to Casino, step-free"></label>' +
            '<fieldset><legend>Step-free all the way?</legend><div class="sv-chips">' + [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]].map(function (o, i) { return '<label class="sv-chip"><input type="radio" name="stepfree" value="' + o[0] + '"' + (i === 0 ? " checked" : "") + "><span>" + o[1] + "</span></label>"; }).join("") + "</div></fieldset>" +
            '<label class="sv-field">Notes<textarea name="notes" rows="3" placeholder="Anything tricky, nice views, cafés on the way"></textarea></label>' +
            '<div class="sv-actions"><button class="btn btn-red" type="submit">Save walk</button></div></form>';
          panel.querySelector("#walk-form").addEventListener("submit", function (e) {
            e.preventDefault();
            var f = e.target;
            put("walks", { id: w.id, name: f.elements["name"].value.trim() || "Walk", started: w.started, ended: Date.now(), points: w.points, marks: w.marks, metres: Math.round(metres(w.points)), stepFree: f.elements["stepfree"].value, notes: f.elements["notes"].value.trim() })
              .then(function () { trackLine.setLatLngs([]); panel.innerHTML = '<p class="sv-saved" role="status">Walk saved.</p>'; refresh(); });
          });
        });
      });

      // ----- Delete -----
      root.querySelector("#sv-list").addEventListener("click", function (e) {
        var p = e.target.closest("[data-del-pin]"), w = e.target.closest("[data-del-walk]");
        if (p && confirm("Delete this pin and its photos?")) {
          photosFor(p.dataset.delPin).then(function (ph) { return Promise.all(ph.map(function (x) { return del("photos", x.id); })); })
            .then(function () { return del("pins", p.dataset.delPin); }).then(refresh);
        }
        if (w && confirm("Delete this walk?")) del("walks", w.dataset.delWalk).then(refresh);
      });

      // ----- Export -----
      function exportZip(withPhotos) {
        status.textContent = "Packing it up…";
        buildZip(withPhotos).then(function (blob) {
          var name = "monaco-survey-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + (withPhotos ? "" : "-no-photos") + ".zip";
          var file = new File([blob], name, { type: "application/zip" });
          var size = (blob.size / 1048576).toFixed(1) + " MB";
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: "Monaco survey" }).then(function () { status.textContent = "Sent (" + size + "). Keep everything on the phone until Claude confirms it arrived."; })
              .catch(function () { download(blob, name, size); });
          } else download(blob, name, size);
        }).catch(function (x) { status.textContent = "Export failed: " + (x && x.message || "unknown problem"); });
      }
      function download(blob, name, size) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        status.textContent = "Saved to your downloads as " + name + " (" + size + "). Send that file to Claude.";
      }
      root.querySelector("#sv-export").addEventListener("click", function () { exportZip(true); });
      root.querySelector("#sv-export-lite").addEventListener("click", function () { exportZip(false); });
    }
  };

  window.MMESurvey = { screen: screen, _buildZip: buildZip };
})();
