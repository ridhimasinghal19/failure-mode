/* The Accuracy Trap.
   The model is simulated with two bell curves of scores: one for genuine
   cases and one for fraud. For any threshold, the share of each group that
   lands above it comes from the normal curve, so the numbers are smooth and
   repeatable with no random sampling. */

(function (root, factory) {
  var FM = typeof module === "object" && module.exports ? require("./common.js") : root.FM;
  var api = factory(FM);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Accuracy = api;
    if (typeof document !== "undefined") api.init();
  }
})(typeof self !== "undefined" ? self : this, function (FM) {
  var TOTAL = 10000;
  var GENUINE_MEAN = 0.35;
  var SPREAD = 0.15;
  var DEFAULTS = { rate: 1, threshold: 0.9, skill: 5 };

  /* Skill 1 to 10 sets how far the fraud scores sit above the genuine ones. */
  function fraudMean(skill) {
    return GENUINE_MEAN + 0.05 + 0.045 * skill;
  }

  /* Counts and scores for one setting. rate is a percentage (1 means 1%). */
  function compute(rate, threshold, skill) {
    var fraud = Math.round((TOTAL * rate) / 100);
    var genuine = TOTAL - fraud;
    var caughtShare = 1 - FM.normalCdf(threshold, fraudMean(skill), SPREAD);
    var alarmShare = 1 - FM.normalCdf(threshold, GENUINE_MEAN, SPREAD);

    var tp = Math.round(fraud * caughtShare);
    var fn = fraud - tp;
    var fp = Math.round(genuine * alarmShare);
    var tn = genuine - fp;

    var flagged = tp + fp;
    var accuracy = (tp + tn) / TOTAL;
    var precision = flagged > 0 ? tp / flagged : null;
    var recall = fraud > 0 ? tp / fraud : null;
    var f1 = 0;
    if (precision !== null && recall !== null && precision + recall > 0) {
      f1 = (2 * precision * recall) / (precision + recall);
    }

    return {
      fraud: fraud,
      genuine: genuine,
      tp: tp,
      fn: fn,
      fp: fp,
      tn: tn,
      flagged: flagged,
      accuracy: accuracy,
      precision: precision,
      recall: recall,
      f1: f1,
      baseline: genuine / TOTAL,
    };
  }

  /* Scans the threshold slider range for the setting that scores best on a metric. */
  function bestThreshold(rate, skill, metric) {
    var best = 0.05;
    var bestValue = -1;
    for (var t = 5; t <= 95; t++) {
      var value = compute(rate, t / 100, skill)[metric];
      if (value === null) value = 0;
      if (value > bestValue + 1e-12) {
        bestValue = value;
        best = t / 100;
      }
    }
    return best;
  }

  function verdictFor(m) {
    var lost = FM.withCommas(m.fn);
    if (m.flagged === 0) {
      return {
        tone: "bad",
        title: "Nothing is flagged.",
        text:
          "Accuracy is " + FM.pct(m.accuracy) + ", exactly what a model that does nothing would score. " +
          "All " + FM.withCommas(m.fraud) + " fraud cases are missed.",
      };
    }
    if (m.recall < 0.5 && m.accuracy > 0.9) {
      return {
        tone: "bad",
        title: "High accuracy, failed job.",
        text:
          "Accuracy is " + FM.pct(m.accuracy) + ", but the model catches only " + FM.withCommas(m.tp) +
          " of " + FM.withCommas(m.fraud) + " fraud cases. " + lost + " get through. " +
          "The lazy baseline of flagging nothing scores " + FM.pct(m.baseline) + ".",
      };
    }
    if (m.precision < 0.2 && m.recall >= 0.5) {
      return {
        tone: "warn",
        title: "It catches fraud, but buries the reviewers.",
        text:
          "Recall is " + FM.pct(m.recall, 0) + ", but only " + FM.pct(m.precision, 0) + " of alerts are real. " +
          FM.withCommas(m.fp) + " false alarms for " + FM.withCommas(m.tp) + " real catches.",
      };
    }
    var extra = "";
    if (m.accuracy < m.baseline) {
      extra =
        " Notice that accuracy (" + FM.pct(m.accuracy) + ") is below the lazy baseline (" + FM.pct(m.baseline) +
        "). Accuracy calls this model worse than doing nothing, yet it is far more useful.";
    }
    return {
      tone: "good",
      title: "A more balanced trade.",
      text:
        "The model catches " + FM.withCommas(m.tp) + " of " + FM.withCommas(m.fraud) + " fraud cases, and " +
        FM.pct(m.precision, 0) + " of its alerts are real." + extra,
    };
  }

  /* ---------- browser part ---------- */

  function init() {
    var $ = function (id) {
      return document.getElementById(id);
    };
    var rate = $("rate");
    var threshold = $("threshold");
    var skill = $("skill");
    var chart = $("chart");

    function state() {
      return {
        rate: parseFloat(rate.value),
        threshold: parseFloat(threshold.value),
        skill: parseInt(skill.value, 10),
      };
    }

    function tile(label, value, note, tone) {
      return (
        '<div class="readout ' + tone + '">' +
        '<span class="readout-label">' + label + "</span>" +
        '<span class="readout-value">' + value + "</span>" +
        '<span class="readout-note">' + note + "</span></div>"
      );
    }

    function renderReadouts(m) {
      var accTone = m.accuracy > 0.9 ? "is-good" : "is-warn";
      var precTone = m.precision === null ? "" : m.precision >= 0.33 ? "is-good" : "is-bad";
      var recTone = m.recall >= 0.8 ? "is-good" : m.recall >= 0.5 ? "is-warn" : "is-bad";
      $("readouts").innerHTML =
        tile("Accuracy", FM.pct(m.accuracy), "Flagging nothing scores " + FM.pct(m.baseline), accTone) +
        tile("Precision", m.precision === null ? "n/a" : FM.pct(m.precision), "Alerts that were real", precTone) +
        tile("Recall", FM.pct(m.recall), "Fraud that was caught", recTone) +
        tile("F1", m.f1.toFixed(2), "Precision and recall blended", "");
    }

    function renderMatrix(m) {
      $("tp").textContent = FM.withCommas(m.tp);
      $("fn").textContent = FM.withCommas(m.fn);
      $("fp").textContent = FM.withCommas(m.fp);
      $("tn").textContent = FM.withCommas(m.tn);
      $("population-note").textContent =
        FM.withCommas(m.fraud) + " are really fraud and " + FM.withCommas(m.genuine) + " are genuine.";
      $("seg-fraud").style.width = (m.fraud / TOTAL) * 100 + "%";
    }

    function renderVerdict(m) {
      var v = verdictFor(m);
      var box = $("verdict");
      box.className = "callout " + (v.tone === "warn" ? "" : v.tone);
      box.innerHTML = '<p class="callout-title"></p><p></p>';
      box.children[0].textContent = v.title;
      box.children[1].textContent = v.text;
    }

    function renderGoals(m) {
      var recallOk = m.recall !== null && m.recall >= 0.8;
      var precisionOk = m.precision !== null && m.precision >= 1 / 3;
      function item(ok, text) {
        return (
          '<li><span class="goal-mark ' + (ok ? "ok" : "no") + '">' + (ok ? "Met" : "Not yet") + "</span><span>" +
          text + "</span></li>"
        );
      }
      var html =
        item(recallOk, "Catch at least 80% of fraud. Right now: " + FM.pct(m.recall, 0) + ".") +
        item(
          precisionOk,
          "Make at least 1 in 3 alerts real. Right now: " + (m.precision === null ? "no alerts" : FM.pct(m.precision, 0)) + "."
        );
      if (recallOk && precisionOk) {
        html += '<li><span class="goal-mark ok">Done</span><span>Both goals met. Notice what happened to accuracy to get here.</span></li>';
      }
      $("goals").innerHTML = html;
    }

    function renderChart(s) {
      var width = Math.max(300, chart.clientWidth);
      var height = 250;
      var m = { left: 14, right: 14, top: 22, bottom: 40 };
      var iw = width - m.left - m.right;
      var ih = height - m.top - m.bottom;
      var mu1 = fraudMean(s.skill);

      function x(v) {
        return m.left + v * iw;
      }
      function y(v) {
        return m.top + (1 - v) * ih;
      }
      function curve(mean) {
        var d = "";
        for (var i = 0; i <= 100; i++) {
          var v = i / 100;
          var h = Math.exp(-0.5 * Math.pow((v - mean) / SPREAD, 2));
          d += (i === 0 ? "M" : "L") + x(v).toFixed(1) + " " + y(h).toFixed(1) + " ";
        }
        return d;
      }
      function area(mean) {
        return curve(mean) + "L" + x(1).toFixed(1) + " " + y(0).toFixed(1) + " L" + x(0).toFixed(1) + " " + y(0).toFixed(1) + " Z";
      }

      var tx = x(s.threshold);
      var ticks = [0, 0.25, 0.5, 0.75, 1];
      var svg = '<svg viewBox="0 0 ' + width + " " + height + '" aria-hidden="true">';

      svg += '<rect x="' + tx.toFixed(1) + '" y="' + m.top + '" width="' + (x(1) - tx).toFixed(1) + '" height="' + ih +
        '" fill="#FFB43B" opacity="0.12"></rect>';

      ticks.forEach(function (t) {
        svg += '<line class="grid-line" x1="' + x(t) + '" y1="' + m.top + '" x2="' + x(t) + '" y2="' + (m.top + ih) + '"></line>';
        var anchor = t === 0 ? "start" : t === 1 ? "end" : "middle";
        svg += '<text x="' + x(t) + '" y="' + (m.top + ih + 18) + '" text-anchor="' + anchor + '">' + t.toFixed(2) + "</text>";
      });
      svg += '<line class="axis-line" x1="' + m.left + '" y1="' + y(0) + '" x2="' + x(1) + '" y2="' + y(0) + '"></line>';

      svg += '<path d="' + area(GENUINE_MEAN) + '" fill="#6F86B3" opacity="0.35"></path>';
      svg += '<path d="' + curve(GENUINE_MEAN) + '" fill="none" stroke="#6F86B3" stroke-width="2"></path>';
      svg += '<path d="' + area(mu1) + '" fill="#FF5A4E" opacity="0.35"></path>';
      svg += '<path d="' + curve(mu1) + '" fill="none" stroke="#FF5A4E" stroke-width="2"></path>';

      svg += '<line x1="' + tx + '" y1="' + (m.top - 6) + '" x2="' + tx + '" y2="' + (m.top + ih) +
        '" stroke="#FFB43B" stroke-width="3"></line>';
      var labelRight = tx > width * 0.7;
      svg += '<text class="label-strong" x="' + (labelRight ? tx - 8 : tx + 8) + '" y="' + (m.top + 8) +
        '" text-anchor="' + (labelRight ? "end" : "start") + '" fill="#FFB43B" style="fill:#FFB43B">Flagged above ' +
        s.threshold.toFixed(2) + "</text>";

      svg += '<text x="' + (m.left + iw / 2) + '" y="' + (height - 4) + '" text-anchor="middle">Model score: how fraud-like the case looks</text>';
      svg += "</svg>";
      chart.innerHTML = svg;
    }

    function update() {
      var s = state();
      $("rate-out").textContent = s.rate.toFixed(1) + "%";
      $("threshold-out").textContent = s.threshold.toFixed(2);
      $("skill-out").textContent = s.skill + " of 10";

      var m = compute(s.rate, s.threshold, s.skill);
      renderReadouts(m);
      renderMatrix(m);
      renderVerdict(m);
      renderGoals(m);
      renderChart(s);
      chart.setAttribute(
        "aria-label",
        "Score curves for genuine and fraud cases. Threshold at " + s.threshold.toFixed(2) + ". " +
          FM.withCommas(m.tp) + " fraud cases caught, " + FM.withCommas(m.fn) + " missed, " + FM.withCommas(m.fp) + " false alarms."
      );
    }

    [rate, threshold, skill].forEach(function (el) {
      el.addEventListener("input", update);
    });

    $("best-accuracy").addEventListener("click", function () {
      var s = state();
      threshold.value = bestThreshold(s.rate, s.skill, "accuracy").toFixed(2);
      update();
    });
    $("best-f1").addEventListener("click", function () {
      var s = state();
      threshold.value = bestThreshold(s.rate, s.skill, "f1").toFixed(2);
      update();
    });
    $("reset").addEventListener("click", function () {
      rate.value = DEFAULTS.rate;
      threshold.value = DEFAULTS.threshold;
      skill.value = DEFAULTS.skill;
      update();
    });

    FM.onResize(chart, function () {
      renderChart(state());
    });
    update();
  }

  return {
    compute: compute,
    bestThreshold: bestThreshold,
    verdictFor: verdictFor,
    init: init,
    TOTAL: TOTAL,
  };
});
