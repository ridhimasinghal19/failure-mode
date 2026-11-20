/* The Leakage Detective.
   Five short cases, each with a result that looks too good. The visitor
   picks the hidden mistake, then reads what really happened. The case text
   lives in the CASES list below, so adding a sixth case means adding one
   more object. */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Leakage = api;
    if (typeof document !== "undefined") api.init();
  }
})(typeof self !== "undefined" ? self : this, function () {
  var CASES = [
    {
      title: "The flight that was never late enough to miss",
      scenario:
        "A team builds a model to predict whether a flight will arrive more than 15 minutes late. They train it on a table of past flights and keep a test set aside.",
      reported: "99.2%",
      reportedLabel: "accuracy on the test set",
      evidenceTitle: "Columns used as inputs",
      evidence:
        "airline, origin, destination\n" +
        "scheduled_departure, weather_score\n" +
        "aircraft_age, taxi_time_min\n" +
        "arrival_delay_min\n" +
        "\n" +
        "Target: arrived_late = (arrival_delay_min > 15)",
      options: [
        {
          text: "The dataset is too small for the model to learn anything real.",
          why: "Small data usually lowers scores. It rarely produces an almost perfect one.",
        },
        {
          text: "arrival_delay_min is only known after the flight lands, and the target is calculated from it.",
          why: "The answer was handed to the model as an input.",
          correct: true,
        },
        {
          text: "There are too many airlines, so the model memorized them.",
          why: "Many categories can cause overfitting, but not a near perfect score on held out data.",
        },
        {
          text: "The model is not complex enough.",
          why: "A weaker model would score lower, not higher.",
        },
      ],
      outcome:
        "In real use the model could not see arrival_delay_min, because the flight had not landed yet. Without that column accuracy fell to 78%.",
      lesson:
        "For every input, ask whether the value will exist at the moment the prediction is needed. If not, remove it. This is called target leakage.",
    },
    {
      title: "Choosing features on every row",
      scenario:
        "A team has survey answers from 100 customers, with 5,000 columns each, and wants to predict who will renew. They pick the 20 columns that match the answer best, then split the data and train.",
      reported: "88%",
      reportedLabel: "accuracy on the test set",
      evidenceTitle: "The pipeline",
      evidence:
        "X_best = select_top_20_features(X, y)     # looks at every row\n" +
        "X_train, X_test = train_test_split(X_best)\n" +
        "model.fit(X_train, y_train)\n" +
        "model.score(X_test, y_test)               # 0.88",
      options: [
        {
          text: "Twenty features is too few for 100 customers.",
          why: "Fewer features rarely inflate a score.",
        },
        {
          text: "The test set was too large.",
          why: "A larger test set gives steadier scores, not inflated ones.",
        },
        {
          text: "The feature selection step saw the test rows, so the chosen columns were picked partly because they matched the test answers.",
          why: "With 5,000 columns, some match any answer by chance. Choosing them using the test rows bakes that luck into the score.",
          correct: true,
        },
        {
          text: "The split ratio was wrong.",
          why: "A different ratio would not create a gap this large.",
        },
      ],
      outcome:
        "Run on new customers the model scored 52%, no better than a coin toss. The columns it relied on had matched the test rows by chance.",
      lesson:
        "Anything that learns from data, including choosing features, scaling and filling gaps, must be fitted on the training rows only. Split first, then process.",
    },
    {
      title: "Predicting tomorrow with next week's data",
      scenario:
        "A shop forecasts daily sales for the next day. The team shuffles two years of daily records, uses 80% for training and keeps 20% for testing.",
      reported: "0.96",
      reportedLabel: "R squared on the test days",
      evidenceTitle: "The split",
      evidence:
        "daily_sales = load(\"sales_2023_2024.csv\")\n" +
        "train, test = train_test_split(daily_sales, shuffle=True)\n" +
        "\n" +
        "# A test day such as 14 March 2024 is surrounded by\n" +
        "# training days from 13 March and 15 March.",
      options: [
        {
          text: "Shuffling mixed future days into the training set, so the model had already seen the days around each test day.",
          why: "Sales on neighbouring days are very similar, so the model only had to fill in the gaps.",
          correct: true,
        },
        {
          text: "Daily sales cannot be predicted at all.",
          why: "Sales are often forecastable, which is why forecasting is a field of its own.",
        },
        {
          text: "Two years of data is too little to test on.",
          why: "Less data makes scores noisier. It does not make them look better.",
        },
        {
          text: "The test set should have been shuffled a second time.",
          why: "Shuffling again changes nothing about the overlap between neighbouring days.",
        },
      ],
      outcome:
        "Used for real, the model only ever sees the past. Forecasting the next day, R squared dropped to 0.41.",
      lesson:
        "When data has an order in time, split by time: train on earlier days and test on later ones, just as the model will be used.",
    },
    {
      title: "The same customer on both sides",
      scenario:
        "A support team trains a model to mark chat messages as urgent. They have 40,000 messages from 2,000 customers and split the messages randomly into training and test sets.",
      reported: "97%",
      reportedLabel: "accuracy on test messages",
      evidenceTitle: "The data",
      evidence:
        "messages:   40,000 rows       customers:  2,000 (about 20 messages each)\n" +
        "split:      random 80/20 over rows\n" +
        "check:      1,988 of 2,000 customers appear in both train and test",
      options: [
        {
          text: "Twenty messages per customer is too few.",
          why: "That is plenty to learn from. The trouble is where the messages ended up.",
        },
        {
          text: "Urgent messages are too rare in the data.",
          why: "Rare classes cause the accuracy trap, but they do not explain a gap between test and new customers.",
        },
        {
          text: "The model was trained for too long.",
          why: "More training would not by itself explain the drop for new customers.",
        },
        {
          text: "The same customers appear in both sets, so the model learned individual customers' habits instead of general patterns.",
          why: "Test messages were not truly new, because the model had already read other messages from the same people.",
          correct: true,
        },
      ],
      outcome:
        "For customers the model had never seen, accuracy was 71%. The 97% mostly measured how well it recognized people.",
      lesson:
        "When rows come in groups, such as customers, patients or devices, keep each group entirely in training or entirely in test.",
    },
    {
      title: "Tuning on the exam",
      scenario:
        "A team tries 300 combinations of model settings. For each one they measure accuracy on the test set, then report the score of the best combination.",
      reported: "93%",
      reportedLabel: "best accuracy on the test set",
      evidenceTitle: "The search",
      evidence:
        "best = 0\n" +
        "for settings in all_300_combinations:\n" +
        "    model = train(settings, X_train, y_train)\n" +
        "    score = evaluate(model, X_test, y_test)\n" +
        "    if score > best:\n" +
        "        best = score              # 0.93\n" +
        "report(best)",
      options: [
        {
          text: "Three hundred combinations is not enough to find good settings.",
          why: "More searching would make the problem worse, not better.",
        },
        {
          text: "The test set was used to choose the winner, so the reported score is the best of 300 tries, not an honest estimate.",
          why: "Among 300 tries, the top score is partly luck. The test set stopped being unseen data.",
          correct: true,
        },
        {
          text: "Test accuracy can never be higher than training accuracy.",
          why: "It can be, and that is not what went wrong here.",
        },
        {
          text: "The training set was too small.",
          why: "A small training set would lower the real performance, not inflate the reported score.",
        },
      ],
      outcome:
        "On fresh data the chosen model scored 84%. Several of the 300 settings were equally good, and the winner was the one that got lucky on the test set.",
      lesson:
        "Choose settings with a separate validation set or cross validation, and touch the test set once, at the very end.",
    },
  ];

  var HABITS = [
    "Treat a surprisingly good score as a reason to investigate, not to celebrate.",
    "Split the data first, then do everything that learns from it on the training rows only.",
    "Split the way the model will really be used: by time, or by customer, never just at random.",
    "Keep the test set locked away until the final check, and look at it once.",
  ];

  function scoreMessage(score, total) {
    if (score === total) {
      return "Spotless. You found every hidden mistake. Real projects rarely announce theirs this clearly.";
    }
    if (score >= total - 1) {
      return "Very sharp. One case got past you, which is how it goes in real reviews too.";
    }
    if (score >= Math.ceil(total / 2)) {
      return "A solid start. Read the explanations on the cases you missed, since the same patterns keep coming back.";
    }
    return "Leakage is hard to see, which is why it is so common. Play again and look for what the model could not really have known.";
  }

  /* ---------- browser part ---------- */

  function init() {
    var rootEl = document.getElementById("case-root");
    if (!rootEl) return;

    var index = 0;
    var results = [];

    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function progress() {
      var list = el("ol", "progress");
      list.setAttribute("aria-label", "Progress through the cases");
      CASES.forEach(function (c, i) {
        var li = el("li");
        if (results[i] === true) li.className = "right";
        else if (results[i] === false) li.className = "wrong";
        else if (i === index) li.className = "current";
        var label = "Case " + (i + 1) + ": " + (results[i] === true ? "solved" : results[i] === false ? "missed" : i === index ? "current" : "to do");
        li.appendChild(el("span", "sr-only", label));
        list.appendChild(li);
      });
      return list;
    }

    function renderCase() {
      var c = CASES[index];
      rootEl.textContent = "";
      rootEl.appendChild(progress());

      var card = el("section", "card");
      card.setAttribute("aria-labelledby", "case-title");

      card.appendChild(el("p", "case-count", "Case " + (index + 1) + " of " + CASES.length));
      var title = el("h2", "", c.title);
      title.id = "case-title";
      title.tabIndex = -1;
      card.appendChild(title);
      card.appendChild(el("p", "", c.scenario));

      var report = el("div", "report");
      report.appendChild(el("span", "report-value", c.reported));
      report.appendChild(el("span", "report-label", c.reportedLabel));
      card.appendChild(report);

      card.appendChild(el("p", "evidence-title", c.evidenceTitle));
      card.appendChild(el("pre", "evidence", c.evidence));

      card.appendChild(el("p", "evidence-title", "What went wrong?"));
      var list = el("ul", "options");
      var buttons = [];
      c.options.forEach(function (opt, i) {
        var li = el("li");
        var btn = el("button", "option");
        btn.type = "button";
        btn.appendChild(el("span", "option-text", opt.text));
        btn.addEventListener("click", function () {
          answer(i, buttons, card);
        });
        buttons.push(btn);
        li.appendChild(btn);
        list.appendChild(li);
      });
      card.appendChild(list);

      var explain = el("div", "callout lesson");
      explain.id = "explain";
      explain.hidden = true;
      explain.tabIndex = -1;
      explain.setAttribute("aria-live", "polite");
      card.appendChild(explain);

      var actions = el("div", "case-actions");
      actions.id = "actions";
      card.appendChild(actions);

      rootEl.appendChild(card);
      title.focus({ preventScroll: true });
    }

    function answer(choice, buttons, card) {
      var c = CASES[index];
      var correctIndex = c.options.findIndex(function (o) {
        return o.correct;
      });
      var right = choice === correctIndex;
      results[index] = right;

      buttons.forEach(function (btn, i) {
        btn.disabled = true;
        var opt = c.options[i];
        if (i === correctIndex) btn.classList.add("is-right");
        else if (i === choice) btn.classList.add("is-wrong");
        btn.appendChild(el("span", "option-why", opt.why));
        if (i === correctIndex) btn.setAttribute("aria-label", "Correct answer. " + opt.text);
        else if (i === choice) btn.setAttribute("aria-label", "Your answer, not correct. " + opt.text);
      });

      var explain = document.getElementById("explain");
      explain.className = "callout lesson " + (right ? "good" : "bad");
      explain.textContent = "";
      explain.appendChild(el("p", "callout-title", right ? "Found it." : "Not quite."));
      explain.appendChild(el("p", "", c.outcome));
      explain.appendChild(el("p", "", c.lesson));
      explain.hidden = false;

      var actions = document.getElementById("actions");
      var last = index === CASES.length - 1;
      var next = el("button", "btn", last ? "See your result" : "Next case");
      next.type = "button";
      next.addEventListener("click", function () {
        index += 1;
        render();
      });
      actions.appendChild(next);

      var bars = rootEl.querySelectorAll(".progress li");
      bars[index].className = right ? "right" : "wrong";
      explain.focus({ preventScroll: false });
    }

    function renderFinal() {
      var score = results.filter(Boolean).length;
      rootEl.textContent = "";
      rootEl.appendChild(progress());

      var card = el("section", "card");
      card.setAttribute("aria-labelledby", "final-title");
      var title = el("h2", "", "Case closed");
      title.id = "final-title";
      title.tabIndex = -1;
      card.appendChild(title);
      card.appendChild(el("p", "final-score", score + " of " + CASES.length));
      card.appendChild(el("p", "", scoreMessage(score, CASES.length)));

      card.appendChild(el("p", "evidence-title", "Habits that catch leakage"));
      var habits = el("ul", "checklist");
      HABITS.forEach(function (h) {
        habits.appendChild(el("li", "", h));
      });
      card.appendChild(habits);

      var actions = el("div", "button-row");
      var again = el("button", "btn", "Play again");
      again.type = "button";
      again.addEventListener("click", function () {
        index = 0;
        results = [];
        render();
      });
      actions.appendChild(again);
      var more = el("a", "btn btn-quiet", "Back to the experiments");
      more.href = "index.html#experiments";
      actions.appendChild(more);
      card.appendChild(actions);

      rootEl.appendChild(card);
      title.focus({ preventScroll: true });
    }

    function render() {
      if (index >= CASES.length) renderFinal();
      else renderCase();
    }

    render();
  }

  return {
    CASES: CASES,
    HABITS: HABITS,
    scoreMessage: scoreMessage,
    init: init,
  };
});
