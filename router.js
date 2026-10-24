// Route planning over Monaco's walking network (built from OpenStreetMap).
// Finds the easiest way on foot, preferring lifts and escalators over steps, and writes plain directions.
(function () {
  "use strict";
  var G = window.MMEGraph;
  if (!G) return;

  var N = G.n.length / 2;
  var lat = new Float64Array(N), lng = new Float64Array(N);
  for (var i = 0; i < N; i++) { lat[i] = G.n[2 * i] / 1e6; lng[i] = G.n[2 * i + 1] / 1e6; }
  var liftAt = G.lifts; // node index -> { name, level, ... }

  // Edge fields: [a, b, metres, type, nameIdx, dir, up, stepCount, geometry]
  // type: 0 road, 1 footpath, 2 steps, 3 escalator, 4 lift, 5 indoor corridor
  var adj = [];
  for (i = 0; i < N; i++) adj.push([]);
  G.e.forEach(function (e, k) {
    if (e[5] !== 2) adj[e[0]].push(k);           // a -> b allowed
    if (e[5] !== 1) adj[e[1]].push(-k - 1);      // b -> a allowed (negative = reversed)
  });

  // Nodes reached only by steps make poor starting points.
  var stepsOnly = new Uint8Array(N).fill(1);
  G.e.forEach(function (e) { if (e[3] !== 2) { stepsOnly[e[0]] = 0; stepsOnly[e[1]] = 0; } });

  // Quick lookup grid for "nearest point on the network".
  var CELL = 0.0015, grid = {};
  for (i = 0; i < N; i++) {
    var key = Math.floor(lat[i] / CELL) + ":" + Math.floor(lng[i] / CELL);
    (grid[key] = grid[key] || []).push(i);
  }
  function metres(aLat, aLng, bLat, bLng) {
    var R = 6371000, r = Math.PI / 180, dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function nearest(p) {
    var gy = Math.floor(p.lat / CELL), gx = Math.floor(p.lng / CELL), best = -1, bd = Infinity;
    for (var ring = 1; ring <= 4 && best < 0; ring++) {
      for (var y = gy - ring; y <= gy + ring; y++) for (var x = gx - ring; x <= gx + ring; x++) {
        (grid[y + ":" + x] || []).forEach(function (n) {
          if (liftAt[n]) return; // never start inside a lift
          var d = metres(p.lat, p.lng, lat[n], lng[n]) + (stepsOnly[n] ? 30 : 0);
          if (d < bd) { bd = d; best = n; }
        });
      }
    }
    return best < 0 ? null : { node: best, d: metres(p.lat, p.lng, lat[best], lng[best]) };
  }

  // Every network point within r metres of p.
  function nearby(p, r) {
    var gy = Math.floor(p.lat / CELL), gx = Math.floor(p.lng / CELL), out = [];
    for (var y = gy - 2; y <= gy + 2; y++) for (var x = gx - 2; x <= gx + 2; x++)
      (grid[y + ":" + x] || []).forEach(function (n) { if (metres(p.lat, p.lng, lat[n], lng[n]) <= r) out.push(n); });
    return out;
  }

  // ---------- Heights: free terrain tiles (AWS Terrain Tiles, Terrarium format) ----------
  // Each pixel stores height above sea level. Loaded once, then kept offline by the service worker.
  var height = null;
  var TZ = 14, TILES_X = [8528, 8529, 8530], TILES_Y = [5972, 5973, 5974, 5975];
  var TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/";
  function loadTile(x, y) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          var c = document.createElement("canvas"); c.width = 256; c.height = 256;
          var ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
          resolve({ x: x, y: y, px: ctx.getImageData(0, 0, 256, 256).data });
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = TILE_URL + TZ + "/" + x + "/" + y + ".png";
    });
  }
  var ready = new Promise(function (resolve) {
    if (typeof document === "undefined") { resolve(false); return; }
    var jobs = [];
    TILES_X.forEach(function (x) { TILES_Y.forEach(function (y) { jobs.push(loadTile(x, y)); }); });
    var timer = setTimeout(function () { resolve(false); }, 8000);
    Promise.all(jobs).then(function (tiles) {
      var byKey = {};
      tiles.forEach(function (t) { if (t) byKey[t.x + "/" + t.y] = t.px; });
      if (!Object.keys(byKey).length) { clearTimeout(timer); resolve(false); return; }
      var scale = Math.pow(2, TZ) * 256;
      function sample(wx, wy) {
        var tx = Math.floor(wx / 256), ty = Math.floor(wy / 256), px = byKey[tx + "/" + ty];
        if (!px) return NaN;
        var ix = Math.min(255, Math.max(0, Math.floor(wx - tx * 256))), iy = Math.min(255, Math.max(0, Math.floor(wy - ty * 256)));
        var o = (iy * 256 + ix) * 4;
        return px[o] * 256 + px[o + 1] + px[o + 2] / 256 - 32768;
      }
      height = new Float32Array(N);
      for (var i = 0; i < N; i++) {
        var wx = (lng[i] + 180) / 360 * scale;
        var sy = Math.sin(lat[i] * Math.PI / 180);
        var wy = (0.5 - Math.log((1 + sy) / (1 - sy)) / (4 * Math.PI)) * scale;
        // Smooth a little (2x2) so a single pixel doesn't spoil a street.
        var hs = [sample(wx - 0.5, wy - 0.5), sample(wx + 0.5, wy - 0.5), sample(wx - 0.5, wy + 0.5), sample(wx + 0.5, wy + 0.5)].filter(isFinite);
        height[i] = hs.length ? Math.max(0, hs.reduce(function (a, b) { return a + b; }, 0) / hs.length) : NaN;
      }
      clearTimeout(timer);
      resolve(true);
    });
  });
  function climb(u, v) {
    if (!height) return 0;
    var d = height[v] - height[u];
    return isFinite(d) ? d : 0;
  }

  // How long each piece takes (seconds) and how much we dislike it.
  var WALK = 1.2;    // metres per second, an easy pace
  function legCost(e, forward, avoidSteps) {
    var len = e[2], t = e[3], up = forward ? e[6] : -e[6];
    var secs;
    if (t === 2) secs = len / 0.45 + 10;
    else if (t === 3) secs = len / 0.75 + 10;
    else if (t === 4) secs = 50;
    else secs = len / WALK;
    var cost = secs;
    if (t === 2 && avoidSteps) cost += 240 + len * 12;           // steps: avoid hard
    if (up > 0 && (t === 0 || t === 1)) cost += len * (avoidSteps ? 1.4 : 0.6); // uphill streets feel longer
    return { secs: secs, cost: cost };
  }
  var LIFT_WAIT = 45;
  function fw0(k) { return k >= 0 ? k : -k - 1; }

  function route(from, to, opts) {
    opts = opts || {};
    var avoid = opts.avoidSteps !== false;
    var s = nearest(from), g = nearest(to);
    if (!s || !g) return null;
    // Lifts and escalators that visitors have reported out of order are left out.
    var blockN = null, blockE = null;
    if (opts.blocked && opts.blocked.length) {
      blockN = {}; blockE = {};
      var near = function (n) { return opts.blocked.some(function (b) { return metres(b.lat, b.lng, lat[n], lng[n]) < 40; }); };
      Object.keys(liftAt).forEach(function (n) { if (near(+n)) blockN[n] = 1; });
      G.e.forEach(function (e, k) { if ((e[3] === 3 || e[3] === 4) && (near(e[0]) || near(e[1]))) blockE[k] = 1; });
    }
    var dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(0), seen = new Uint8Array(N);
    dist[s.node] = 0;
    // Binary heap of [cost, node]
    var heap = [[0, s.node]];
    // Wheelchair or pushchair: the closest point may be on a stairway, so also start from any point within 100 m (the walk there counts).
    // Never "start" across a cliff: the extra points must be at about the same height as the closest one.
    function sameLevel(a, b) { return !height || !isFinite(height[a]) || !isFinite(height[b]) || Math.abs(height[a] - height[b]) < 6; }
    nearby(from, opts.wheelchair ? 50 : 35).forEach(function (n) {
      if (liftAt[n] || n === s.node || !sameLevel(n, s.node)) return;
      var c0 = metres(from.lat, from.lng, lat[n], lng[n]) * 3;
      if (c0 < dist[n]) { dist[n] = c0; heap.push([c0, n]); }
    });
    heap.sort(function (a, b) { return a[0] - b[0]; });
    function push(item) { heap.push(item); var c = heap.length - 1; while (c > 0) { var p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; var tmp = heap[p]; heap[p] = heap[c]; heap[c] = tmp; c = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var c = 0; for (;;) { var l = 2 * c + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; var tmp = heap[m]; heap[m] = heap[c]; heap[c] = tmp; c = m; } } return top; }
    while (heap.length) {
      var cur = pop(), u = cur[1];
      if (seen[u]) continue;
      seen[u] = 1;
      if (u === g.node && !opts.wheelchair) break;
      var list = adj[u];
      for (var j = 0; j < list.length; j++) {
        var k = list[j], fwd = k >= 0, e = G.e[fwd ? k : -k - 1];
        var v = fwd ? e[1] : e[0];
        if (seen[v]) continue;
        if (blockN && (blockN[v] || blockE[fw0(k)])) continue;
        // Wheelchair or pushchair: no steps, no escalators, no lifts marked as not wheelchair-accessible.
        if (opts.wheelchair && (e[3] === 2 || e[3] === 3 || (liftAt[v] && liftAt[v].wheelchair === "no"))) continue;
        var c = legCost(e, fwd, avoid).cost + (liftAt[v] ? LIFT_WAIT : 0);
        // Climbing on foot (not by lift or escalator) costs about 10 seconds a metre for an easy walker.
        if (e[3] !== 3 && e[3] !== 4) {
          var up = climb(u, v);
          if (up > 0) c += up * (avoid ? 12 : 7);
          // Wheelchair or pushchair: steep streets are the real obstacle, uphill and downhill. Keep to the gentle ones and the lifts.
          if (opts.wheelchair && e[2] > 0) { var grade = Math.abs(up) / e[2]; if (up > 0) c += up * 25; if (grade > 0.05) c += e[2] * (grade - 0.05) * 400; }
        }
        if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = k >= 0 ? k + 1 : k; push([dist[v], v]); }
      }
    }
    // Wheelchair or pushchair: if the closest point can only be reached by steps, end at the nearest point that can be reached
    // without them (the last few metres are shown as a dotted line).
    if (opts.wheelchair && !isFinite(dist[g.node])) {
      var bestN = -1, bestC = Infinity;
      nearby(to, 60).forEach(function (n) { if (!liftAt[n] && isFinite(dist[n]) && sameLevel(n, g.node)) { var cc = dist[n] + metres(to.lat, to.lng, lat[n], lng[n]) * 3; if (cc < bestC) { bestC = cc; bestN = n; } } });
      if (bestN >= 0) g = { node: bestN, d: metres(to.lat, to.lng, lat[bestN], lng[bestN]) };
    }
    if (!isFinite(dist[g.node])) return null;
    // Walk back from the end.
    var legs = [], n = g.node;
    while (prev[n] !== 0) {
      var pk = prev[n], fw = pk > 0, ed = G.e[fw ? pk - 1 : -pk - 1];
      legs.push({ e: ed, fwd: fw, to: n, from: fw ? ed[0] : ed[1] });
      n = fw ? ed[0] : ed[1];
    }
    legs.reverse();
    if (n !== s.node) s = { node: n, d: metres(from.lat, from.lng, lat[n], lng[n]) };   // started from a nearby point instead
    var out = describe(legs, s, g, from, to);
    // Street names used, e.g. to warn when a route crosses the Grand Prix circuit.
    var used = {};
    legs.forEach(function (lg) { var nm = G.names[lg.e[4]]; if (nm) used[nm] = 1; });
    out.streets = Object.keys(used);
    // Where the route rides a lift or escalator (to spot ones that have been reported out of order).
    out.liftPts = [];
    legs.forEach(function (lg) {
      if (liftAt[lg.to]) out.liftPts.push({ lat: lat[lg.to], lng: lng[lg.to] });
      if (lg.e[3] === 3 || lg.e[3] === 4) out.liftPts.push({ lat: lat[lg.from], lng: lng[lg.from] }, { lat: lat[lg.to], lng: lng[lg.to] });
    });
    return out;
  }

  function edgePoints(leg) {
    var e = leg.e, pts = [[lat[e[0]], lng[e[0]]]];
    for (var i = 0; i < e[8].length; i += 2) pts.push([e[8][i] / 1e6, e[8][i + 1] / 1e6]);
    pts.push([lat[e[1]], lng[e[1]]]);
    return leg.fwd ? pts : pts.reverse();
  }

  // Turn the list of pieces into a few plain sentences.
  function describe(legs, s, g, from, to) {
    var steps = [], secs = 0, metresTotal = 0, nSteps = 0, nLifts = 0, nEsc = 0, climbed = 0, saved = 0;
    var lines = []; // [{type, pts}]
    function add(kind, data, at) {
      var last = steps[steps.length - 1];
      if (kind === "walk" && last && last.kind === "walk") { last.m += data.m; last.secs += data.secs; last.rise += data.rise || 0; addName(last, data.name, data.m); return; }
      var st = { kind: kind, m: data.m || 0, secs: data.secs || 0, names: {}, up: data.up || 0, count: data.count || 0, lift: data.lift || null, rise: data.rise || 0, at: at };
      if (kind === "walk") addName(st, data.name, data.m);
      steps.push(st);
    }
    function addName(st, name, m) { if (name) st.names[name] = (st.names[name] || 0) + m; }

    legs.forEach(function (leg, i) {
      var e = leg.e, t = e[3], c = legCost(e, leg.fwd, true), up = leg.fwd ? e[6] : -e[6];
      var name = G.names[e[4]];
      var dh = climb(leg.from, leg.to);
      secs += c.secs; metresTotal += e[2];
      if (t === 3 || t === 4) { if (dh > 0) saved += dh; } else if (dh > 0) { climbed += dh; secs += dh * 4; }
      var kind = t === 2 ? "steps" : t === 3 ? "escalator" : t === 4 ? "lift" : "walk";
      lines.push({ kind: kind, pts: edgePoints(leg) });
      var at0 = [lat[leg.from], lng[leg.from]];
      if (kind === "steps") { nSteps++; add("steps", { m: e[2], secs: c.secs, up: up || (dh > 2 ? 1 : dh < -2 ? -1 : 0), count: e[7] }, at0); }
      else if (kind === "escalator") { nEsc++; add("escalator", { m: e[2], secs: c.secs, up: up }, at0); }
      else if (kind === "lift") { nLifts++; add("lift", { secs: c.secs, lift: { name: name } }, at0); }
      else add("walk", { m: e[2], secs: c.secs, name: name, rise: dh }, at0);
      // Passing through a lift between two different pieces of path = riding the lift.
      var lf = liftAt[leg.to];
      if (lf && i < legs.length - 1) {
        nLifts++; secs += LIFT_WAIT;
        var after = legs[i + 1], dl = climb(leg.to, after.to);
        add("lift", { secs: LIFT_WAIT, lift: lf, up: dl > 3 ? 1 : dl < -3 ? -1 : 0 }, [lat[leg.to], lng[leg.to]]);
      }
    });

    // Merge repeated steps/escalators that follow each other.
    var merged = [];
    steps.forEach(function (st) {
      var last = merged[merged.length - 1];
      if (last && last.kind === st.kind && st.kind !== "lift") { last.m += st.m; last.secs += st.secs; last.count += st.count; last.up = last.up || st.up; last.rise += st.rise; return; }
      if (last && last.kind === "lift" && st.kind === "lift" && !st.lift.name) return; // same lift, two levels
      merged.push(st);
    });
    // Drop tiny walks between two vertical pieces (under 15 m) into "then".
    var out = merged.filter(function (st) { return !(st.kind === "walk" && st.m < 12); });

    var T = function (x, v) { return window.MMEI18N ? window.MMEI18N.t(x, v) : x; };
    var text = out.map(function (st) {
      if (st.kind === "walk") {
        var top = Object.keys(st.names).sort(function (a, b) { return st.names[b] - st.names[a]; }).slice(0, 2);
        var m = Math.max(10, Math.round(st.m / 10) * 10);
        var streets = top.length === 2 ? T("{a}, then {b}", { a: top[0], b: top[1] }) : top[0];
        var up = Math.round(st.rise / 5) * 5;
        var key = st.rise > 12 ? (streets ? "Walk {m} m uphill (about {h} m up) along {streets}." : "Walk {m} m uphill (about {h} m up) along the footpath.")
          : st.rise < -12 ? (streets ? "Walk {m} m downhill along {streets}." : "Walk {m} m downhill along the footpath.")
          : (streets ? "Walk {m} m along {streets}." : "Walk {m} m along the footpath.");
        return { kind: "walk", text: T(key, { m: m, h: up, streets: streets }), m: st.m, at: st.at };
      }
      if (st.kind === "lift") {
        var l = st.lift || {};
        var dir = st.up > 0 ? " up" : st.up < 0 ? " down" : "";
        var line = l.name ? T("Take the public lift “{name}”" + dir + ".", { name: l.name }) : T("Take the public lift" + dir + ".");
        return { kind: "lift", text: line + (l.desc ? " (" + l.desc + ")" : ""), at: st.at };
      }
      if (st.kind === "escalator") return { kind: "escalator", text: T("Take the escalator" + (st.up > 0 ? " up" : st.up < 0 ? " down" : "") + "."), at: st.at };
      var sd = st.up > 0 ? " going up" : st.up < 0 ? " going down" : "";
      return { kind: "steps", text: st.count ? T("{n} steps" + sd + ".", { n: st.count }) : T("Steps" + sd + "."), at: st.at };
    });

    var pre = s.d > 40 ? Math.round(s.d) : 0, post = g.d > 40 ? Math.round(g.d) : 0;
    return {
      minutes: Math.max(1, Math.round((secs + (pre + post) / WALK) / 60)),
      metres: Math.round(metresTotal + pre + post),
      steps: nSteps, lifts: nLifts, escalators: nEsc, stepFree: nSteps === 0,
      climbed: Math.round(climbed), saved: Math.round(saved), heights: !!height,
      directions: text, lines: lines,
      startGap: pre, endGap: post,
      start: [lat[s.node], lng[s.node]], end: [lat[g.node], lng[g.node]]
    };
  }

  // Best station exit for a destination: try each exit, keep the easiest.
  function fromStation(to, opts) {
    var best = null;
    (G.station || []).forEach(function (x) {
      var r = route({ lat: x.lat, lng: x.lng }, to, opts);
      if (r && (!best || r.minutes + (r.steps ? 4 : 0) < best.r.minutes + (best.r.steps ? 4 : 0))) best = { exit: x, r: r };
    });
    return best;
  }


  // Walking time from one place to everywhere (one search), for "how far is each place in the Guide".
  // Same preferences as route(): lifts and escalators first, steps avoided where there's a sensible way round.
  function timesFrom(from, opts) {
    opts = opts || {};
    var avoid = opts.avoidSteps !== false;
    var s = nearest(from);
    if (!s) return null;
    var dist = new Float64Array(N).fill(Infinity), secsA = new Float64Array(N), mA = new Float64Array(N), seen = new Uint8Array(N);
    dist[s.node] = 0;
    var heap = [[0, s.node]];
    function push(item) { heap.push(item); var c = heap.length - 1; while (c > 0) { var p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; var tmp = heap[p]; heap[p] = heap[c]; heap[c] = tmp; c = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var c = 0; for (;;) { var l = 2 * c + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; var tmp = heap[m]; heap[m] = heap[c]; heap[c] = tmp; c = m; } } return top; }
    var LIMIT = 3600 * 3; // stop once everything within reach is found
    while (heap.length) {
      var cur = pop(), u = cur[1];
      if (seen[u]) continue;
      seen[u] = 1;
      if (cur[0] > LIMIT) break;
      var list = adj[u];
      for (var j = 0; j < list.length; j++) {
        var k = list[j], fwd = k >= 0, e = G.e[fwd ? k : -k - 1];
        var v = fwd ? e[1] : e[0];
        if (seen[v]) continue;
        if (opts.wheelchair && (e[3] === 2 || e[3] === 3 || (liftAt[v] && liftAt[v].wheelchair === "no"))) continue;
        var lc = legCost(e, fwd, avoid), c = lc.cost + (liftAt[v] ? LIFT_WAIT : 0), sec = lc.secs + (liftAt[v] ? LIFT_WAIT : 0);
        if (e[3] !== 3 && e[3] !== 4) { var up = climb(u, v); if (up > 0) { c += up * (avoid ? 12 : 7); sec += up * 4; } }
        if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; secsA[v] = secsA[u] + sec; mA[v] = mA[u] + e[2]; push([dist[v], v]); }
      }
    }
    var pre = s.d > 40 ? s.d : 0;
    // Returns { minutes, metres } to a place, or null when it can't be reached on foot.
    return function (to) {
      var g = nearest(to);
      if (!g || !isFinite(dist[g.node])) return null;
      var post = g.d > 40 ? g.d : 0;
      return { minutes: Math.max(1, Math.round((secsA[g.node] + (pre + post) / WALK) / 60)), metres: Math.round(mA[g.node] + pre + post) };
    };
  }

  function heightAt(p) { var n = nearest(p); return height && n ? Math.round(height[n.node]) : null; }

  window.MMERouter = { route: route, timesFrom: timesFrom, fromStation: fromStation, nearest: nearest, ready: ready, heightAt: heightAt };
})();
