/* Tests for the maths and the case data behind each experiment.
   Run from the project folder with:  node --test tests/
   Uses only the test runner built into Node 18 and later. */

const test = require("node:test");
const assert = require("node:assert");

const FM = require("../js/common.js");
const Accuracy = require("../js/accuracy.js");
const Overfit = require("../js/overfit.js");
const Leakage = require("../js/leakage.js");

test("normal curve helpers agree with known values", () => {
  assert.ok(Math.abs(FM.normalCdf(0, 0, 1) - 0.5) < 1e-6);
  assert.ok(Math.abs(FM.normalCdf(1.96, 0, 1) - 0.975) < 1e-3);
});

test("seeded random numbers repeat for the same seed", () => {
  const a = FM.makeRng(42);
  const b = FM.makeRng(42);
  for (let i = 0; i < 5; i++) assert.strictEqual(a(), b());
});

test("accuracy: confusion matrix counts always add up", () => {
  for (const rate of [0.5, 1, 5, 10, 30]) {
    for (const skill of [1, 5, 10]) {
      for (let t = 5; t <= 95; t++) {
        const m = Accuracy.compute(rate, t / 100, skill);
        assert.strictEqual(m.tp + m.fn, m.fraud);
        assert.strictEqual(m.fp + m.tn, m.genuine);
        assert.strictEqual(m.tp + m.fn + m.fp + m.tn, Accuracy.TOTAL);
      }
    }
  }
});

test("accuracy: the trap is real at the default setting", () => {
  const m = Accuracy.compute(1, 0.9, 5);
  assert.ok(m.accuracy > 0.98, "accuracy should look excellent");
  assert.ok(m.recall < 0.1, "recall should be terrible");
  assert.strictEqual(Accuracy.verdictFor(m).tone, "bad");
});

test("accuracy: maximizing F1 gives better recall than maximizing accuracy", () => {
  const byAccuracy = Accuracy.compute(1, Accuracy.bestThreshold(1, 5, "accuracy"), 5);
  const byF1 = Accuracy.compute(1, Accuracy.bestThreshold(1, 5, "f1"), 5);
  assert.ok(byF1.recall > byAccuracy.recall);
  assert.ok(byF1.f1 >= byAccuracy.f1);
});

test("accuracy: the challenge can be met with a strong model", () => {
  const m = Accuracy.compute(1, 0.67, 10);
  assert.ok(m.recall >= 0.8);
  assert.ok(m.precision >= 1 / 3);
});

test("accuracy: flagging nothing is reported as such", () => {
  const m = Accuracy.compute(1, 0.95, 1);
  assert.strictEqual(m.flagged, 0);
  assert.strictEqual(m.precision, null);
  assert.strictEqual(Accuracy.verdictFor(m).title, "Nothing is flagged.");
});

test("overfitting: a noiseless polynomial fit recovers the true curve", () => {
  const sample = Overfit.makeSample(7, 15);
  const clean = Overfit.valuesFor(sample, 0);
  const coef = Overfit.fit(sample.x, clean, 9);
  assert.ok(Math.abs(Overfit.predict(coef, 0.3) - Overfit.truth(0.3)) < 0.01);
});

test("overfitting: training error falls while test error has a sweet spot", () => {
  const train = Overfit.makeSample(7, 15);
  const test = Overfit.makeSample(9001, Overfit.TEST_COUNT);
  const sweep = Overfit.sweep(train, Overfit.valuesFor(train, 0.25), test, Overfit.valuesFor(test, 0.25));
  const rows = sweep.rows;
  assert.ok(sweep.best >= 2 && sweep.best <= 6, "sweet spot should be a modest degree");
  assert.ok(rows[14].train < rows[0].train, "training error should fall with complexity");
  assert.ok(rows[14].test > rows[sweep.best].test * 3, "test error should rise well past the sweet spot");
});

test("overfitting: very flexible fits on few points stay finite", () => {
  const sample = Overfit.makeSample(3, 8);
  const coef = Overfit.fit(sample.x, Overfit.valuesFor(sample, 0.25), 14);
  assert.ok(coef.every(Number.isFinite));
});

test("leakage: every case has exactly one correct option and full text", () => {
  assert.strictEqual(Leakage.CASES.length, 5);
  for (const c of Leakage.CASES) {
    assert.strictEqual(c.options.filter((o) => o.correct).length, 1, c.title);
    assert.ok(c.options.length >= 3);
    assert.ok(c.outcome && c.lesson && c.evidence && c.scenario);
  }
});

test("leakage: the correct answer is not always in the same position", () => {
  const positions = new Set(Leakage.CASES.map((c) => c.options.findIndex((o) => o.correct)));
  assert.ok(positions.size >= 3);
});

test("leakage: score messages cover every outcome", () => {
  for (let score = 0; score <= 5; score++) {
    assert.ok(Leakage.scoreMessage(score, 5).length > 20);
  }
});
