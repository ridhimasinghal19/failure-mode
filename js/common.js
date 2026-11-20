/* Failure Mode: small helpers shared by every page.
   Nothing here needs a library. The functions that do maths are plain
   functions with no DOM access, so they can be tested outside a browser. */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FM = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  /* Seeded random numbers (mulberry32), so a given seed always gives the
     same data. This keeps the demos repeatable. */
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* One sample from a normal distribution (Box-Muller). */
  function normalSample(rng, mean, sd) {
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* Normal cumulative distribution function (Abramowitz and Stegun 7.1.26). */
  function normalCdf(x, mean, sd) {
    const z = (x - mean) / (sd * Math.SQRT2);
    const sign = z < 0 ? -1 : 1;
    const az = Math.abs(z);
    const t = 1 / (1 + 0.3275911 * az);
    const poly =
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    const erf = 1 - poly * Math.exp(-az * az);
    return 0.5 * (1 + sign * erf);
  }

  function normalPdf(x, mean, sd) {
    const z = (x - mean) / sd;
    return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function pct(v, digits) {
    return (v * 100).toFixed(digits === undefined ? 1 : digits) + "%";
  }

  function withCommas(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /* Calls fn now and again whenever the element changes width, so the SVG
     charts stay sharp at every screen size. */
  function onResize(el, fn) {
    fn();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", fn);
      return;
    }
    let lastWidth = el.clientWidth;
    new ResizeObserver(function () {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fn();
      }
    }).observe(el);
  }

  return {
    makeRng: makeRng,
    normalSample: normalSample,
    normalCdf: normalCdf,
    normalPdf: normalPdf,
    clamp: clamp,
    pct: pct,
    withCommas: withCommas,
    onResize: onResize,
  };
});
