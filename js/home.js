/* Home page: builds the dot grid and plays the one-time "model passes
   everything" sweep. The numbers shown next to the grid are in the HTML, so
   the message still works if this script does not run. */

(function () {
  var grid = document.getElementById("dotgrid");
  if (!grid) return;

  var COLUMNS = 40;
  var ROWS = 20;

  /* Eight fixed positions for the fraud cases, spread out so they are easy to spot. */
  var fraudAt = {};
  [37, 142, 215, 333, 408, 521, 640, 733].forEach(function (i) {
    fraudAt[i] = true;
  });

  var fragment = document.createDocumentFragment();
  for (var i = 0; i < COLUMNS * ROWS; i++) {
    var dot = document.createElement("span");
    dot.className = fraudAt[i] ? "dot fraud" : "dot";
    dot.style.setProperty("--col", i % COLUMNS);
    fragment.appendChild(dot);
  }
  grid.appendChild(fragment);

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    grid.classList.add("done");
  } else {
    window.setTimeout(function () {
      grid.classList.add("scan");
    }, 700);
  }
})();
