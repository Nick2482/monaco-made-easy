// The guide: restaurants, cafés, bakeries, bars, supermarkets, museums and galleries, yachting and tourist information,
// each with the step-free way there. All of it is part of Pro.
(function () {
  "use strict";
  function t(s, v) { return window.MMEI18N.t(s, v); }
  function ui() { return window.MMEUI; }
  function places() { return window.MMEGuidePlaces || []; }
  function lang() { var l = window.MMEI18N.lang(); return l === "en" ? "en-GB" : l === "zh" ? "zh-CN" : l; }

  var CATS = [["eat", "Restaurants"], ["cafe", "Cafés"], ["bakery", "Bakeries"], ["bar", "Bars"], ["shop", "Supermarkets and markets"], ["tabac", "Cigars and tabacs"], ["culture", "Museums and galleries"], ["yacht", "Yachting"], ["broker", "Yacht brokers"], ["club", "Clubs"], ["info", "Tourist information"]];
  // Sections inside Restaurants.
  var GRPS = [["fine", "Michelin and fine dining"], ["french", "French and brasseries"], ["italian", "Italian and pizza"], ["seafood", "Seafood and Mediterranean"],
    ["asian", "Asian"], ["local", "Monégasque and Niçois"], ["world", "World food"], ["beach", "Beach and sea view"], ["quick", "Burgers and quick bites"]];
  var COLOR = { bakery: "#a0661a", shop: "#2f7a3d", tabac: "#6b4a2e", eat: "#9c3d54", cafe: "#7a5230", bar: "#8a2f6b", culture: "#0e7c86", yacht: "#1f4e8c", broker: "#2b6a8f", club: "#7a4f1d", info: "#4a5d70" };
  var FREE = {};
  var SUB = { museum: "Museum", gallery: "Art gallery", theatre: "Theatre", garden: "Garden", venue: "Exhibitions and events", chandlery: "Chandlery", harbour: "Harbour office", pub: "Pub", nightclub: "Nightclub",
    motor: "Motor club", yacht: "Yacht club", rowing: "Rowing club", tennis: "Tennis club", sailing: "Sailing club", hiking: "Hiking club", convenience: "Mini-market", pastry: "Pâtisserie", cocktail: "Cocktail bar", wine: "Wine bar", beachbar: "Beach bar",
    market: "Market", butcher: "Butcher and fine food", zoo: "Zoo", church: "Church", castle: "Castle", village: "Old village", tree: "Landmark", walk: "Coastal path", boats: "Boat sales and service", cigars: "Cigar shop", presse: "Newsagent and tabac", bartabac: "Bar-tabac" };
  var CUISINE = { italian: "Italian", pizza: "Pizza", burger: "Burgers", mediterranean: "Mediterranean", french: "French", japanese: "Japanese", sushi: "Sushi",
    regional: "Local dishes", local: "Local dishes", seafood: "Seafood", fish: "Seafood", international: "International", pasta: "Pasta", steak_house: "Steakhouse", grill: "Grill",
    lebanese: "Lebanese", thai: "Thai", indian: "Indian", mexican: "Mexican", tacos: "Tacos", asian: "Asian", chinese: "Chinese", peruvian: "Peruvian", ice_cream: "Ice cream",
    coffee_shop: "Coffee", sandwich: "Sandwiches", salad: "Salads", british: "British", belgian: "Belgian", italian_pizza: "Pizza", roman: "Italian", venezuelan: "Venezuelan", argentinian: "Argentinian", vegan: "Vegan", crepe: "Crêpes", vietnamese: "Vietnamese", portuguese: "Portuguese", spanish: "Spanish", creole: "Creole" };

  // ---------- Opening hours (OpenStreetMap format) ----------
  var DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayName(i) { try { return new Intl.DateTimeFormat(lang(), { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i, 12))); } catch (e) { return DAYS[i]; } }
  function monthName(i) { try { return new Intl.DateTimeFormat(lang(), { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, i, 15, 12))); } catch (e) { return MONTHS[i]; } }
  function niceHours(h) {
    return h.split(/\s*;\s*/).map(function (r) {
      return r.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, function (d) { return dayName(DAYS.indexOf(d)); })
        .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, function (m) { return monthName(MONTHS.indexOf(m)); })
        .replace(/\boff\b/g, t("closed")).replace(/\bPH\b/g, t("public holidays")).replace(/-/g, "–").replace(/,(?=\S)/g, ", ").replace(/:\s*$/, "");
    }).join(" · ");
  }
  // Is it open right now? Only answers for simple weekly hours; anything else returns null (we don't guess).
  function openNow(h) {
    if (!h || /[A-Z][a-z]{2}\b|PH|SH|sunrise|sunset|week|\+|"/.test(h.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, ""))) return null;
    var T = window.MMETransit, now = T && T.monacoNow ? T.monacoNow() : null;
    if (!now || now.wd < 0) return null;
    var today = null, yesterday = null, prevWd = (now.wd + 6) % 7;
    var rules = h.split(/\s*;\s*/);
    for (var i = 0; i < rules.length; i++) {
      // "a, b" (a comma before a day) adds to the same rule; ";" starts a rule that replaces earlier ones.
      var parts = rules[i].trim().split(/,\s+(?=(?:Mo|Tu|We|Th|Fr|Sa|Su)\b)/), first = true;
      for (var j = 0; j < parts.length; j++) {
        var m = /^(?:((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+)?(off|closed|24\/7|\d{1,2}:\d\d-\d{1,2}:\d\d(?:,\d{1,2}:\d\d-\d{1,2}:\d\d)*)$/.exec(parts[j].trim());
        if (!m) return null;
        var days = m[1] ? dayset(m[1]) : [0, 1, 2, 3, 4, 5, 6];
        var spans = m[2] === "24/7" ? [[0, 1440]] : /off|closed/.test(m[2]) ? [] : m[2].split(",").map(function (s) {
          var p = s.split("-"); return [mins(p[0]), mins(p[1])];
        });
        var add = !first;
        if (days.indexOf(now.wd) >= 0) today = add && today ? today.concat(spans) : spans;
        if (days.indexOf(prevWd) >= 0) yesterday = add && yesterday ? yesterday.concat(spans) : spans;
        first = false;
      }
    }
    if (today === null) today = [];
    var open = today.some(function (s) { return s[1] > s[0] ? now.min >= s[0] && now.min < s[1] : now.min >= s[0]; }) ||
      (yesterday || []).some(function (s) { return s[1] <= s[0] && now.min < s[1]; });
    return open;
  }
  function mins(s) { var p = s.split(":"); return (+p[0]) * 60 + (+p[1]); }
  function dayset(s) {
    var out = [];
    s.split(",").forEach(function (part) {
      var p = part.split("-"), a = DAYS.indexOf(p[0]), b = p[1] ? DAYS.indexOf(p[1]) : a;
      for (var i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b) break; }
    });
    return out;
  }

  // ---------- Text for one place ----------
  function subtitle(e) {
    var bits = [];
    if (e.cu) {
      var c = e.cu.split(";").map(function (x) { return CUISINE[x.trim()]; }).filter(Boolean);
      c = c.filter(function (x, i) { return c.indexOf(x) === i; }).slice(0, 2).map(function (x) { return t(x); });
      if (c.length) bits.push(c.join(", "));
    }
    if (!bits.length && e.grp) { var g0 = GRPS.filter(function (g) { return g[0] === e.grp[e.grp[0] === "fine" && e.grp[1] ? 1 : 0]; })[0]; if (g0 && g0[0] !== "fine") bits.push(t(g0[1])); }
    if (e.sub && SUB[e.sub]) bits.push(t(SUB[e.sub]));
    else if (e.k === "shop") bits.push(t("Supermarket"));
    else if (e.k === "tabac" && e.n !== "Tabac") bits.push(t("Tabac"));
    if (e.k === "broker") bits.push(t("Yacht sales and charter"));
    if (e.addr) bits.push(e.addr);
    bits.push(t(e.a));
    return bits.join(" · ");
  }
  function hoursLine(e) {
    if (e.hx) return t(e.hx);
    if (e.h) return niceHours(e.h);
    return "";
  }
  // ---------- My places (saved on this phone) ----------
  var FAVK = "mme-favs";
  function favKey(e) { return e.n + "|" + (+e.lat).toFixed(4) + "|" + (+e.lng).toFixed(4); }
  function favs() { try { return JSON.parse(localStorage.getItem(FAVK) || "[]"); } catch (x) { return []; } }
  function isFav(e) { return favs().indexOf(favKey(e)) >= 0; }
  function toggleFav(key) {
    var f = favs(), i = f.indexOf(key);
    if (i >= 0) f.splice(i, 1); else f.push(key);
    try { localStorage.setItem(FAVK, JSON.stringify(f)); } catch (x) {}
    return i < 0;
  }
  function webHost(w) { return w.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, ""); }
  function itemHtml(e, d, w) {
    var esc = ui().esc, open = e.hx ? null : openNow(e.h), hrs = hoursLine(e);
    var webUrl = e.w && /^https?:\/\//.test(e.w) ? e.w : e.w ? "https://" + e.w : "";
    return '<li class="g-item"><span class="step-ico" style="--c:' + COLOR[e.k] + '">' + ui().icon(e.k) + "</span><div>" +
      "<strong>" + esc(t(e.n)) + (e.pick ? ' <b class="g-pick">★ ' + esc(t("Our pick")) + "</b>" : "") +
        (e.mich ? ' <b class="g-mich" title="' + esc(t(e.mich === 1 ? "1 Michelin star" : "{n} Michelin stars", { n: e.mich })) + '">' + new Array(e.mich + 1).join("★") + " Michelin</b>" : "") + "</strong><span>" + esc(subtitle(e)) + "</span>" +
      (e.d ? '<p class="g-desc">' + esc(t(e.d)) + "</p>" : "") +
      (hrs || open !== null ? '<span class="g-hours">' + (open === true ? '<b class="g-open">' + esc(t("Open now")) + "</b> " : open === false ? '<b class="g-shut">' + esc(t("Closed now")) + "</b> " : "") + esc(hrs) + "</span>" : "") +
      (e.wc === "yes" ? '<span class="g-wc">' + esc(t("Wheelchair accessible")) + "</span>" : "") +
      (w ? "<small>" + esc(t("{d} away, about {n} min walk", { d: window.MMEMap.niceDistance(w.metres), n: w.minutes })) + "</small>" : "") +
      '<span class="g-links">' + (e.ph ? '<a href="tel:' + esc(e.ph.replace(/[^+\d]/g, "")) + '">' + esc(e.ph) + "</a>" : "") +
      (webUrl ? '<a href="' + esc(webUrl) + '" target="_blank" rel="noopener">' + esc(webHost(webUrl)) + "</a>" : "") +
      '<button type="button" class="g-fav' + (isFav(e) ? " on" : "") + '" data-fav="' + esc(favKey(e)) + '" aria-pressed="' + isFav(e) + '">' + (isFav(e) ? "♥ " + esc(t("Saved")) : "♡ " + esc(t("Save"))) + "</button>" +
      '<button type="button" class="g-gm" data-gq="' + esc([e.n, e.addr, e.a].filter(Boolean).join(", ")) + '" data-ll="' + e.lat + "," + e.lng + '">' + esc(t("Reviews on Google")) + "</button></span></div>" +
      '<button type="button" class="map-mini" data-goto="' + e.lat + "," + e.lng + '" data-label="' + esc(e.n) + '">' + esc(t("Take me there")) + "</button></li>";
  }

  var VIRT = { find: "Search everything", saved: "My places" };
  function currentCat() { var c = (location.hash.split("/")[2] || "").split("?")[0]; return COLOR[c] || VIRT[c] ? c : "eat"; }
  function currentGrp(cat) { var g = (location.hash.split("/")[3] || "").split("?")[0]; return cat === "eat" && GRPS.some(function (x) { return x[0] === g; }) ? g : ""; }
  function inCat(e, cat, grp) {
    if (cat === "find") return true;
    if (cat === "saved") return isFav(e);
    return e.k === cat && (!grp || (e.grp || []).indexOf(grp) >= 0);
  }
  function catName(k) { var c = CATS.filter(function (x) { return x[0] === k; })[0]; return c ? c[1] : ""; }
  // Everything a visitor might type to find a place: name, kind, cuisine, section, area, street.
  function hay(e) {
    return [t(e.n), e.n, subtitle(e), t(catName(e.k)), catName(e.k), e.addr || "", e.d ? t(e.d) : "",
      (e.grp || []).map(function (g) { var x = GRPS.filter(function (y) { return y[0] === g; })[0]; return x ? t(x[1]) + " " + x[1] : ""; }).join(" "),
      (e.cu || "").replace(/[;_]/g, " "), e.sub || ""].join(" ").toLowerCase();
  }

  // Google's own page for a place (rating, reviews, photos) in a sheet over the app, so the visitor never leaves it.
  function googleSheet(q, ll) {
    var esc = ui().esc, old = document.getElementById("gm-sheet");
    if (old) old.remove();
    var src = "https://maps.google.com/maps?q=" + encodeURIComponent(q) + "&ll=" + encodeURIComponent(ll) + "&z=17&hl=" + encodeURIComponent(window.MMEI18N.lang()) + "&output=embed";
    var d = document.createElement("div");
    d.id = "gm-sheet"; d.className = "gm-sheet"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", t("Reviews on Google"));
    d.innerHTML = '<div class="gm-box"><div class="gm-head"><strong>' + esc(q.split(", ")[0]) + '</strong><button type="button" class="gm-close" aria-label="' + esc(t("Close")) + '">✕</button></div>' +
      (navigator.onLine === false ? '<p class="gm-off">' + esc(t("You’re offline. Google reviews need a connection.")) + "</p>"
        : '<iframe title="' + esc(t("Reviews on Google")) + '" src="' + esc(src) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>') +
      '<p class="gm-note">' + esc(t("Google’s rating and map for this place. For all reviews and photos, tap “View larger map”, then Back to return here.")) + "</p></div>";
    function close() { d.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(ev) { if (ev.key === "Escape") close(); }
    d.addEventListener("click", function (ev) { if (ev.target === d || ev.target.closest(".gm-close")) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(d);
    d.querySelector(".gm-close").focus();
    if (window.MMEStats) window.MMEStats.track("Google reviews opened");
  }

  var screen = {
    html: function () {
      var esc = ui().esc, cat = currentCat(), grp = currentGrp(cat), P = window.MMEPro, locked = !FREE[cat] && P && !P.isPro();
      var all = places().filter(function (e) { return inCat(e, cat, grp); });
      return '<section class="mapscreen guide g-' + cat + '">' +
        '<div class="map-wrap"><div id="g-map" class="map" role="application" aria-label="' + esc(t("Map")) + '"></div>' +
        '<button type="button" class="find-me" id="g-find"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-1-7h2v3.06A8 8 0 0 1 19.94 11H23v2h-3.06A8 8 0 0 1 13 19.94V23h-2v-3.06A8 8 0 0 1 4.06 13H1v-2h3.06A8 8 0 0 1 11 4.06zm1 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>' + esc(t("Find the nearest")) + "</button></div>" +
        '<div class="near"><div class="ess-chips" role="group" aria-label="' + esc(t("Guide")) + '">' +
          [["find", "🔍 " + t("Search")], ["saved", "♥ " + t("My places")]].map(function (c) {
            return '<a class="chip chip-virt' + (c[0] === cat ? " on" : "") + '" href="#/guide/' + c[0] + '"' + (c[0] === cat ? ' aria-current="true"' : "") + ">" + esc(c[1]) + "</a>";
          }).join("") + CATS.map(function (c) {
          return '<a class="chip' + (c[0] === cat ? " on" : "") + '" href="#/guide/' + c[0] + '"' + (c[0] === cat ? ' aria-current="true"' : "") + ">" + esc(t(c[1])) + "</a>";
        }).join("") + "</div>" +
        (cat === "eat" ? '<div class="ess-chips g-grps" role="group" aria-label="' + esc(t("Restaurants")) + '"><a class="chip' + (!grp ? " on" : "") + '" href="#/guide/eat"' + (!grp ? ' aria-current="true"' : "") + ">" + esc(t("All")) + "</a>" +
          GRPS.map(function (g) { return '<a class="chip' + (g[0] === grp ? " on" : "") + '" href="#/guide/eat/' + g[0] + '"' + (g[0] === grp ? ' aria-current="true"' : "") + ">" + esc(t(g[1])) + "</a>"; }).join("") + "</div>" : "") +
        "<h1>" + esc(t(VIRT[cat] || (grp ? GRPS.filter(function (g) { return g[0] === grp; })[0][1] : catName(cat)))) + (FREE[cat] ? "" : " " + (P ? P.badge() : "")) + "</h1>" +
        (cat === "yacht" ? '<img class="pg-photo g-photo" src="img/yachts-quay.jpg" width="1200" height="675" loading="lazy" alt="' + esc(t("Yachts moored in Monaco")) + '">' : "") +
        (grp === "fine" ? '<p class="lede-dark">' + esc(t("Stars from the Michelin Guide 2026. Book well ahead, and expect a dress code.")) + "</p>" : "") +
        (cat === "broker" ? '<aside class="note note-ess"><p>' + esc(t("These are offices. Call or email ahead to arrange a visit.")) + "</p></aside>" : "") +
        ((cat === "yacht" || cat === "broker" || cat === "club") && window.MMEExtras ? window.MMEExtras.yachtsBox() : "") +
        '<p class="lede-dark" id="g-sub">' + esc(cat === "saved" ? t("Places you’ve saved on this phone.") : cat === "find" ? t("Every place in the guide: restaurants, cafés, bars, shops, tabacs, museums and more.") : t("{n} in Monaco and nearby, each with the step-free way there.", { n: all.length })) + "</p>" +
        ((all.length > 12 || cat === "find") && !locked ? '<input class="g-search" id="g-search" type="search" placeholder="' + esc(t(cat === "find" ? "Try “sushi”, “tabac” or a name" : "Search by name or food")) + '" aria-label="' + esc(t("Search by name or food")) + '"' + (cat === "find" ? " autofocus" : "") + ">" : "") +
        (!locked && cat !== "saved" || (cat === "saved" && all.length) ? '<div class="g-tools"><button type="button" class="chip g-open-btn" id="g-open" aria-pressed="false">🕘 ' + esc(t("Open now")) + "</button></div>" : "") +
        '<p class="loc-error" id="g-err" hidden></p><ul class="lifts g-list" id="g-list"></ul>' +
        (locked && P ? P.lockCard("See every place, with opening hours and the step-free way there") : "") +
        '<p class="unchecked">' + esc(t("Places come from OpenStreetMap and local listings. Opening times change, so check before you go.")) + "</p>" +
        '<p class="g-addbiz"><a href="business.html">' + esc(t("Own a business here? Add it to the guide")) + "</a></p></div></section>";
    },
    mount: function (root) {
      var M = window.MMEMap, cat = currentCat(), grp = currentGrp(cat), P = window.MMEPro, locked = !FREE[cat] && P && !P.isPro();
      var all = places().filter(function (e) { return inCat(e, cat, grp); });
      if (window.MMEExtras) window.MMEExtras.mountYachts(root);
      var map = M.makeMap(root.querySelector("#g-map"));
      var icon = function (e) { return L.divIcon({ className: "", html: '<span class="mk mk-ess' + (all.length > 30 ? " mk-g" : "") + '" style="background:' + COLOR[e.k] + '">' + ui().icon(e.k) + "</span>", iconSize: all.length > 30 ? [22, 22] : [30, 30], iconAnchor: all.length > 30 ? [11, 11] : [15, 15], popupAnchor: [0, -12] }); };
      all.forEach(function (e, i) {
        var mk = L.marker([e.lat, e.lng], { icon: icon(e), title: t(e.n), keyboard: true, zIndexOffset: 500 }).addTo(map);
        if (!locked) mk.bindPopup('<div class="lift-pop"><strong>' + ui().esc(t(e.n)) + "</strong><br>" + ui().esc(subtitle(e)) + '<br><button type="button" class="pop-go" data-goto="' + e.lat + "," + e.lng + '" data-label="' + ui().esc(e.n) + '">' + ui().esc(t("Take me there")) + "</button></div>");
        else mk.on("click", function () { location.hash = "#/pro"; });
      });
      if (all.length) { var b = L.latLngBounds(all.map(function (e) { return [e.lat, e.lng]; })); map.fitBounds(b.pad(0.1), { maxZoom: 17 }); }
      var list = root.querySelector("#g-list"), pos = null, q = "", onlyOpen = false;
      function draw() {
        var esc = ui().esc;
        if (cat === "saved" && !all.length) { list.innerHTML = '<li class="more-note">' + esc(t("Nothing saved yet. Tap “♡ Save” on any place in the guide to keep it here.")) + "</li>"; return; }
        if (cat === "find" && !q) { list.innerHTML = '<li class="more-note">' + esc(t("Type above to search all {n} places.", { n: all.length })) + "</li>"; return; }
        var words = q.split(/\s+/).filter(Boolean);
        var items = all.filter(function (e) {
          if (cat === "saved" && !isFav(e)) return false;
          if (!words.length) return true;
          var h = hay(e);
          return words.every(function (w) { return h.indexOf(w) >= 0; });
        }).map(function (e) { return { e: e, d: pos ? M.distance(pos, e) : null, o: e.hx ? null : openNow(e.h) }; });
        if (onlyOpen) items = items.filter(function (it) { return it.o !== false; });
        if (pos) {
          // Real walking times by the easiest route (lifts, escalators, the hills) for the nearer places;
          // the straight-line distance only decides which ones are worth working out.
          items.sort(function (a, b) { return a.d - b.d; });
          items.slice(0, 60).forEach(function (it) { it.w = M.walkTo(pos, it.e); });
          items.sort(function (a, b) { return (a.w ? a.w.minutes : 1e9) - (b.w ? b.w.minutes : 1e9) || a.d - b.d; });
        }
        else items.sort(function (a, b) { return (b.e.mich || 0) - (a.e.mich || 0) || (b.e.star || 0) - (a.e.star || 0) || (b.e.d ? 1 : 0) - (a.e.d ? 1 : 0); });
        // Open now: places we know are open first, then the ones whose hours we don't know (never hidden).
        if (onlyOpen) { var kn = items.filter(function (it) { return it.o === true; }), un = items.filter(function (it) { return it.o !== true; }); items = kn.concat(un); }
        var shown = locked ? items.slice(0, 3) : items.slice(0, q || cat === "saved" ? 60 : onlyOpen ? 40 : 25);
        var firstUnknown = onlyOpen ? shown.findIndex(function (it) { return it.o !== true; }) : -1;
        list.innerHTML = (onlyOpen && firstUnknown !== 0 ? '<li class="g-sec">' + esc(t("Open now")) + "</li>" : "") + shown.map(function (it, i) {
            return (i === firstUnknown ? '<li class="g-sec">' + esc(t("Hours not known")) + '<small>' + esc(t("We don’t have opening hours for these yet. Call ahead or check the door.")) + "</small></li>" : "") + itemHtml(it.e, it.d, it.w);
          }).join("") +
          (!locked && items.length > shown.length ? '<li class="more-note">' + ui().esc(t(pos ? "The {s} closest of {n}. All of them are on the map." : "{s} of {n}. All of them are on the map.", { s: shown.length, n: items.length })) + "</li>" : "") +
          (!items.length ? '<li class="more-note">' + ui().esc(t("Nothing matches that search.")) + "</li>" : "");
      }
      draw();
      var s = root.querySelector("#g-search");
      if (s) s.addEventListener("input", function () { q = s.value.trim().toLowerCase(); draw(); });
      var ob = root.querySelector("#g-open");
      if (ob) ob.addEventListener("click", function () { onlyOpen = !onlyOpen; ob.classList.toggle("on", onlyOpen); ob.setAttribute("aria-pressed", String(onlyOpen)); draw(); if (window.MMEStats && onlyOpen) window.MMEStats.track("Open now filter"); });
      var me = null, stop = null;
      function locate() {
        var errBox = root.querySelector("#g-err");
        M.startLocating(function (msg) { errBox.textContent = msg; errBox.hidden = false; });
        stop = M.onLocation(function (p) {
          if (!document.body.contains(root)) { if (stop) stop(); return; }
          if (!me) me = L.marker([p.lat, p.lng], { icon: M.meIcon, interactive: false, zIndexOffset: 1000 }).addTo(map); else me.setLatLng([p.lat, p.lng]);
          var inArea = M.distance(p, { lat: 43.7375, lng: 7.4235 }) < 6000;
          pos = inArea ? p : null;
          if (inArea) root.querySelector("#g-sub").textContent = t("Sorted by distance from where you are now.");
          draw();
        });
      }
      root.querySelector("#g-find").addEventListener("click", locate);
      locate();
      root.addEventListener("click", function (e) {
        var fv = e.target.closest("[data-fav]");
        if (fv) { var added = toggleFav(fv.dataset.fav); if (window.MMEStats) window.MMEStats.track(added ? "Place saved" : "Place unsaved"); draw(); return; }
        var gm = e.target.closest("[data-gq]");
        if (gm) { googleSheet(gm.dataset.gq, gm.dataset.ll); return; }
        var b = e.target.closest("[data-goto]");
        if (!b) return;
        var ll = b.dataset.goto.split(",");
        window.MMEPlanner.state.to = { label: b.dataset.label, lat: +ll[0], lng: +ll[1], kind: "place" };
        window.MMEPlanner.state.from = null; window.MMEPlanner.state.arrival = null;
        if (window.MMEStats) window.MMEStats.track("Guide place", { type: cat });
        location.hash = "#/plan";
      });
      if (window.MMEStats) window.MMEStats.track("Guide", { type: cat, locked: !!locked });
      setTimeout(function () { map.invalidateSize(); }, 50);
    }
  };

  window.MMEGuide = { screen: screen, CATS: CATS, COLOR: COLOR, openNow: openNow, niceHours: niceHours };
})();
