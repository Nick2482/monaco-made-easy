// Today's weather in Monaco, on the home screen. Free for everyone.
// The forecast comes from MET Norway through our own /api/weather (cached), and the last one is kept on the phone
// so something still shows with no signal.
(function () {
  "use strict";
  function t(s, v) { return window.MMEI18N.t(s, v); }
  function esc(s) { return window.MMEUI.esc(s); }
  var KEY = "mme-weather";
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  // MET Norway symbol codes, grouped.
  function kind(sym) {
    var s = (sym || "").replace(/_(day|night|polartwilight)$/, "");
    if (/thunder/.test(s)) return "thunder";
    if (/snow/.test(s)) return "snow";
    if (/sleet/.test(s)) return "sleet";
    if (/heavyrain/.test(s)) return "heavyrain";
    if (/showers/.test(s)) return "showers";
    if (/rain/.test(s)) return "rain";
    if (s === "fog") return "fog";
    if (s === "cloudy") return "cloudy";
    if (s === "partlycloudy" || s === "fair") return "partly";
    if (s === "clearsky") return "clear";
    return null;
  }
  var LABEL = { thunder: "Thunderstorms", snow: "Snow", sleet: "Sleet", heavyrain: "Heavy rain", showers: "Showers", rain: "Rain", fog: "Fog", cloudy: "Cloudy", partly: "Partly cloudy", clear: "Sunny", clearnight: "Clear" };
  var SUN = '<circle cx="12" cy="12" r="4.2"/><path d="M11 1.5h2v3.2h-2zm0 17.8h2v3.2h-2zM1.5 11h3.2v2H1.5zm17.8 0h3.2v2h-3.2zM4.2 5.6l1.4-1.4 2.3 2.3-1.4 1.4zm11.9 11.9 1.4-1.4 2.3 2.3-1.4 1.4zM4.2 18.4l2.3-2.3 1.4 1.4-2.3 2.3zM16.1 6.5l2.3-2.3 1.4 1.4-2.3 2.3z"/>';
  var MOON = '<path d="M14.5 2.5a9.5 9.5 0 1 0 7 15.6A8 8 0 0 1 14.5 2.5z"/>';
  var CLOUD = '<path d="M7 19.5a5 5 0 0 1-.6-10 6.5 6.5 0 0 1 12.4 1.6A4.2 4.2 0 0 1 18.5 19.5z"/>';
  var ICON = {
    clear: SUN, clearnight: MOON, cloudy: CLOUD,
    partly: '<path d="M8.5 2h1.6v2.4H8.5zM2 8.5h2.4v1.6H2zM3.6 4.7l1.1-1.1 1.7 1.7-1.1 1.1zm9.6.6 1.7-1.7 1.1 1.1-1.7 1.7zM9.3 6a3.3 3.3 0 0 1 3.1 2.2 6.6 6.6 0 0 0-5.6 3.9A3.3 3.3 0 0 1 9.3 6z"/><path d="M9 21a4.3 4.3 0 0 1-.4-8.6 5.6 5.6 0 0 1 10.7 1.4A3.6 3.6 0 0 1 19 21z"/>',
    fog: '<path d="M3 8h18v2H3zm2 4h14v2H5zm-2 4h18v2H3z"/>',
    showers: CLOUD.replace("19.5z", "15.5z").replace("M7 19.5", "M7 15.5") + '<path d="M8 17.5h1.8l-1 4H7zm4.5 0h1.8l-1 4h-1.8zm4.5 0h1.8l-1 4H16z"/>',
    thunder: CLOUD.replace("19.5z", "15.5z").replace("M7 19.5", "M7 15.5") + '<path d="M12.5 16 9 21h2.6l-.8 3 3.7-5h-2.6l.6-3z"/>',
    snow: CLOUD.replace("19.5z", "15.5z").replace("M7 19.5", "M7 15.5") + '<circle cx="8.5" cy="19.5" r="1.3"/><circle cx="12.5" cy="21.5" r="1.3"/><circle cx="16.5" cy="19.5" r="1.3"/>'
  };
  ICON.rain = ICON.heavyrain = ICON.showers; ICON.sleet = ICON.snow;

  function monacoHour(iso) {
    try { return +new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Monaco" }).format(new Date(iso)); } catch (e) { return new Date(iso).getHours(); }
  }
  function hhmm(d) {
    try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Monaco" }).format(d); } catch (e) { return ""; }
  }

  // Turns the next 24 hours into what someone planning their day wants to know.
  function summary(d) {
    var now = Date.now();
    var hrs = (d.hours || []).filter(function (h) { return Date.parse(h.t) > now - 3600e3; });
    if (!hrs.length) return null;
    var cur = hrs[0], next = hrs.slice(0, 12);
    var temps = next.map(function (h) { return h.temp; });
    var pops = next.map(function (h) { return h.pop == null ? (h.rain > 0.2 ? 60 : 0) : h.pop; });
    var wet = next.filter(function (h) { var k = kind(h.sym); return k && /rain|showers|thunder|sleet|snow/.test(k); });
    var hr = monacoHour(cur.t), night = hr >= 20 || hr < 7;
    var k = kind(cur.sym) || "partly";
    if (k === "clear" && night) k = "clearnight";
    if (k === "partly" && night) k = "clearnight";
    var s = { temp: cur.temp, kind: k, hi: Math.max.apply(null, temps), lo: Math.min.apply(null, temps), pop: Math.max.apply(null, pops), wind: cur.wind,
      gust: Math.max.apply(null, next.map(function (h) { return h.gust || h.wind || 0; })), wetNow: /rain|showers|thunder|sleet/.test(kind(cur.sym) || ""), wetLater: wet.length > 0,
      thunder: next.some(function (h) { return /thunder/.test(h.sym || ""); }) };
    // One tip, the most useful first.
    if (s.thunder) s.tip = t("Storms forecast. Indoor places in the Guide are a good plan, and the sea path may be closed.");
    else if (s.wetNow) s.tip = t("Raining now. Lifts and covered walkways help you stay dry.");
    else if (s.pop >= 50 || s.wetLater) s.tip = t("Rain likely later. Take an umbrella.");
    else if (s.gust >= 50) s.tip = t("Windy. The sea path from Cap d’Ail can close when the sea is rough.");
    else if (s.hi >= 28) s.tip = t("Hot today. Take water, and use the lifts for the climbs.");
    return s;
  }

  function strip() { return '<div class="wx" id="wx" aria-live="polite"></div>'; }

  function draw(el, d, stale) {
    var s = d && summary(d);
    if (!s) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<span class="wx-ico wx-' + s.kind + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[s.kind] || ICON.partly) + "</svg></span>" +
      '<div class="wx-main"><strong class="wx-temp">' + s.temp + "°</strong>" +
      '<span class="wx-what">' + esc(t(LABEL[s.kind] || "Partly cloudy")) + "</span>" +
      '<span class="wx-more">' + esc(t("High {hi}°, low {lo}°", { hi: s.hi, lo: s.lo })) + " · " + esc(t("Rain {n}%", { n: s.pop })) + " · " + esc(t("Wind {n} km/h", { n: s.wind })) + "</span></div>" +
      (s.tip ? '<p class="wx-tip">' + esc(s.tip) + "</p>" : "") +
      '<p class="wx-credit">' + (stale ? esc(t("Saved forecast from {time}", { time: hhmm(new Date(d.got)) })) + " · " : "") +
      esc(t("Monaco weather")) + ' · <a href="https://www.yr.no/en" target="_blank" rel="noopener">' + esc(t("Forecast: MET Norway")) + "</a></p>";
  }

  var inflight = null;
  function mount(root) {
    var el = root.querySelector("#wx");
    if (!el) return;
    var saved = load();
    var fresh = saved && Date.now() - saved.got < 30 * 60e3;
    draw(el, saved, saved && !fresh);
    if (fresh) return;
    inflight = inflight || fetch("/api/weather").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    inflight.then(function (d) {
      inflight = null;
      if (!d || !d.ok || !d.hours) return;
      d.got = Date.now(); save(d);
      if (document.body.contains(el)) draw(el, d, false);
    });
  }

  window.MMEWeather = { strip: strip, mount: mount, summary: summary, kind: kind };
})();
