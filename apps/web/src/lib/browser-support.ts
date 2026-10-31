/**
 * Runs before the app paints to decide two things:
 *
 * - how much animation the browser can comfortably handle (`data-motion`), and
 * - whether the browser is too old for the site at all.
 *
 * This is intentionally plain ES5: the browsers it targets cannot parse
 * modern syntax, so a module would never execute there. Keep the version
 * thresholds in sync with the documentation in `globals.css`; browsers at or
 * above them (roughly 2023 releases) get the full motion set.
 */
export const MOTION_BOOTSTRAP_SCRIPT = `(function () {
  var doc = document.documentElement;
  var ua = navigator.userAgent || "";
  var reduced = false;
  try {
    reduced = !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch (error) {
    reduced = false;
  }

  var ie = /MSIE\\s|Trident\\//.test(ua);
  var coreApis =
    typeof window.fetch === "function" &&
    typeof window.Promise === "function" &&
    !!doc.setAttribute;
  var unsupported = ie || !coreApis;

  var match = function (pattern) {
    var found = ua.match(pattern);
    return found ? parseFloat(found[1]) : 0;
  };
  var edge = match(/Edg(?:e|A|iOS)?\\/(\\d+)/);
  var opera = match(/OPR\\/(\\d+)/);
  var samsung = match(/SamsungBrowser\\/(\\d+)/);
  var chrome = match(/(?:Chrome|CriOS)\\/(\\d+)/);
  var firefox = match(/(?:Firefox|FxiOS)\\/(\\d+)/);
  var safari = match(/Version\\/(\\d+(?:\\.\\d+)?).*Safari/);

  var modern = false;
  if (!unsupported) {
    if (edge) modern = edge >= 110;
    else if (opera) modern = opera >= 96;
    else if (samsung) modern = samsung >= 22;
    else if (chrome) modern = chrome >= 110;
    else if (firefox) modern = firefox >= 110;
    else if (safari) modern = safari >= 16.4;
    else {
      modern =
        typeof Element !== "undefined" &&
        !!Element.prototype.animate &&
        typeof CSS !== "undefined" &&
        !!CSS.supports &&
        CSS.supports("selector(:has(*))");
    }
  }

  doc.setAttribute("data-motion", modern && !reduced ? "full" : "none");

  if (unsupported) {
    doc.className += " browser-unsupported";
    var notice = document.getElementById("browser-support-notice");
    if (notice) notice.style.display = "block";
  }
})();`;

export const MOTION_DATA_ATTRIBUTE = 'data-motion';
