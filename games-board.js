/* Shelf totals and owner decisions. Loaded on the Games page. */
(function () {
  if (window.__GAMES_BOARD) return;
  window.__GAMES_BOARD = true;
  if (!/\/games\/?$/.test(location.pathname)) return;
  var CODE_KEY = "retreat-edit-code";
  var root = document.querySelector("main .wrap") || document.querySelector("main");
  if (!root) return;
  var host = document.createElement("section");
  host.id = "brought-summary";
  host.className = "stack";
  host.innerHTML = '<h2 id="brought-heading">Games being brought</h2><p class="display" id="brought-total">Loading the shelf.</p><p class="hint">Each number is one shelf entry: a peep who is bringing that game. Two peeps bringing the same title count as two. Pending and declined requests are not included.</p><ul id="brought-by-peep"></ul><h2 id="requested-heading">Requested</h2><p class="hint" id="requested-status">Loading requests.</p><div id="requested-list" class="stack"></div>';
  var lede = root.querySelector(".lede");
  if (lede) lede.insertAdjacentElement("afterend", host);
  else root.appendChild(host);

  function headers(extra) {
    var result = { accept: "application/json" };
    try {
      var code = sessionStorage.getItem(CODE_KEY);
      if (code) result.authorization = "Bearer " + code;
    } catch (e) {}
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
    document.getElementById("brought-total").textContent = total + (total === 1 ? " game being brought" : " games being brought");
    var list = document.getElementById("brought-by-peep");
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
  }
  function paintRequests(payload, you, decisionsLive) {
    var requests = (payload && payload.requests) || [];
    var open = requests.filter(function (request) { return pendingOwners(request).length > 0; });
    var status = document.getElementById("requested-status");
    var list = document.getElementById("requested-list");
    list.replaceChildren();
    if (!decisionsLive) {
      status.textContent = "Requests can be seen here. Owner bring and decline choices are not on the live board yet.";
      requests.forEach(function (request) {
        var article = document.createElement("article");
        article.className = "sheet";
        var h3 = document.createElement("h3");
        h3.textContent = request.title;
        var meta = document.createElement("p");
        meta.className = "hint";
        meta.textContent = "Requested by " + request.requesterName + ".";
        article.appendChild(h3);
        article.appendChild(meta);
        list.appendChild(article);
      });
      return;
    }
    status.textContent = open.length ? "An owner can bring a requested game or decline. One owner does not decide for the other." : "No request is still waiting on an owner.";
    open.forEach(function (request) {
      var article = document.createElement("article");
      article.className = "sheet";
      var h3 = document.createElement("h3");
      h3.textContent = request.title;
      var meta = document.createElement("p");
      meta.className = "hint";
      var waiting = pendingOwners(request);
      meta.textContent = "Requested by " + request.requesterName + ". Owned by " + (request.owners || []).join(" and ") + ". Still waiting on " + waiting.join(" and ") + ".";
      article.appendChild(h3);
      article.appendChild(meta);
      var mine = you && waiting.some(function (owner) { return owner.toLowerCase() === you.nickname.toLowerCase(); });
      if (mine) {
        var actions = document.createElement("p");
        ["bring", "decline"].forEach(function (decision) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "btn";
          button.dataset.requestId = request.id;
          button.dataset.decision = decision;
          button.textContent = decision === "bring" ? "Bring it" : "Decline";
          button.addEventListener("click", function (event) { decide(event.currentTarget.dataset.requestId, event.currentTarget.dataset.decision); });
          actions.appendChild(button);
          actions.appendChild(document.createTextNode(" "));
        });
        article.appendChild(actions);
      }
      list.appendChild(article);
    });
  }
  function decide(requestId, decision) {
    api("/api/requests/" + requestId + "/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: decision })
    }).then(function (response) {
      if (response.status === 404) {
        document.getElementById("requested-status").textContent = "Owner choices are not on the live board yet.";
        return null;
      }
      return response.json().then(function (data) {
        if (!response.ok) {
          document.getElementById("requested-status").textContent = data.error || "That choice did not save.";
          return null;
        }
        location.reload();
      });
    });
  }
  function load() {
    return Promise.all([
      api("/api/board").then(function (response) { return response.ok ? response.json() : null; }),
      api("/api/requests").then(function (response) { return response.ok ? response.json() : { requests: [] }; })
    ]).then(function (parts) {
      var board = parts[0];
      var requests = parts[1];
      if (board) paintCount(board);
      var sample = (requests.requests || [])[0];
      var decisionsLive = !sample || Array.isArray(sample.decisions);
      paintRequests(requests, board && board.you, decisionsLive && (requests.requests || []).every(function (request) { return Array.isArray(request.owners); }));
    }).catch(function () {
      document.getElementById("brought-total").textContent = "The shelf count did not load.";
    });
  }
  load();
  var timer = 0;
  new MutationObserver(function (records) {
    var inside = records.every(function (record) { return host.contains(record.target); });
    if (inside) return;
    clearTimeout(timer);
    timer = setTimeout(load, 400);
  }).observe(root, { childList: true, subtree: true });
})();
