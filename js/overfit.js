/* The Overfitting Playground.
   A few noisy measurements follow a smooth curve (one sine wave). The model
   is a polynomial whose degree the visitor controls. Fitting is ordinary
   least squares, solved here with a small Gaussian elimination, so there are
   no libraries. A fixed set of unseen test points measures how well each
   model does on data it was not trained on. */

(function (root, factory) {
  var FM = typeof module === "object" && module.exports ? require("./common.js") : root.FM;
  var api = factory(FM);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Overfit = api;
    if (typeof document !== "undefined") api.init();
  }
})(typeof self !== "undefined" ? self : this, function (FM) {
  var MAX_DEGREE = 14;
  var TEST_COUNT = 400;
  var DEFAULTS = { degree: 3, noise: 0.25, points: 15 };

  /* The pattern the data really follows. */
  function truth(x) {
    return Math.sin(2 * Math.PI * x);
  }

  /* Chebyshev basis on x in [0, 1]. It behaves the same as ordinary powers
     of x but stays numerically stable up to degree 14. */
  function basis(x, degree) {
    var u = 2 * x - 1;
    var row = new Array(degree + 1);
    row[0] = 1;
    if (degree >= 1) row[1] = u;
    for (var k = 2; k <= degree; k++) row[k] = 2 * u * row[k - 1] - row[k - 2];
    return row;
  }

  /* Solves the square system A c = b by Gaussian elimination with pivoting. */
  function solve(A, b) {
    var n = b.length;
    var i, j, k;
    for (i = 0; i < n; i++) {
      var pivot = i;
      for (j = i + 1; j < n; j++) {
        if (Math.abs(A[j][i]) > Math.abs(A[pivot][i])) pivot = j;
      }
      var tmpRow = A[i];
      A[i] = A[pivot];
      A[pivot] = tmpRow;
      var tmpVal = b[i];
      b[i] = b[pivot];
      b[pivot] = tmpVal;
      for (j = i + 1; j < n; j++) {
        var f = A[j][i] / A[i][i];
        for (k = i; k < n; k++) A[j][k] -= f * A[i][k];
        b[j] -= f * b[i];
      }
    }
    var c = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= A[i][j] * c[j];
      c[i] = s / A[i][i];
    }
    return c;
  }

  /* Least squares fit of a polynomial of the given degree. A tiny ridge term
     keeps the maths stable when there are fewer points than coefficients. */
  function fit(xs, ys, degree) {
    var size = degree + 1;
    var ata = [];
    var atb = new Array(size).fill(0);
    var i, j, k;
    for (i = 0; i < size; i++) ata.push(new Array(size).fill(0));
    for (k = 0; k < xs.length; k++) {
      var row = basis(xs[k], degree);
      for (i = 0; i < size; i++) {
        atb[i] += row[i] * ys[k];
        for (j = 0; j < size; j++) ata[i][j] += row[i] * row[j];
      }
    }
    for (i = 0; i < size; i++) ata[i][i] += 1e-9;
    return solve(ata, atb);
  }

  function predict(coef, x) {
    var row = basis(x, coef.length - 1);
    var y = 0;
    for (var i = 0; i < coef.length; i++) y += coef[i] * row[i];
    return y;
  }

  function rmse(coef, xs, ys) {
    var total = 0;
    for (var i = 0; i < xs.length; i++) {
      var d = predict(coef, xs[i]) - ys[i];
      total += d * d;
    }
    return Math.sqrt(total / xs.length);
  }

  /* Random positions and unit noise for one sample. The noise slider only
     scales this noise, so the points stay put while the visitor drags it. */
  function makeSample(seed, count) {
    var rng = FM.makeRng(seed);
    var xs = [];
    var i;
    for (i = 0; i < count; i++) xs.push(rng());
    xs.sort(function (a, b) {
      return a - b;
    });
    var zs = [];
    for (i = 0; i < count; i++) zs.push(FM.normalSample(rng, 0, 1));
    return { x: xs, z: zs };
  }

  function valuesFor(sample, noise) {
    return sample.x.map(function (x, i) {
      return truth(x) + noise * sample.z[i];
    });
  }

  /* Train and test error for every degree, plus the degree with the lowest
     test error (the sweet spot). */
  function sweep(train, trainY, test, testY) {
    var rows = [];
    for (var d = 0; d <= MAX_DEGREE; d++) {
      var coef = fit(train.x, trainY, d);
      rows.push({ degree: d, train: rmse(coef, train.x, trainY), test: rmse(coef, test.x, testY) });
    }
    var best = 0;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i].test < rows[best].test) best = i;
    }
    return { rows: rows, best: best };
  }

  /* Very large errors are shown as "100+" so they fit the tiles and read cleanly. */
  function fmtErr(v) {
    return v >= 100 ? "100+" : v.toFixed(2);
  }

  /* Sentence form: "about 2.4 times worse". */
  function fmtRatio(v) {
    return v >= 100 ? "more than 100" : v.toFixed(1);
  }

  /* Short form for a tile: "2.4x". */
  function fmtRatioTile(v) {
    return v >= 100 ? "100x+" : v.toFixed(1) + "x";
  }

  function diagnose(degree, best, trainErr, testErr, points) {
    var ratio = testErr / Math.max(trainErr, 1e-6);
    var crowded = degree + 1 >= points;
    var tone;
    var title;
    var text;
    if (degree <= best - 2) {
      tone = "warn";
      title = "Underfitting: the model is too simple.";
      text =
        "A degree " + degree + " curve cannot follow the pattern, so the error is high on both the training points and the unseen ones.";
    } else if (degree >= best + 2) {
      tone = "bad";
      title = "Overfitting: the model is chasing noise.";
      text =
        "Training error is " + fmtErr(trainErr) + ", but on unseen data it is " + fmtErr(testErr) + ", about " +
        fmtRatio(ratio) + " times worse. The curve bends to hit individual points that are partly random.";
    } else {
      tone = "good";
      title = "Close to the sweet spot.";
      text =
        "Training and test error are close, and test error is near its lowest. The model has captured the pattern without memorizing the noise.";
    }
    if (crowded) {
      text += " With " + (degree + 1) + " adjustable coefficients and only " + points + " points, the curve has enough freedom to pass through every training point.";
    }
    return { tone: tone, title: title, text: text, ratio: ratio };
  }

  /* ---------- browser part ---------- */

  function init() {
    var $ = function (id) {
      return document.getElementById(id);
    };
    var degreeEl = $("degree");
    var noiseEl = $("noise");
    var pointsEl = $("points");
    var showTruth = $("show-truth");
    var showTest = $("show-test");
    var fitChart = $("fit-chart");
    var errorChart = $("error-chart");

    var seed = 7;
    var sample = makeSample(seed, DEFAULTS.points);
    var testSample = makeSample(9001, TEST_COUNT);
    var current = null;

    function readState() {
      return {
        degree: parseInt(degreeEl.value, 10),
        noise: parseFloat(noiseEl.value),
        points: parseInt(pointsEl.value, 10),
      };
    }

    function compute(s) {
      if (sample.x.length !== s.points) sample = makeSample(seed, s.points);
      var trainY = valuesFor(sample, s.noise);
      var testY = valuesFor(testSample, s.noise);
      var swept = sweep(sample, trainY, testSample, testY);
      var coef = fit(sample.x, trainY, s.degree);
      current = {
        state: s,
        trainY: trainY,
        testY: testY,
        coef: coef,
        swept: swept,
        row: swept.rows[s.degree],
      };
    }

    function renderFit() {
      var s = current.state;
      var width = Math.max(300, fitChart.clientWidth);
      var height = width < 480 ? 280 : 320;
      var m = { left: 34, right: 12, top: 12, bottom: 30 };
      var iw = width - m.left - m.right;
      var ih = height - m.top - m.bottom;
      var yMin = -2;
      var yMax = 2;
      function x(v) {
        return m.left + v * iw;
      }
      function y(v) {
        return m.top + ((yMax - v) / (yMax - yMin)) * ih;
      }
      function line(fn) {
        var d = "";
        for (var i = 0; i <= 200; i++) {
          var v = i / 200;
          d += (i === 0 ? "M" : "L") + x(v).toFixed(1) + " " + y(fn(v)).toFixed(1) + " ";
        }
        return d;
      }

      var svg = '<svg viewBox="0 0 ' + width + " " + height + '" aria-hidden="true">';
      svg += '<defs><clipPath id="clip-fit"><rect x="' + m.left + '" y="' + m.top + '" width="' + iw + '" height="' + ih + '"></rect></clipPath></defs>';

      [-2, -1, 0, 1, 2].forEach(function (t) {
        svg += '<line class="grid-line" x1="' + m.left + '" y1="' + y(t) + '" x2="' + x(1) + '" y2="' + y(t) + '"></line>';
        svg += '<text x="' + (m.left - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + "</text>";
      });
      [0, 0.5, 1].forEach(function (t) {
        var anchor = t === 0 ? "start" : t === 1 ? "end" : "middle";
        svg += '<text x="' + x(t) + '" y="' + (height - 8) + '" text-anchor="' + anchor + '">' + t.toFixed(1) + "</text>";
      });

      svg += '<g clip-path="url(#clip-fit)">';
      if (showTest.checked) {
        /* The test sample is sorted by position, so take every few points
           to spread them across the whole range. */
        var step = Math.floor(TEST_COUNT / 60);
        for (var i = 0; i < 60; i++) {
          var t = i * step;
          svg += '<circle cx="' + x(testSample.x[t]).toFixed(1) + '" cy="' + y(current.testY[t]).toFixed(1) +
            '" r="3" fill="none" stroke="#4FD1A5" stroke-width="1.3" opacity="0.7"></circle>';
        }
      }
      if (showTruth.checked) {
        svg += '<path d="' + line(truth) + '" fill="none" stroke="#A0A9B8" stroke-width="2" stroke-dasharray="6 5"></path>';
      }
      svg += '<path d="' + line(function (v) {
        return predict(current.coef, v);
      }) + '" fill="none" stroke="#E8E6DF" stroke-width="3"></path>';
      for (var j = 0; j < sample.x.length; j++) {
        svg += '<circle cx="' + x(sample.x[j]).toFixed(1) + '" cy="' + y(current.trainY[j]).toFixed(1) +
          '" r="5" fill="#FFB43B" stroke="#161A22" stroke-width="1.5"></circle>';
      }
      svg += "</g></svg>";
      fitChart.innerHTML = svg;
      fitChart.setAttribute(
        "aria-label",
        "Degree " + s.degree + " curve fitted to " + s.points + " noisy training points. Training error " +
          fmtErr(current.row.train) + ", test error " + fmtErr(current.row.test) + "."
      );
    }

    function renderErrors() {
      var rows = current.swept.rows;
      var width = Math.max(300, errorChart.clientWidth);
      var height = 250;
      var m = { left: 40, right: 14, top: 16, bottom: 44 };
      var iw = width - m.left - m.right;
      var ih = height - m.top - m.bottom;
      var lo = Math.log10(0.03);
      var hi = Math.log10(5);
      function x(d) {
        return m.left + (d / MAX_DEGREE) * iw;
      }
      function y(v) {
        var c = Math.log10(FM.clamp(v, 0.03, 5));
        return m.top + ((hi - c) / (hi - lo)) * ih;
      }
      function path(key) {
        return rows
          .map(function (r, i) {
            return (i === 0 ? "M" : "L") + x(r.degree).toFixed(1) + " " + y(r[key]).toFixed(1);
          })
          .join(" ");
      }

      var svg = '<svg viewBox="0 0 ' + width + " " + height + '" aria-hidden="true">';
      [0.1, 0.3, 1, 3].forEach(function (t) {
        svg += '<line class="grid-line" x1="' + m.left + '" y1="' + y(t) + '" x2="' + x(MAX_DEGREE) + '" y2="' + y(t) + '"></line>';
        svg += '<text x="' + (m.left - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + "</text>";
      });
      [0, 2, 4, 6, 8, 10, 12, 14].forEach(function (d) {
        svg += '<text x="' + x(d) + '" y="' + (m.top + ih + 16) + '" text-anchor="middle">' + d + "</text>";
      });
      svg += '<line class="axis-line" x1="' + m.left + '" y1="' + (m.top + ih) + '" x2="' + x(MAX_DEGREE) + '" y2="' + (m.top + ih) + '"></line>';

      var cx = x(current.state.degree);
      svg += '<line x1="' + cx + '" y1="' + m.top + '" x2="' + cx + '" y2="' + (m.top + ih) + '" stroke="#E8E6DF" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.7"></line>';

      svg += '<path d="' + path("train") + '" fill="none" stroke="#FFB43B" stroke-width="2.5"></path>';
      svg += '<path d="' + path("test") + '" fill="none" stroke="#4FD1A5" stroke-width="2.5"></path>';

      var best = rows[current.swept.best];
      svg += '<circle cx="' + x(best.degree) + '" cy="' + y(best.test) + '" r="6" fill="#161A22" stroke="#4FD1A5" stroke-width="3"></circle>';
      var bestLabelRight = best.degree > 9;
      svg += '<line x1="' + x(best.degree) + '" y1="' + (m.top + 16) + '" x2="' + x(best.degree) + '" y2="' + (y(best.test) - 9) +
        '" stroke="#4FD1A5" stroke-width="1.5" opacity="0.7"></line>';
      svg += '<text class="label-strong" x="' + (x(best.degree) + (bestLabelRight ? 6 : -6)) + '" y="' + (m.top + 10) +
        '" text-anchor="' + (bestLabelRight ? "end" : "start") + '">Lowest test error: degree ' + best.degree + "</text>";

      var here = rows[current.state.degree];
      svg += '<circle cx="' + cx + '" cy="' + y(here.train) + '" r="4.5" fill="#FFB43B"></circle>';
      svg += '<circle cx="' + cx + '" cy="' + y(here.test) + '" r="4.5" fill="#4FD1A5"></circle>';

      svg += '<text x="' + (m.left + iw / 2) + '" y="' + (height - 6) + '" text-anchor="middle">Model complexity (polynomial degree)</text>';
      svg += '<text x="12" y="' + (m.top + ih / 2) + '" text-anchor="middle" transform="rotate(-90 12 ' + (m.top + ih / 2) + ')">Error (log scale)</text>';
      svg += "</svg>";
      errorChart.innerHTML = svg;
      errorChart.setAttribute(
        "aria-label",
        "Training and test error for polynomial degrees 0 to 14. Test error is lowest at degree " + best.degree + "."
      );
    }

    function tile(label, value, note, tone) {
      return (
        '<div class="readout ' + tone + '"><span class="readout-label">' + label + '</span><span class="readout-value">' +
        value + '</span><span class="readout-note">' + note + "</span></div>"
      );
    }

    function renderReadouts() {
      var s = current.state;
      var d = diagnose(s.degree, current.swept.best, current.row.train, current.row.test, s.points);
      var ratioTone = d.ratio > 2 ? "is-bad" : d.ratio > 1.4 ? "is-warn" : "is-good";
      $("readouts").innerHTML =
        tile("Training error", fmtErr(current.row.train), "On the amber points", "") +
        tile("Test error", fmtErr(current.row.test), "On unseen data", d.tone === "good" ? "is-good" : d.tone === "bad" ? "is-bad" : "is-warn") +
        tile("Test vs training", fmtRatioTile(d.ratio), "How much worse on new data", ratioTone) +
        tile("Noise floor", s.noise.toFixed(2), "Best any model can do", "");
      var box = $("verdict");
      box.className = "callout " + (d.tone === "warn" ? "" : d.tone);
      box.innerHTML = '<p class="callout-title"></p><p></p>';
      box.children[0].textContent = d.title;
      box.children[1].textContent = d.text;
    }

    function update() {
      var s = readState();
      $("degree-out").textContent = s.degree;
      $("noise-out").textContent = s.noise.toFixed(2);
      $("points-out").textContent = s.points;
      compute(s);
      renderFit();
      renderErrors();
      renderReadouts();
    }

    [degreeEl, noiseEl, pointsEl, showTruth, showTest].forEach(function (el) {
      el.addEventListener("input", update);
    });

    $("new-sample").addEventListener("click", function () {
      seed = Math.floor(Math.random() * 100000) + 1;
      sample = makeSample(seed, parseInt(pointsEl.value, 10));
      update();
    });
    $("reset").addEventListener("click", function () {
      degreeEl.value = DEFAULTS.degree;
      noiseEl.value = DEFAULTS.noise;
      pointsEl.value = DEFAULTS.points;
      showTruth.checked = true;
      showTest.checked = true;
      seed = 7;
      sample = makeSample(seed, DEFAULTS.points);
      update();
    });

    FM.onResize(fitChart, function () {
      if (current) {
        renderFit();
        renderErrors();
      }
    });
    update();
  }

  return {
    truth: truth,
    fit: fit,
    predict: predict,
    rmse: rmse,
    makeSample: makeSample,
    valuesFor: valuesFor,
    sweep: sweep,
    diagnose: diagnose,
    init: init,
    MAX_DEGREE: MAX_DEGREE,
    TEST_COUNT: TEST_COUNT,
  };
});
