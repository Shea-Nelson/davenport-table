/* Shelf cards, totals, and owner decisions. Loaded on the Games page. */
(function () {
  if (window.__GAMES_BOARD) return;
  window.__GAMES_BOARD = true;
  if (!/\/games\/?$/.test(location.pathname)) return;
  if (document.body) document.body.classList.add("dt-shelf-page");
  if (!document.querySelector("link[data-shelf-cards]")) {
    var sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = "/davenport-table/shelf-cards.css";
    sheet.dataset.shelfCards = "1";
    document.head.appendChild(sheet);
  }
  if (!window.ShelfCards && !document.querySelector("script[data-shelf-cards-js]")) {
    var facts = document.createElement("script");
    facts.src = "/davenport-table/shelf-cards.js";
    facts.async = false;
    facts.dataset.shelfCardsJs = "1";
    document.body.appendChild(facts);
  }
  var CODE_KEY = "retreat-edit-code";
  var host = document.createElement("section");
  host.id = "brought-summary";
  host.className = "stack";
  host.innerHTML = '<h2 id="brought-heading">Games being brought</h2><p class="display" id="brought-total">Loading the shelf.</p><p class="hint">Each number is one shelf entry: a peep who is bringing that game. Two peeps bringing the same title count as two. Pending and declined requests are not included.</p><ul id="brought-by-peep"></ul><div class="dt-toolbar" id="games-toolbar"><div class="dt-toolbar__row"><label class="dt-search"><span class="sr-only">Search the shelf</span><input id="gb-search" type="search" placeholder="Search titles" autocomplete="off"></label><label class="sr-only" for="gb-sort">Sort</label><select id="gb-sort"><option value="name">Name</option><option value="players">Players</option><option value="time">Play time</option><option value="weight">Weight</option><option value="owner">Owner</option></select><button type="button" id="gb-dir" class="dt-dir">A to Z</button><label for="gb-owner">Brought by</label><select id="gb-owner"><option value="">Anyone</option></select></div><div class="dt-players"><span class="dt-players__label" id="gb-plays-label">Plays with</span><div class="dt-chips" id="gb-plays" role="group" aria-labelledby="gb-plays-label"></div></div><div class="dt-players"><span class="dt-players__label" id="gb-best-label">Best with</span><div class="dt-chips" id="gb-best" role="group" aria-labelledby="gb-best-label"></div></div><div class="dt-range"><span>Published range</span><label>Min at least <input id="gb-min" type="number" min="1" max="20" inputmode="numeric"></label><label>Max at most <input id="gb-max" type="number" min="1" max="20" inputmode="numeric"></label></div><div class="dt-players"><span class="dt-players__label" id="gb-time-label">Play time</span><div class="dt-chips" id="gb-time" role="group" aria-labelledby="gb-time-label"></div></div><div class="dt-players"><span class="dt-players__label" id="gb-weight-label">Weight</span><div class="dt-chips" id="gb-weight" role="group" aria-labelledby="gb-weight-label"></div></div><p class="hint dt-help">Plays with, best with, and the min/max range use verified counts only. A game without a verified count stays out of those filters. Best with is the BoardGameGeek community poll when Shea’s Game Shelf already had that id.</p></div><div id="shelf-cards" class="dt-grid"></div><h2 id="requested-heading">Requested</h2><p class="hint" id="requested-status">Loading requests.</p><div id="requested-list" class="dt-grid"></div>';
  var state = { plays: null, best: null, sort: "name", dir: "asc", min: null, max: null, time: null, weight: null, owner: "", q: "" };
  var lastBoard = null;
  var lastRequests = null;
  var shelfSig = "";
  var wired = false;

  function place() {
    var current = document.querySelector("main .wrap") || document.querySelector("main");
    if (!current) return false;
    var link = document.getElementById("requests-link");
    var lede = current.querySelector(".lede");
    var anchor = link && current.contains(link) ? link : lede;
    if (anchor && anchor.parentNode) {
      if (host.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", host);
    } else if (!current.contains(host)) current.appendChild(host);
    var plain = document.querySelector("ul.plain-list");
    if (plain) plain.setAttribute("aria-hidden", "true");
    return host.isConnected;
  }
  place();

  function headers(extra) {
    var result = { accept: "application/json" };
    try {
      var code = sessionStorage.getItem(CODE_KEY);
      if (code) result.authorization = "Bearer " + code;
    } catch (error) {}
    if (extra) Object.keys(extra).forEach(function (key) { result[key] = extra[key]; });
    return result;
  }
  function api(path, options) {
    return fetch((window.RETREAT_API || "") + path, {
      method: options && options.method || "GET",
      credentials: "include",
      headers: headers(options && options.headers),
      body: options && options.body
    });
  }
  function pendingOwners(request) {
    var decided = {};
    (request.decisions || []).forEach(function (item) { decided[item.owner] = item.decision; });
    return (request.owners || []).filter(function (owner) { return !decided[owner]; });
  }
  function paintCount(board) {
    var games = board && board.games || [];
    var people = {};
    (board.attendees || []).forEach(function (person) { people[person.id] = { name: person.nickname, count: 0 }; });
    games.forEach(function (game) {
      if (!people[game.attendeeId]) people[game.attendeeId] = { name: game.broughtBy, count: 0 };
      people[game.attendeeId].count += 1;
    });
    var names = Object.keys(people).map(function (id) { return people[id]; });
    names.sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
    var total = games.length;
    var sum = names.reduce(function (n, person) { return n + person.count; }, 0);
    host.querySelector("#brought-total").textContent = total + (total === 1 ? " game being brought" : " games being brought");
    var list = host.querySelector("#brought-by-peep");
    list.replaceChildren();
    names.forEach(function (person) {
      var item = document.createElement("li");
      item.textContent = person.name + ": " + person.count;
      if (person.count === 0) item.className = "hint";
      list.appendChild(item);
    });
    if (sum !== total) {
      var warn = document.createElement("li");
      warn.textContent = "The breakdown does not add up to the shelf. Refresh the page.";
      list.appendChild(warn);
    }
    var owner = host.querySelector("#gb-owner");
    var current = owner.value;
    owner.replaceChildren();
    var any = document.createElement("option");
    any.value = "";
    any.textContent = "Anyone";
    owner.appendChild(any);
    names.forEach(function (person) {
      var option = document.createElement("option");
      option.value = person.name;
      option.textContent = person.name;
      owner.appendChild(option);
    });
    owner.value = names.some(function (person) { return person.name === current; }) ? current : "";
    state.owner = owner.value;
  }
  function wanted(text, model, owners) {
    if (state.q && String(text || "").toLowerCase().indexOf(state.q) === -1) return false;
    if (state.owner && owners.indexOf(state.owner) === -1) return false;
    return window.ShelfCards.fits(model, state);
  }
  function paintShelf(board) {
    var list = host.querySelector("#shelf-cards");
    list.replaceChildren();
    var rows = ((board && board.games) || []).map(function (game) {
      var match = window.ShelfCards.matchTitle(game.title);
      return { shelf: game, model: window.ShelfCards.model(match) };
    }).filter(function (row) {
      return wanted(row.shelf.title, row.model, [row.shelf.broughtBy]);
    });
    window.ShelfCards.sort(rows, state, {
      name: function (row) { return row.shelf.title; },
      owner: function (row) { return row.shelf.broughtBy || ""; },
      model: function (row) { return row.model; }
    }).forEach(function (row, index) {
      var game = row.shelf;
      var link = document.createElement("a");
      link.href = "/davenport-table/games?id=" + encodeURIComponent(game.id) + "#game-focus";
      link.textContent = "Open shelf entry";
      var card = window.ShelfCards.renderCard({
        id: game.id,
        title: game.title,
        titleTag: "h3",
        who: "Brought by " + (game.broughtBy || "someone"),
        hint: game.note ? "Note: " + game.note : "",
        model: row.model,
        eager: index < 4,
        actions: [link]
      });
      list.appendChild(card);
    });
    if (!list.children.length) {
      var empty = document.createElement("p");
      empty.className = "dt-empty";
      empty.textContent = (board && board.games && board.games.length) ? "No shelf games match those filters." : "Nothing has been added. The shelf starts empty on purpose.";
      list.appendChild(empty);
    }
  }
  function paintRequests(payload, you, decisionsLive) {
    var requests = (payload && payload.requests) || [];
    var open = requests.filter(function (request) { return pendingOwners(request).length > 0; });
    var status = host.querySelector("#requested-status");
    var list = host.querySelector("#requested-list");
    list.replaceChildren();
    if (!decisionsLive) {
      status.textContent = "Requests can be seen here. Owner bring and decline choices are not on the live board yet.";
      requests.forEach(function (request) {
        var article = document.createElement("article");
        var heading = document.createElement("h3");
        heading.textContent = request.title;
        var meta = document.createElement("p");
        meta.className = "hint";
        meta.textContent = "Requested by " + request.requesterName + ".";
        article.appendChild(heading);
        article.appendChild(meta);
        list.appendChild(article);
      });
      return;
    }
    var visible = open.filter(function (request) {
      var entry = window.ShelfCards.matchById(request.bggId) || window.ShelfCards.matchTitle(request.title);
      var owners = (request.owners || []).concat(request.requesterName ? [request.requesterName] : []);
      return wanted(request.title, window.ShelfCards.model(entry), owners);
    });
    status.textContent = open.length ? "An owner can bring a requested game or decline. One owner does not decide for the other." : "No request is still waiting on an owner.";
    if (open.length && !visible.length) status.textContent = "No request matches those filters.";
    window.ShelfCards.sort(visible, state, {
      name: function (request) { return request.title; },
      owner: function (request) { return (request.owners || []).join(" "); },
      model: function (request) {
        var entry = window.ShelfCards.matchById ? window.ShelfCards.matchById(request.bggId) : null;
        return window.ShelfCards.model(entry || window.ShelfCards.matchTitle(request.title));
      }
    }).forEach(function (request) {
      var waiting = pendingOwners(request);
      var entry = window.ShelfCards.matchById(request.bggId) || window.ShelfCards.matchTitle(request.title);
      var actions = [];
      var mine = you && waiting.some(function (owner) { return owner.toLowerCase() === you.nickname.toLowerCase(); });
      if (mine) {
        ["bring", "decline"].forEach(function (decision) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "btn";
          button.dataset.requestId = request.id;
          button.dataset.decision = decision;
          button.textContent = decision === "bring" ? "Bring it" : "Decline";
          button.addEventListener("click", function (event) {
            decide(event.currentTarget.dataset.requestId, event.currentTarget.dataset.decision);
          });
          actions.push(button);
        });
      }
      var card = window.ShelfCards.renderCard({
        id: request.bggId,
        title: request.title,
        titleTag: "h3",
        who: "Owned by " + ((request.owners || []).join(" and ") || "the collection"),
        hint: "Requested by " + request.requesterName + ". Owned by " + (request.owners || []).join(" and ") + ". Still waiting on " + waiting.join(" and ") + ".",
        model: window.ShelfCards.model(entry),
        actions: actions
      });
      list.appendChild(card);
    });
  }
  function decide(requestId, decision) {
    api("/api/requests/" + requestId + "/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: decision })
    }).then(function (response) {
      if (response.status === 404) {
        host.querySelector("#requested-status").textContent = "Owner choices are not on the live board yet.";
        return null;
      }
      return response.json().then(function (data) {
        if (!response.ok) {
          host.querySelector("#requested-status").textContent = data.error || "That choice did not save.";
          return null;
        }
        location.reload();
      });
    });
  }
  function repaint() {
    if (!lastBoard && !lastRequests) return;
    if (lastBoard) {
      paintCount(lastBoard);
      paintShelf(lastBoard);
    }
    if (lastRequests) {
      var sample = (lastRequests.requests || [])[0];
      var decisionsLive = !sample || Array.isArray(sample.decisions);
      paintRequests(lastRequests, lastBoard && lastBoard.you, decisionsLive && (lastRequests.requests || []).every(function (request) { return Array.isArray(request.owners); }));
    }
  }
  function wire() {
    if (wired || !window.ShelfCards) return;
    wired = true;
    window.ShelfCards.wire({
      plays: host.querySelector("#gb-plays"),
      best: host.querySelector("#gb-best"),
      time: host.querySelector("#gb-time"),
      weight: host.querySelector("#gb-weight"),
      sort: host.querySelector("#gb-sort"),
      dir: host.querySelector("#gb-dir"),
      min: host.querySelector("#gb-min"),
      max: host.querySelector("#gb-max")
    }, state, repaint);
    host.querySelector("#gb-search").addEventListener("input", function (event) {
      state.q = event.target.value.trim().toLowerCase();
      repaint();
    });
    host.querySelector("#gb-owner").addEventListener("change", function (event) {
      state.owner = event.target.value;
      repaint();
    });
  }
  function load() {
    place();
    if (!window.ShelfCards) return;
    wire();
    return Promise.all([
      api("/api/board").then(function (response) { return response.ok ? response.json() : null; }),
      api("/api/requests").then(function (response) { return response.ok ? response.json() : { requests: [] }; }),
      window.ShelfCards.loadSupport(),
      window.ShelfCards.loadCatalog().catch(function () { return []; })
    ]).then(function (parts) {
      place();
      window.ShelfCards.ingest(parts[3], parts[2].players, parts[2].facts);
      lastBoard = parts[0];
      lastRequests = parts[1];
      repaint();
      var plain = document.querySelector("ul.plain-list");
      shelfSig = plain ? plain.textContent : "";
    }).catch(function () {
      var total = host.querySelector("#brought-total");
      if (total) total.textContent = "The shelf count did not load.";
    });
  }
  function boot() {
    if (!window.ShelfCards) {
      setTimeout(boot, 40);
      return;
    }
    load();
  }
  boot();
  new MutationObserver(function (records) {
    var inside = records.every(function (record) { return record.target === host || host.contains(record.target); });
    if (inside) return;
    place();
    var plain = document.querySelector("ul.plain-list");
    var next = plain ? plain.textContent : "";
    if (next !== shelfSig && window.ShelfCards) {
      shelfSig = next;
      clearTimeout(boot.timer);
      boot.timer = setTimeout(load, 400);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
