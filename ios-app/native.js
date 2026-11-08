// Loaded first, only inside the iPhone app. The app's pages are built into the app (so it works with no signal);
// live data still comes from the website's servers.
(function () {
  "use strict";
  var SITE = "https://www.monacomadeeasy.com";
  window.MMENative = { platform: "ios", site: SITE };
  document.documentElement.classList.add("native-ios");

  // Live data (/api/...) lives on the website, not inside the app.
  var fetch0 = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.indexOf("/api/") === 0) input = SITE + input;
    return fetch0.call(this, input, init);
  };
})();
