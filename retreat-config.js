/* Live Worker. The board is ready. Do not set this back to "planned" on export. */
window.RETREAT_API = "https://davenport-table-api.shea-nelson.workers.dev";
window.RETREAT_BOARD = "ready";

/* Distance notes and the requests link. Re-applied after the page hydrates. */
(function () {
  var METHOD = "Driving miles from the published resort marker (28.312206, -81.659872) on November 7, 2026. Street addresses were located with the US Census geocoder, then routed with the OSRM driving profile. Chick-fil-A is the exception: the Census geocoder matched 1201 Champions Ridge Way, a different street, so that card uses the latitude and longitude published on the Chick-fil-A location page and the same OSRM route.";
  var places = [
    { slug: "chick-fil-a", miles: 3.34, label: "3.3 driving miles", note: "Coordinates from the Chick-fil-A Champions Crossing page, then OSRM. Closed Sunday." },
    { slug: "culvers", miles: 6.75, label: "6.8 driving miles", note: "Census match for 1107 Posner Blvd, then OSRM. The Culver's locator URL tried for this branch returned 404, so the title links to directions." },
    { slug: "five-guys", miles: 6.83, label: "6.8 driving miles", note: "Census match for 1321 Posner Blvd, then OSRM." },
    { slug: "huey-magoos", miles: 7.04, label: "7.0 driving miles", note: "Census match for 8316 Champions Gate Blvd, then OSRM. The order page lists this branch." },
    { slug: "little-greek", miles: 7.08, label: "7.1 driving miles", note: "Census match for 8310 Champions Gate Blvd, then OSRM." },
    { slug: "tijuana-flats", miles: 7.29, label: "7.3 driving miles", note: "Census match for 8274 Champions Gate Blvd, then OSRM." },
    { slug: "palma", miles: 7.30, label: "7.3 driving miles", note: "Census match for 8266 Champions Gate Blvd, then OSRM." },
    { slug: "four-corners-tavern", miles: 7.33, label: "7.3 driving miles", note: "Census match for 8250 Champions Gate Blvd, then OSRM." },
    { slug: "tacos-don-andres", miles: 7.34, label: "7.3 driving miles", note: "Census match for 8281 Champions Gate Blvd, then OSRM." },
    { slug: "honeys-bbq", miles: 7.39, label: "7.4 driving miles", note: "Census match for 2200 Posner Blvd, then OSRM." },
    { slug: "millers", miles: 7.54, label: "7.5 driving miles", note: "Census match for 8170 Laura Ln, then OSRM." },
    { slug: "fords-garage", miles: 8.03, label: "8.0 driving miles", note: "Census match for 8035 Osceola Polk Line Rd, then OSRM." },
    { slug: "flippers", miles: 8.19, label: "8.2 driving miles", note: "Census match for 7967 Osceola Polk Line Rd, then OSRM." },
    { slug: "blue-marlin", miles: null, label: "Distance not measured", note: "The Census geocoder did not match 1115 Aloha Blvd, so no driving miles are shown." }
  ];
  var extras = {
    "chick-fil-a": { href: "https://www.chick-fil-a.com/locations/fl/champions-crossing", name: "Chick-fil-A, Champions Crossing", text: "Fast chicken at 1201 Champions Drive. The location page lists Sunday as closed." },
    "culvers": { href: "https://www.google.com/maps/dir/?api=1&destination=1107%20Posner%20Blvd%2C%20Davenport%2C%20FL%2033837", name: "Culver's, Posner Blvd", text: "Burgers and frozen custard at 1107 Posner Blvd. Directions, because a first-party branch URL was not found." },
    "five-guys": { href: "https://restaurants.fiveguys.com/fl/davenport", name: "Five Guys, Davenport", text: "Burgers and fries at 1321 Posner Blvd." },
    "huey-magoos": { href: "https://order.hueymagoos.com/", name: "Huey Magoo's, ChampionsGate", text: "Chicken tenders at 8316 Champions Gate Blvd. The order page lists this branch. No hours are copied from the 2019 opening notice." }
  };

  function nav() {
    var lists = document.querySelectorAll("nav.desk-nav ul");
    for (var i = 0; i < lists.length; i += 1) {
      if (lists[i].querySelector('a[href="/davenport-table/requests/"]')) continue;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "/davenport-table/requests/";
      a.textContent = "Requests";
      if (location.pathname.indexOf("/requests") !== -1) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      var eats = lists[i].querySelector('a[href="/davenport-table/eats/"]');
      if (eats && eats.parentElement) lists[i].insertBefore(li, eats.parentElement);
      else lists[i].appendChild(li);
    }
  }

  function card(slug) {
    var extra = extras[slug];
    var article = document.createElement("article");
    article.className = "sheet";
    article.setAttribute("data-place", slug);
    var h2 = document.createElement("h2");
    var a = document.createElement("a");
    a.href = extra.href;
    a.rel = "noopener noreferrer";
    a.textContent = extra.name;
    h2.appendChild(a);
    var p = document.createElement("p");
    p.textContent = extra.text;
    article.appendChild(h2);
    article.appendChild(p);
    return article;
  }

  function eats() {
    if (!/\/eats\/?$/.test(location.pathname)) return;
    var grid = document.querySelector(".card-grid");
    if (!grid) return;
    var articles = Array.prototype.slice.call(grid.querySelectorAll(":scope > article"));
    function slugOf(article) {
      var marked = article.getAttribute("data-place");
      if (marked) return marked;
      var link = article.querySelector("a");
      var href = link ? link.getAttribute("href") || "" : "";
      for (var i = 0; i < places.length; i += 1) {
        if (href.indexOf("/" + places[i].slug) !== -1) return places[i].slug;
      }
      return "";
    }
    var by = {};
    articles.forEach(function (article) {
      var slug = slugOf(article);
      if (slug) by[slug] = article;
    });
    places.forEach(function (place) {
      if (!by[place.slug] && extras[place.slug]) by[place.slug] = card(place.slug);
      var article = by[place.slug];
      if (!article) return;
      article.setAttribute("data-place", place.slug);
      var note = article.querySelector(".distance-note");
      var text = place.label + ". " + place.note;
      if (!note) {
        note = document.createElement("p");
        note.className = "hint distance-note";
        article.appendChild(note);
      }
      if (note.textContent !== text) note.textContent = text;
    });
    var want = places.map(function (place) { return place.slug; }).join("|");
    var have = places.map(function (place) { return by[place.slug] ? place.slug : ""; }).join("|");
    if (have !== want) return;
    var current = articles.map(slugOf).join("|");
    if (current !== want) {
      places.forEach(function (place) { grid.appendChild(by[place.slug]); });
    }
    var lede = document.querySelector("main .lede");
    var ledeText = "Sorted by driving miles from the Windsor Island Resort map marker. " + METHOD + " Moe's is not listed: no nearby branch was verified. Blue Marlin stays last because its address did not geocode.";
    if (lede && lede.textContent !== ledeText) lede.textContent = ledeText;
  }

  function gamesLink() {
    if (!/\/games\/?$/.test(location.pathname)) return;
    var lede = document.querySelector("main .lede");
    if (!lede || document.getElementById("requests-link")) return;
    var p = document.createElement("p");
    p.id = "requests-link";
    var a = document.createElement("a");
    a.href = "/davenport-table/requests/";
    a.textContent = "Owned games from Shea and Grease";
    p.appendChild(a);
    p.appendChild(document.createTextNode(" are listed separately. Asking for one is not the same as adding it to this shelf."));
    lede.insertAdjacentElement("afterend", p);
  }

  function apply() {
    nav();
    eats();
    gamesLink();
  }
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
})();
