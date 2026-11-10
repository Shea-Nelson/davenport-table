/* Shared card facts, filters, and rendering for the Games and Requests pages. */
(function (global) {
  var HUES = [262, 285, 172, 328, 222];
  var PLAYERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var TIMES = [
    { k: "15", label: "≤ 15 min" },
    { k: "30", label: "≤ 30 min" },
    { k: "60", label: "≤ 60 min" },
    { k: "long", label: "Over an hour" }
  ];
  var WEIGHTS = [
    { k: "light", label: "Light" },
    { k: "medium", label: "Medium" },
    { k: "heavy", label: "Heavier" }
  ];
  var exact = {};
  var cleaned = {};
  var byId = {};

  function norm(value) {
    return String(value || "").toLowerCase().replace(/\s*\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function sortName(value) {
    return norm(value).replace(/^(the|a|an) /, "");
  }
  function dash(a, b) {
    return a === b ? String(a) : a + "\u2013" + b;
  }
  function parseBest(value) {
    var out = {};
    String(value || "").split(",").forEach(function (part) {
      var match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?/);
      if (!match) return;
      var start = Number(match[1]);
      var end = match[2] ? Number(match[2]) : start;
      var n;
      for (n = start; n <= end && n < 40; n += 1) out[n] = true;
    });
    return out;
  }
  function sentence(row) {
    var text = "Players: Not verified";
    if (row && (row.basis === "base" || row.basis === "open" || (row.label && row.max == null))) text = "Players: " + row.label;
    else if (row && row.min != null && row.max != null) text = "Players: " + row.min + "\u2013" + row.max;
    if (row && row.expansion && text !== "Players: Not verified") text += " with the required base game, not a standalone count";
    if (row && row.asOf && text !== "Players: Not verified") text += " (as of " + row.asOf + ")";
    return text;
  }
  function emptyModel() {
    return {
      min: null, max: null, open: false, rangeText: "Not verified", unverified: true,
      best: null, bestSet: {}, minPlay: null, maxPlay: null, weight: null, year: null,
      image: null, caveat: "", asOf: "", baseOnly: false
    };
  }
  function model(entry) {
    if (!entry) return emptyModel();
    var row = entry._players || null;
    var facts = entry._facts || null;
    var result = emptyModel();
    if (facts) {
      result.best = facts.best || null;
      result.bestSet = parseBest(facts.best);
      result.minPlay = facts.minPlay == null ? null : facts.minPlay;
      result.maxPlay = facts.maxPlay == null ? null : facts.maxPlay;
      result.weight = facts.weight == null ? null : facts.weight;
      result.year = facts.year == null ? null : facts.year;
      result.image = facts.image || null;
    }
    if (!row) return result;
    result.asOf = row.asOf || "";
    if (row.basis === "base" || (row.label && row.max == null && row.basis !== "open")) {
      result.rangeText = row.label || "Not verified";
      result.unverified = false;
      result.baseOnly = row.basis === "base";
      return result;
    }
    if (row.basis === "open") {
      result.min = row.min == null ? null : row.min;
      result.open = true;
      result.rangeText = row.label || (result.min + "+");
      result.unverified = false;
      return result;
    }
    if (row.min != null && row.max != null) {
      result.min = row.min;
      result.max = row.max;
      result.rangeText = dash(row.min, row.max);
      result.unverified = false;
      if (row.expansion) result.caveat = "With the required base game, not a standalone count";
    }
    return result;
  }
  function playsWith(item, count) {
    if (!item || item.unverified || item.baseOnly || item.min == null) return false;
    if (item.open) return count === 10 ? item.min <= 10 : count >= item.min;
    if (count === 10) return item.max >= 10;
    return item.min <= count && item.max >= count;
  }
  function bestWith(item, count) {
    if (!item || !item.best) return false;
    if (count === 10) {
      var found = false;
      Object.keys(item.bestSet).forEach(function (key) { if (Number(key) >= 10) found = true; });
      return found;
    }
    return !!item.bestSet[count];
  }
  function minutes(item) {
    if (!item) return null;
    return item.maxPlay || item.minPlay || null;
  }
  function timeOk(item, key) {
    var value = minutes(item);
    if (value == null) return false;
    if (key === "15") return value <= 15;
    if (key === "30") return value <= 30;
    if (key === "60") return value <= 60;
    if (key === "long") return (item.maxPlay || 0) > 60;
    return true;
  }
  function weightOk(item, key) {
    if (!item || item.weight == null) return false;
    if (key === "light") return item.weight < 1.8;
    if (key === "medium") return item.weight >= 1.8 && item.weight < 2.6;
    if (key === "heavy") return item.weight >= 2.6;
    return true;
  }
  function fits(item, state) {
    if (state.plays != null && !playsWith(item, state.plays)) return false;
    if (state.best != null && !bestWith(item, state.best)) return false;
    if (state.min != null && (item.min == null || item.min < state.min)) return false;
    if (state.max != null && (item.max == null || item.max > state.max)) return false;
    if (state.time && !timeOk(item, state.time)) return false;
    if (state.weight && !weightOk(item, state.weight)) return false;
    return true;
  }
  function sort(list, state, get) {
    var dir = state.dir === "desc" ? -1 : 1;
    function name(item) { return sortName(get.name(item)); }
    function key(item) {
      var itemModel = get.model(item);
      if (state.sort === "owner") return get.owner(item) || "";
      if (state.sort === "players") {
        if (itemModel.open) return 5000 + (itemModel.min || 0);
        if (itemModel.max == null) return null;
        return itemModel.max * 100 + (itemModel.min || 0);
      }
      if (state.sort === "time") return minutes(itemModel);
      if (state.sort === "weight") return itemModel.weight == null ? null : itemModel.weight;
      return name(item);
    }
    return list.slice().sort(function (a, b) {
      var left = key(a);
      var right = key(b);
      if (left == null && right == null) return name(a).localeCompare(name(b));
      if (left == null) return 1;
      if (right == null) return -1;
      var compared = typeof left === "string" ? left.localeCompare(right) : left - right;
      return compared * dir || name(a).localeCompare(name(b));
    });
  }
  function hue(id) { return HUES[Math.abs(Number(id) || 0) % HUES.length]; }
  function chipRow(container, selected, choices) {
    container.replaceChildren();
    function add(label, value) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "dt-chip";
      button.dataset.v = value == null ? "" : String(value);
      button.setAttribute("aria-pressed", String(selected === value || (value == null && selected == null)));
      button.textContent = label;
      container.appendChild(button);
    }
    add("Any", null);
    choices.forEach(function (choice) {
      if (typeof choice === "number") add(choice === 10 ? "10+" : String(choice), choice);
      else add(choice.label, choice.k);
    });
  }
  function readNumber(input) {
    if (!input || input.value.trim() === "") return null;
    var value = Number(input.value);
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  function wire(controls, state, onChange) {
    function paint() {
      if (controls.plays) chipRow(controls.plays, state.plays, PLAYERS);
      if (controls.best) chipRow(controls.best, state.best, PLAYERS);
      if (controls.time) chipRow(controls.time, state.time, TIMES);
      if (controls.weight) chipRow(controls.weight, state.weight, WEIGHTS);
      if (controls.sort) controls.sort.value = state.sort;
      if (controls.dir) {
        controls.dir.dataset.dir = state.dir;
        controls.dir.textContent = state.dir === "asc" ? "A to Z" : "Z to A";
        controls.dir.setAttribute("aria-label", state.dir === "asc" ? "Sort ascending" : "Sort descending");
      }
      syncTheme(controls.theme);
    }
    function choose(key, numeric) {
      return function (event) {
        var button = event.target.closest("button");
        if (!button || !event.currentTarget.contains(button)) return;
        var value = button.dataset.v;
        state[key] = value === "" ? null : (numeric ? Number(value) : value);
        paint();
        onChange();
      };
    }
    if (controls.plays) controls.plays.addEventListener("click", choose("plays", true));
    if (controls.best) controls.best.addEventListener("click", choose("best", true));
    if (controls.time) controls.time.addEventListener("click", choose("time", false));
    if (controls.weight) controls.weight.addEventListener("click", choose("weight", false));
    if (controls.sort) controls.sort.addEventListener("change", function () {
      state.sort = controls.sort.value;
      state.dir = state.sort === "weight" || state.sort === "time" ? "desc" : "asc";
      paint();
      onChange();
    });
    if (controls.dir) controls.dir.addEventListener("click", function () {
      state.dir = state.dir === "asc" ? "desc" : "asc";
      paint();
      onChange();
    });
    if (controls.min) controls.min.addEventListener("input", function () { state.min = readNumber(controls.min); paint(); onChange(); });
    if (controls.max) controls.max.addEventListener("input", function () { state.max = readNumber(controls.max); paint(); onChange(); });
    if (controls.theme) controls.theme.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("dt-theme", next); } catch (error) {}
      syncTheme(controls.theme);
    });
    paint();
    return paint;
  }
  function syncTheme(button) {
    if (!button) return;
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.textContent = dark ? "Light mode" : "Dark mode";
  }
  function renderCard(options) {
    var item = options.model || emptyModel();
    var article = document.createElement("article");
    article.className = "dt-card";
    article.style.setProperty("--h", String(hue(options.id)));
    var art = document.createElement("div");
    art.className = "dt-card__art";
    if (item.image) {
      var image = document.createElement("img");
      image.src = item.image;
      image.alt = "Box art for " + options.title;
      image.decoding = "async";
      image.loading = options.eager ? "eager" : "lazy";
      image.addEventListener("error", function () {
        image.remove();
        var missing = document.createElement("div");
        missing.className = "dt-card__missing";
        missing.textContent = "No box art on file";
        art.appendChild(missing);
      });
      art.appendChild(image);
    } else {
      var missingArt = document.createElement("div");
      missingArt.className = "dt-card__missing";
      missingArt.textContent = "No box art on file";
      art.appendChild(missingArt);
    }
    var body = document.createElement("div");
    body.className = "dt-card__body";
    var title = document.createElement(options.titleTag || "h2");
    title.textContent = options.title;
    var who = document.createElement("div");
    who.className = "dt-card__who";
    who.textContent = options.who || "";
    var players = document.createElement("div");
    players.className = "dt-card__players";
    var num = document.createElement("span");
    num.className = "num" + (item.unverified ? " is-unverified" : "") + (item.rangeText.length > 8 ? " is-long" : "");
    num.textContent = item.rangeText;
    var label = document.createElement("span");
    label.className = "lbl";
    label.textContent = item.unverified ? "player count" : "players";
    var best = document.createElement("span");
    best.className = "best" + (item.best ? "" : " best--missing");
    best.textContent = item.best ? "Best " + item.best : "Best not verified";
    players.appendChild(num);
    players.appendChild(label);
    players.appendChild(best);
    body.appendChild(title);
    if (options.who) body.appendChild(who);
    body.appendChild(players);
    if (options.hint) {
      var hint = document.createElement("p");
      hint.className = options.hintClass || "hint";
      hint.textContent = options.hint;
      body.appendChild(hint);
    }
    if (item.caveat) {
      var caveat = document.createElement("p");
      caveat.className = "hint";
      caveat.textContent = item.caveat;
      body.appendChild(caveat);
    }
    if (item.asOf) {
      var asOf = document.createElement("p");
      asOf.className = "hint";
      asOf.textContent = "As of " + item.asOf + ".";
      body.appendChild(asOf);
    }
    var meta = document.createElement("div");
    meta.className = "dt-card__meta";
    var time = document.createElement("span");
    var span = minutes(item);
    time.textContent = span ? (item.minPlay && item.maxPlay && item.minPlay !== item.maxPlay ? item.minPlay + "\u2013" + item.maxPlay + " min" : span + " min") : "Time not verified";
    var weight = document.createElement("span");
    weight.textContent = item.weight == null ? "Weight not verified" : "Weight " + item.weight.toFixed(1) + "/5";
    meta.appendChild(time);
    meta.appendChild(weight);
    if (item.year) {
      var year = document.createElement("span");
      year.textContent = String(item.year);
      meta.appendChild(year);
    }
    body.appendChild(meta);
    if (options.actions) {
      var actions = document.createElement("div");
      actions.className = "dt-card__actions";
      options.actions.forEach(function (node) { if (node) actions.appendChild(node); });
      body.appendChild(actions);
    }
    article.appendChild(art);
    article.appendChild(body);
    return article;
  }
  function ingest(catalog, players, facts) {
    exact = {};
    cleaned = {};
    byId = {};
    (catalog || []).forEach(function (game) {
      game._players = players[String(game.bggId)] || null;
      game._facts = facts[String(game.bggId)] || null;
      byId[game.bggId] = game;
      exact[String(game.title || "").toLowerCase()] = game;
      var key = norm(game.title);
      if (Object.prototype.hasOwnProperty.call(cleaned, key) && cleaned[key] !== game) cleaned[key] = null;
      else if (!Object.prototype.hasOwnProperty.call(cleaned, key)) cleaned[key] = game;
    });
  }
  function matchTitle(title) {
    if (!title) return null;
    var direct = exact[String(title).toLowerCase()];
    if (direct) return direct;
    var key = norm(title);
    return cleaned[key] || null;
  }
  function matchById(id) {
    return byId[id] || byId[Number(id)] || null;
  }
  function loadSupport() {
    return Promise.all([
      fetch("/davenport-table/collections/players.json").then(function (response) { return response.ok ? response.json() : { games: {} }; }),
      fetch("/davenport-table/collections/shelf-facts.json").then(function (response) { return response.ok ? response.json() : { games: {} }; })
    ]).then(function (parts) {
      return { players: (parts[0] && parts[0].games) || {}, facts: (parts[1] && parts[1].games) || {} };
    });
  }
  function loadCatalog() {
    return fetch("/davenport-table/collections/owned.json").then(function (response) {
      if (!response.ok) throw new Error("missing");
      return response.json();
    }).then(function (data) { return data.games || []; });
  }

  global.ShelfCards = {
    ingest: ingest,
    matchTitle: matchTitle,
    matchById: matchById,
    model: model,
    sentence: sentence,
    fits: fits,
    sort: sort,
    wire: wire,
    renderCard: renderCard,
    loadSupport: loadSupport,
    loadCatalog: loadCatalog,
    emptyState: function () { return { plays: null, best: null, sort: "name", dir: "asc", min: null, max: null, time: null, weight: null }; }
  };
})(window);
