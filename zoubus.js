// Live bus times. ZOU! for the hills above Monaco (timetable in zou.js, live from /api/zou) and
// Zest for the villages above Menton (timetable in zest.js, live from /api/zest).
(function () {
  "use strict";
  function t(s, v) { return window.MMEI18N.t(s, v); }
  function esc(s) { return window.MMEUI.esc(s); }
  var ZOU_BOARDS = [
    { k: "mc-armes", label: "From Monaco: Place d’Armes", stop: "Place d’Armes bus stop, by the market in La Condamine", ll: [43.73217, 7.41853], a: "Monaco" },
    { k: "mc-casino", label: "From Monaco: Office de Tourisme", stop: "Office de Tourisme bus stop, Boulevard des Moulins, above the Casino gardens", ll: [43.73986, 7.42517], a: "Monaco" },
    { k: "la-turbie", label: "From La Turbie", stop: "Mairie bus stop, in the centre of La Turbie", ll: [43.74522, 7.39976], a: "La Turbie" },
    { k: "eze-village", label: "From Èze village", stop: "Èze Village bus stop, on the main road below the village", ll: [43.72989, 7.36167], a: "Èze" },
    { k: "eze-mer", label: "From Èze-sur-Mer", stop: "Gare SNCF bus stop, by Èze-sur-Mer station", ll: [43.72254, 7.35674], a: "Èze" }
  ];
  var ZEST_BOARDS = [
    { k: "menton", label: "From Menton bus station", stop: "Menton bus station (Gare Routière), next to the train station", ll: [43.77722, 7.49413], a: "Menton" },
    { k: "agnes", label: "From Sainte-Agnès", stop: "Sainte-Agnès bus stop, at the entrance to the village", ll: [43.80134, 7.46248], a: "Sainte-Agnès" },
    { k: "gorbio", label: "From Gorbio", stop: "Gorbio bus stop, below the village square", ll: [43.78663, 7.44354], a: "Gorbio" },
    { k: "castellar", label: "From Castellar", stop: "Castellar Grande Croix bus stop, by the village", ll: [43.80577, 7.49744], a: "Castellar" }
  ];

function make(cfg) {
  var Z = cfg.data(), BOARDS = cfg.boards, P = cfg.id;
  var live = null, liveAt = 0, liveFailed = false;

  // A day in Monaco (Europe/Paris), today (0) or tomorrow (1).
  function parisParts(ms) {
    try {
      var o = {};
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
        .formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
      return { ymd: o.year + o.month + o.day, min: (+o.hour) * 60 + (+o.minute), wd: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(o.weekday) };
    } catch (e) {
      var d = new Date(ms);
      return { ymd: "" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2), min: d.getHours() * 60 + d.getMinutes(), wd: (d.getDay() + 6) % 7 };
    }
  }
  function runs(si, day) {
    var s = Z.svc[si];
    if (s[4].indexOf(day.ymd) >= 0) return false;
    if (s[3].indexOf(day.ymd) >= 0) return true;
    if (s[0].charAt(day.wd) !== "1") return false;
    if (day.ymd > Z.valid[1]) return true;   // timetable out of date: assume the same pattern carries on
    return day.ymd >= s[1] && day.ymd <= s[2];
  }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }

  function liveFor(trip, stop, seq, now) {
    if (!live || Date.now() - liveAt > 5 * 60000) return null;
    var at = live[trip + "|" + stop] || (seq != null ? live[trip + "|#" + seq] : 0);
    if (!at) return null;
    var p = parisParts(at * 1000);
    if (p.ymd !== now.ymd) return null;
    return p.min;
  }

  function next(boardKey) {
    var deps = Z.boards[boardKey] || [], now = parisParts(Date.now()), out = [];
    deps.forEach(function (d) {
      if (!runs(d[3], now)) return;
      var lv = liveFor(d[4], d[5], d[6], now);
      if (lv !== null && (lv - d[2] > 60 || d[2] - lv > 10)) lv = null;   // a prediction that far off is a fault in the feed
      var at = lv !== null ? lv : d[2];
      if (at < now.min) return;
      out.push({ r: d[0], to: d[1], sched: d[2], live: lv, at: at });
    });
    out.sort(function (a, b) { return a.at - b.at || (b.live !== null) - (a.live !== null); });
    // The open data sometimes lists the same bus twice (two overlapping calendars): keep one.
    var seen = {};
    out = out.filter(function (x) { var key = x.r + "|" + x.to + "|" + x.sched; if (seen[key]) return false; seen[key] = 1; return true; });
    var tomorrow = null;
    if (!out.length) {
      var tm = parisParts(Date.now() + 86400000);
      for (var i = 0; i < deps.length; i++) if (runs(deps[i][3], tm)) { tomorrow = deps[i]; break; }
    }
    return { now: now, list: out.slice(0, 5), tomorrow: tomorrow };
  }

  function rowHtml(x, now) {
    var mins = x.at - now.min, st;
    if (x.live === null) st = '<span class="zb-st">' + esc(t("Timetable")) + "</span>";
    else {
      var late = x.live - x.sched;
      st = '<span class="zb-st zb-live"><i aria-hidden="true"></i>' + esc(late >= 2 ? t("Live: {n} min late", { n: late }) : late <= -2 ? t("Live: {n} min early", { n: -late }) : t("Live: on time")) + "</span>";
    }
    return '<li><span class="zb-badge">' + esc(x.r) + '</span><div class="zb-to"><strong>' + esc(t(x.to)) + "</strong>" + st + "</div>" +
      '<div class="zb-time"><b>' + hhmm(x.at) + "</b>" + (mins < 60 ? "<small>" + esc(mins <= 0 ? t("now") : t("in {n} min", { n: mins })) + "</small>" : "") + "</div></li>";
  }

  function draw(el, k) {
    var b = BOARDS.filter(function (x) { return x.k === k; })[0], n = next(k), box = el.querySelector("#" + P + "-list");
    if (!b || !box) return;
    var e = { lat: b.ll[0], lng: b.ll[1], a: b.a };
    box.innerHTML = '<p class="zb-stop">' + esc(t(b.stop)) + " " + (window.MMEMap && window.MMEMap.goHtml ? window.MMEMap.goHtml(e, t(b.stop), "btn-small") : "") + "</p>" +
      (n.list.length ? '<ol class="zb-rows">' + n.list.map(function (x) { return rowHtml(x, n.now); }).join("") + "</ol>"
        : '<p class="zb-none">' + esc(t("No more buses from here today.")) + (n.tomorrow ? " " + esc(t("The first tomorrow is the {r} at {time}.", { r: n.tomorrow[0], time: hhmm(n.tomorrow[2]) })) : "") + "</p>") +
      '<p class="zb-foot">' + esc(live && Date.now() - liveAt < 5 * 60000 ? t(cfg.liveNote, { time: hhmm(parisParts(liveAt).min) })
        : liveFailed ? t("Live times aren’t available right now, so these are timetable times.") : t("Checking for live times…")) + "</p>";
  }

  function load(done) {
    if (!window.fetch || location.protocol === "file:") { liveFailed = true; done(); return; }
    fetch(cfg.api).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.u) {
        var m = {};
        j.u.forEach(function (u) { m[u[0] + "|" + u[1]] = u[2]; });
        live = m; liveAt = (j.t || Date.now() / 1000) * 1000; liveFailed = false;
      } else liveFailed = true;
      done();
    }).catch(function () { liveFailed = true; done(); });
  }

  return {
    html: function () {
      if (!Z) return "";
      return '<section class="zb" id="' + P + '"><h2>' + esc(t("Bus times")) + '</h2><p class="zb-lede">' + esc(t(cfg.lede)) + "</p>" +
        '<div class="ess-chips zb-chips" role="group" aria-label="' + esc(t("Bus stop")) + '">' + BOARDS.map(function (b, i) {
          return '<button type="button" class="chip' + (i === 0 ? " on" : "") + '" data-zb="' + b.k + '" aria-pressed="' + (i === 0) + '">' + esc(t(b.label)) + "</button>";
        }).join("") + '</div><div id="' + P + '-list" aria-live="polite"></div></section>';
    },
    mount: function (el) {
      if (!Z || !el.querySelector("#" + P)) return;
      var k = BOARDS[0].k, timer = null;
      draw(el, k);
      load(function () { draw(el, k); });
      el.querySelector(".zb-chips").addEventListener("click", function (e) {
        var c = e.target.closest("[data-zb]"); if (!c) return;
        k = c.dataset.zb;
        el.querySelectorAll("[data-zb]").forEach(function (x) { var on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); });
        draw(el, k);
        if (window.MMEStats) window.MMEStats.track(cfg.stat, { stop: k });
      });
      timer = setInterval(function () {
        if (!document.body.contains(el)) { clearInterval(timer); return; }
        load(function () { draw(el, k); });
      }, 30000);
    }
  };
}

  window.MMEZouBus = make({ id: "zb", data: function () { return window.MMEZou; }, boards: ZOU_BOARDS, api: "/api/zou", stat: "ZOU bus stop",
    lede: "ZOU! buses between Monaco, La Turbie and Èze, with live times when the bus is running.", liveNote: "Live times from ZOU! (Région Sud), updated {time}." });
  window.MMEZestBus = make({ id: "zs", data: function () { return window.MMEZest; }, boards: ZEST_BOARDS, api: "/api/zest", stat: "Zest bus stop",
    lede: "Zest buses between Menton and the villages: line 10 to Sainte-Agnès, line 5 to Gorbio and line 6 to Castellar, with live times when the bus is running.", liveNote: "Live times from Zest, updated {time}." });
})();
