# Failure Mode

Interactive experiments that show how machine learning models fail quietly, and how to catch it.

A model can report 99% accuracy and still miss every case that matters. Failure Mode lets you see that happen, then change the settings and see why.

## The three experiments

| Page | What fails | What you do |
|---|---|---|
| **The Accuracy Trap** | A high score on rare events hides a useless model | Move a decision threshold and watch accuracy, precision, recall and F1 pull apart |
| **The Overfitting Playground** | The model memorizes noise instead of learning the pattern | Raise model complexity and find where error on unseen data turns upward |
| **The Leakage Detective** | Information from the answer sneaks into training | Investigate five cases and name the hidden mistake in each |

## How it is built

- Plain HTML, CSS and JavaScript. No frameworks, no build step, no dependencies.
- Charts are hand-written SVG, drawn in the browser.
- The maths is real and written from scratch:
  - Normal distribution functions for the threshold and score curves
  - Polynomial least squares (Chebyshev basis, solved with Gaussian elimination) for the overfitting demo
  - Seeded random numbers, so every sample is repeatable
- Accessible by design: keyboard navigable, visible focus rings, ARIA labels on charts, live regions for results, and respect for reduced motion preferences.
- Responsive from phone to desktop.
- All colors and fonts live in CSS variables at the top of `style.css`, so a restyle is a one-block change.

## Run it locally

Open `index.html` in any modern browser. Nothing needs to be installed.

## Run the tests

The maths and the case data have automated tests. They need Node 18 or later and nothing else:

```
node --test
```

## Publish it with GitHub Pages

1. Create a new repository on GitHub and upload all files in this folder.
2. Open the repository's **Settings**, then **Pages**.
3. Under **Build and deployment**, set the source to **Deploy from a branch**.
4. Choose the `main` branch and the `/ (root)` folder, then save.
5. After a minute the site is live at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## Project structure

```
index.html            Home page
accuracy-trap.html    Experiment 1
overfitting.html      Experiment 2
leakage.html          Experiment 3
style.css             Shared styles and design tokens
logo.svg              Logo and favicon
js/common.js          Seeded random numbers, normal distribution, helpers
js/home.js            Home page dot grid
js/accuracy.js        Accuracy Trap logic and interface
js/overfit.js         Overfitting logic and interface
js/leakage.js         Case data and interface for the Leakage Detective
tests/logic.test.js   Automated tests
```

## Ideas for extending it

- A fourth experiment on distribution shift, where the live data drifts away from the training data
- A bias simulator showing how skewed training data changes who a model approves
- A page on how a language model picks its next word, with a temperature slider
