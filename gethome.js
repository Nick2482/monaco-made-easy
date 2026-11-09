// Get me home: when to leave for your train or bus home tonight, counting down, with the last one of the night.
// Uses the SNCF timetable and the regional bus timetable saved on the phone, and real walking times (with lifts).
(function () {
  "use strict";
  function t(x, v) { return window.MMEI18N.t(x, v); }
  function ui() { return window.MMEUI; }
  function esc(x) { return ui().esc(x); }
  function T() { return window.MMETransit; }
  function tb(x, v) { return esc(t(x, v)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  var KEY = "mme-gethome", REMIND = 5;
  var MONACO_ST = { lat: 43.7393, lng: 7.4199 };
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  // From Èze to Menton: the stretch of coast we have walking routes for.
  function inArea(p) { return p && p.lat > 43.70 && p.lat < 43.82 && p.lng > 7.33 && p.lng < 7.54; }

  // Places people often stay outside Monaco. Nice: we take you to Nice-Ville station.
  var TOWNS = [
    { id: "nice", label: "Nice", st: "Nice-Ville" },
    { id: "menton", label: "Menton", lat: 43.77432, lng: 7.49952 },
    { id: "capdail", label: "Cap d’Ail", lat: 43.72215, lng: 7.40531 },
    { id: "roquebrune", label: "Roquebrune-Cap-Martin", lat: 43.76062, lng: 7.46900 },
    { id: "eze", label: "Èze-sur-Mer", lat: 43.72254, lng: 7.35674 }
  ];
  function town(id) {
    var x = TOWNS.filter(function (w) { return w.id === id; })[0];
    if (!x) return null;
    if (x.st) { var p = T().stationPt(x.st); return { id: x.id, label: x.label, st: x.st, lat: p.lat, lng: p.lng }; }
    return { id: x.id, label: x.label, lat: x.lat, lng: x.lng };
  }
  function stay() { var X = window.MMEExtras, h = X && X.Home.get(); return h ? { id: "stay", label: h.label, lat: h.lat, lng: h.lng } : null; }
  function dest() {
    var d = load();
    if (d && d.id === "stay") return stay() || null;
    if (d && d.id) return town(d.id);
    return stay();
  }

  function hhmm(m) { return T().hhmm(m); }
  function leaveText(mins, at) {
    if (mins <= 0) return t("Leave now");
    if (mins < 90) return t(mins === 1 ? "Leave in 1 min" : "Leave in {n} min", { n: mins });
    return t("Leave at {t}", { t: hhmm(at) });
  }

  var timer = null, reminded = {}, wake = null;
  function remindOn() { try { return localStorage.getItem("mme-gethome-remind") === "1"; } catch (e) { return false; } }
  function setRemind(on) {
    try { localStorage.setItem("mme-gethome-remind", on ? "1" : "0"); } catch (e) {}
    // Keep the screen on while the reminder is set, so the phone doesn't sleep through it.
    if (on && navigator.wakeLock && !wake) navigator.wakeLock.request("screen").then(function (w) { wake = w; w.addEventListener("release", function () { wake = null; }); }).catch(function () {});
    if (!on && wake) { wake.release(); wake = null; }
  }
  function alertNow(text) {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    try {
      if (window.speechSynthesis) {
        var u = new SpeechSynthesisUtterance(text);
        u.lang = (window.MMEI18N.lang && window.MMEI18N.lang()) || "en";
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      }
    } catch (e) {}
  }

  function pickHtml(d) {
    var s = stay(), chips = [];
    if (s) chips.push({ id: "stay", label: s.label });
    TOWNS.forEach(function (w) { chips.push({ id: w.id, label: w.label }); });
    return '<div class="gh-pick"><p class="gh-pick-h">' + esc(t("Where are you going back to?")) + '</p><div class="dests">' +
      chips.map(function (c) { return '<button type="button" class="dest' + (d && d.id === c.id ? " on" : "") + '" data-gh="' + c.id + '" aria-pressed="' + (d && d.id === c.id) + '">' + esc(t(c.label)) + "</button>"; }).join("") +
      '</div><a class="gh-change" href="#/stay">' + esc(t(s ? "Change where I’m staying" : "Somewhere else? Save where you’re staying")) + "</a></div>";
  }

  function body(d) {
    var M = window.MMEMap, here = M && M.here(), from = inArea(here) ? here : null;
    var note = from ? "" : '<p class="summary">' + esc(t(here ? "You’re not on this stretch of coast right now, so these times are from Monaco station." : "Finding where you are… until then, these times are from Monaco station.")) + "</p>";
    var start = from || MONACO_ST;
    var R = T().tonight(start, d), now = R.now, h = note;

    if (R.walkHome && R.walkHome.m <= 30) {
      return h + '<div class="gh-big gh-walk"><p class="gh-kicker">' + esc(t("You can walk back")) + '</p><p class="gh-count">' + esc(t("{n} min on foot", { n: R.walkHome.m })) + "</p>" +
        '<button type="button" class="btn btn-red" data-gh-way="home">' + esc(t("Show me the way")) + "</button></div>";
    }
    var tr = R.trains, bus = R.bus && R.bus.leave >= now.min - 1 ? R.bus : null;
    var next = tr[0] && (!bus || tr[0].leave <= bus.leave) ? { kind: "train", x: tr[0] } : bus ? { kind: "bus", x: bus } : null;
    if (next) {
      var x = next.x, mins = x.leave - now.min;
      var what = next.kind === "train"
        ? tb("**Train at {t}** from {st} towards {to}", { t: hhmm(x.dep), st: t(x.fromSt), to: x.toward }) + "<br>" +
          esc(t(d.st ? "Arrives at {st} at {a}." : "Home at about {a}.", { st: t(x.toSt), a: hhmm(d.st ? x.arr : x.home) })) + (x.walkTo > 0 ? " " + esc(t(x.walkTo === 1 ? "1 min walk to the station." : "{n} min walk to the station.", { n: x.walkTo })) : "")
        : tb("**Bus {r} at {t}** from {stop}", { r: x.L.r, t: hhmm(x.dep), stop: x.L.from }) + "<br>" + esc(t("Home at about {a}.", { a: hhmm(x.arrive) })) + " " + esc(t(x.walkTo === 1 ? "1 min walk to the stop." : "{n} min walk to the stop.", { n: x.walkTo }));
      h += '<div class="gh-big' + (mins <= REMIND ? " gh-soon" : "") + '"><p class="gh-kicker">' + esc(t("Your next way home")) + '</p><p class="gh-count">' + esc(leaveText(mins, x.leave)) + "</p>" +
        '<p class="gh-what">' + what + "</p>" +
        '<button type="button" class="btn btn-red" data-gh-way="' + next.kind + '">' + esc(t(next.kind === "train" ? "Show the way to the station" : "Show the way to the stop")) + "</button></div>";
      h += '<label class="wc-toggle gh-remind"><input type="checkbox" id="gh-remind"' + (remindOn() ? " checked" : "") + '><span class="wc-sw" aria-hidden="true"></span><span>' +
        esc(t("Remind me 5 minutes before I need to leave")) + "<small>" + esc(t("Keep this screen open: your phone will buzz and say when it’s time.")) + "</small></span></label>";
      if (remindOn() && mins <= REMIND && !reminded[x.leave]) { reminded[x.leave] = 1; alertNow(t(mins <= 0 ? "Time to leave for your train home." : "Leave in {n} minutes for your way home.", { n: mins })); }
    } else {
      var inMc = T().inMonaco ? T().inMonaco(start) : true;
      var taxi = inMc ? t("Monaco’s taxi ranks are at the station, Casino Square and the port.") : t("Monaco taxis can’t pick up in France, so call a local taxi.");
      var hr = Math.floor(now.min / 60);
      if (d.st && hr >= 6 && hr < 21) {
        // Nice with no train: the 600 bus runs along the coast road. Its timetable towards Nice isn't published in full, so point to the live times.
        h += '<div class="gh-big"><p class="gh-kicker">' + esc(t(R.noneToday ? "No trains today" : "No more trains today")) + '</p><p class="gh-count gh-count-sm">' + esc(t("Take bus 600 to Nice")) + "</p>" +
          '<p class="gh-what">' + esc(t("It runs along the coast road, about an hour to Nice. Catch it at Place d’Armes or Monte Carlo Casino; the next times are in the ZOU! app.")) + " " +
          (R.noneToday ? esc(t("SNCF has no trains planned today, which usually means engineering works or a strike.")) : "") + "</p>" +
          '<a class="btn btn-line" href="#/taxis">' + esc(t("Or a taxi")) + "</a></div>";
      } else {
        h += '<div class="gh-big gh-none"><p class="gh-kicker">' + esc(t(R.noneToday ? "No trains today, and no more buses" : "No more trains or buses tonight")) + '</p><p class="gh-what">' + esc(t("A taxi is the way home now.")) + " " + esc(taxi) + "</p>" +
          '<a class="btn btn-red" href="#/taxis">' + esc(t("Taxis")) + "</a></div>";
      }
    }
    // The other way home: the bus when the train is first, or the train when the bus is.
    if (next && next.kind === "train" && bus) h += '<p class="gh-or">' + tb("**Or bus {r} at {t}** from {stop}. Leave by {l}.", { r: bus.L.r, t: hhmm(bus.dep), stop: bus.L.from, l: hhmm(bus.leave) }) + "</p>";
    // Later trains, and the last of the night.
    var later = tr.slice(next && next.kind === "train" ? 1 : 0, (next && next.kind === "train" ? 1 : 0) + 3);
    if (later.length) h += '<h2 class="steps-h">' + esc(t("Later trains")) + '</h2><ul class="tr-board gh-later">' + later.map(function (r) {
      return '<li><b class="tr-time">' + hhmm(r.dep) + '</b><span class="tr-to">' + esc(t("from {st}", { st: t(r.fromSt) })) + "<small>" + esc(t("leave by {t}", { t: hhmm(r.leave) })) + "</small></span></li>";
    }).join("") + "</ul>";
    var L = R.last;
    if (L) {
      var gone = L.leave < now.min;
      h += '<p class="gh-last' + (gone ? " gone" : "") + '">' + (gone
        ? tb("**The last train tonight has gone** ({t} from {st}).", { t: hhmm(L.dep), st: t(L.fromSt) })
        : tb("**Last train tonight:** {t} from {st}. Leave by {l}.", { t: hhmm(L.dep), st: t(L.fromSt), l: hhmm(L.leave) })) + "</p>";
    }
    if (R.bus && R.bus.last != null) h += '<p class="gh-last">' + tb("**Last bus {r} today:** {t} from {stop}.", { r: R.bus.L.r, t: hhmm(R.bus.last), stop: R.bus.L.from }) + "</p>";
    h += '<p class="small-print">' + esc(t("Times from the SNCF and regional bus timetables saved on your phone. Trains can run late or be cancelled, so check the boards at the station.")) + "</p>";
    return h;
  }

  var screen = {
    html: function () {
      var d = dest();
      if (window.MMEPro && !window.MMEPro.isPro()) return '<section class="page gethome"><h1>' + esc(t("Get me home")) + '</h1><p class="lede-dark">' + esc(t("When to leave for your train or bus home tonight, counting down, with the last one of the night.")) + "</p>" +
        window.MMEPro.lockCard("Get me home") + "</section>";
      return '<section class="page gethome"><h1>' + esc(t("Get me home")) + '</h1><p class="lede-dark">' + esc(t("When to leave for your train or bus home tonight, counting down, with the last one of the night.")) + "</p>" +
        pickHtml(d) + '<div id="gh-body">' + (d ? "" : '<p class="summary">' + esc(t("Choose where you’re going back to.")) + "</p>") + "</div></section>";
    },
    mount: function (root) {
      var box = root.querySelector("#gh-body");
      if (!box) return;   // Pro is locked
      function draw() {
        var d = dest();
        if (!d || !document.body.contains(box)) return;
        box.innerHTML = body(d);
        var cb = box.querySelector("#gh-remind");
        if (cb) cb.addEventListener("change", function () { setRemind(cb.checked); });
      }
      root.querySelectorAll("[data-gh]").forEach(function (b) {
        b.addEventListener("click", function () {
          save({ id: b.getAttribute("data-gh") });
          root.querySelectorAll("[data-gh]").forEach(function (o) { var on = o === b; o.classList.toggle("on", on); o.setAttribute("aria-pressed", on); });
          draw();
          if (window.MMEStats) window.MMEStats.track("Get me home", { to: b.getAttribute("data-gh") });
        });
      });
      box.addEventListener("click", function (e) {
        var b = e.target.closest("[data-gh-way]");
        if (!b) return;
        var d = dest(), P = window.MMEPlanner, M = window.MMEMap, here = M && M.here();
        var R = T().tonight(inArea(here) ? here : MONACO_ST, d), kind = b.getAttribute("data-gh-way");
        if (kind === "home") P.state.to = { label: d.label, lat: d.lat, lng: d.lng, kind: "home" };
        else if (kind === "train" && R.trains[0]) P.state.to = { label: R.trains[0].fromSt, lat: R.trains[0].fromPt.lat, lng: R.trains[0].fromPt.lng, kind: "place" };
        else if (kind === "bus" && R.bus) P.state.to = { label: R.bus.L.from, lat: R.bus.L.fromPt.lat, lng: R.bus.L.fromPt.lng, kind: "place" };
        else return;
        P.state.from = null; P.state.arrival = null;
        location.hash = "#/plan";
      });
      var off = null;
      if (window.MMEMap) {
        window.MMEMap.startLocating(function () { draw(); });
        off = window.MMEMap.onLocation(function () { if (!box.dataset.located) { box.dataset.located = "1"; draw(); } });
      }
      draw();
      clearInterval(timer);
      timer = setInterval(function () {
        if (!document.body.contains(box)) { clearInterval(timer); if (off) off(); if (wake) { wake.release(); wake = null; } return; }
        draw();
      }, 20000);
      if (remindOn()) setRemind(true);
    }
  };

  window.MMEGetHome = { screen: screen };
})();
