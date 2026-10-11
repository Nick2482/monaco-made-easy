// Languages. English text is the key; each language file adds its translations to MMEI18N.dict.
// Street, lift and stop names are left as they appear on the signs.
(function () {
  "use strict";
  var LANGS = [
    { code: "en", name: "English" },
    { code: "fr", name: "Français" },
    { code: "it", name: "Italiano" },
    { code: "de", name: "Deutsch" },
    { code: "es", name: "Español" },
    { code: "zh", name: "中文" },
    { code: "ja", name: "日本語" },
    { code: "ko", name: "한국어" },
    { code: "ru", name: "Русский" }
  ];
  var dict = {};
  var lang = "en";

  function pick() {
    var saved = null;
    try { saved = localStorage.getItem("mme-lang"); } catch (e) {}
    if (saved && LANGS.some(function (l) { return l.code === saved; })) return saved;
    var prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
    for (var i = 0; i < prefs.length; i++) {
      var c = String(prefs[i]).toLowerCase().slice(0, 2);
      if (LANGS.some(function (l) { return l.code === c; })) return c;
    }
    return "en";
  }

  function t(s, vars) {
    var out = (lang !== "en" && dict[lang] && dict[lang][s]) || s;
    if (vars) out = out.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    return out;
  }

  function apply() {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
    document.documentElement.classList.toggle("cjk", lang === "zh" || lang === "ja" || lang === "ko");
    document.querySelectorAll("[data-t]").forEach(function (el) { el.textContent = t(el.getAttribute("data-t")); });
    document.querySelectorAll("[data-t-label]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-t-label"))); });
    var btn = document.getElementById("lang-btn");
    if (btn) btn.querySelector("span").textContent = lang.toUpperCase();
  }

  function set(code) {
    lang = code;
    try { localStorage.setItem("mme-lang", code); } catch (e) {}
    apply();
    window.dispatchEvent(new Event("mme-lang"));
  }

  // The language picker in the top bar.
  function mountPicker() {
    var btn = document.getElementById("lang-btn"), sheet = document.getElementById("lang-sheet");
    if (!btn || !sheet) return;
    sheet.innerHTML = LANGS.map(function (l) {
      return '<li><button type="button" lang="' + l.code + '" data-lang="' + l.code + '">' + l.name + "</button></li>";
    }).join("");
    function close() { sheet.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      sheet.hidden = !sheet.hidden;
      btn.setAttribute("aria-expanded", String(!sheet.hidden));
      sheet.querySelectorAll("[data-lang]").forEach(function (b) { b.classList.toggle("on", b.dataset.lang === lang); });
    });
    sheet.addEventListener("click", function (e) {
      var b = e.target.closest("[data-lang]");
      if (b) { set(b.dataset.lang); close(); btn.focus(); }
    });
    document.addEventListener("click", function (e) { if (!sheet.hidden && !sheet.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) { close(); btn.focus(); } });
  }

  window.MMEI18N = {
    langs: LANGS, dict: dict, t: t, set: set,
    lang: function () { return lang; },
    init: function () { lang = pick(); apply(); mountPicker(); }
  };
})();
