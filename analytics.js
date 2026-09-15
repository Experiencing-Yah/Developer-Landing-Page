(function () {
  // Paste your GA4 Measurement ID from Admin → Data streams (format: G-XXXXXXXXXX).
  var MEASUREMENT_ID = "G-2X3VN4X5ST";

  window.trackGamePlay = function (gameName, playType) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "game_play", {
      game_name: gameName,
      play_type: playType,
    });
  };

  function isLocalHost() {
    var host = String(window.location.hostname || "").toLowerCase();
    return (
      window.location.protocol === "file:" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "[::1]" ||
      host === "::1" ||
      host.slice(-10) === ".localhost"
    );
  }

  if (isLocalHost() || !/^G-[A-Z0-9]+$/.test(MEASUREMENT_ID)) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID);

  var script = document.createElement("script");
  script.async = true;
  script.src =
    "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
  document.head.appendChild(script);
})();
