/* Live Worker. The board is ready. Do not set this back to "planned" on export. */
if (!window.RETREAT_API) window.RETREAT_API = "https://davenport-table-api.shea-nelson.workers.dev";
window.RETREAT_BOARD = "ready";

/* Distance notes and the requests link. Re-applied after the page hydrates. */
(function () {
  var METHOD = "Driving miles from the published resort map marker (28.312206, -81.659872), not from a house street. Measured November 7, 2026. Most addresses were located with the US Census geocoder, then routed with the OSRM driving profile. Chick-fil-A, Moe's, and Carrabba's use coordinates published on their own location pages because Census matched a different street or none.";
  var places = [
    { slug: "chick-fil-a", miles: 3.34, label: "3.3 driving miles from the resort marker", note: "Coordinates from the Chick-fil-A Champions Crossing page, then OSRM. Closed Sunday." },
    { slug: "moes", miles: 4.09, label: "4.1 driving miles from the resort marker", note: "Coordinates 28.3595057, -81.6780898 on the Moe's Four Corners page for 890 US Hwy 27, Clermont, then the same OSRM route." },
    { slug: "culvers", miles: 6.75, label: "6.8 driving miles from the resort marker", note: "Census match for 1107 Posner Blvd, then OSRM. The Culver's locator URL tried for this branch returned 404, so the title links to directions." },
    { slug: "five-guys", miles: 6.83, label: "6.8 driving miles from the resort marker", note: "Census match for 1321 Posner Blvd, then OSRM." },
    { slug: "huey-magoos", miles: 7.04, label: "7.0 driving miles from the resort marker", note: "Census match for 8316 Champions Gate Blvd, then OSRM. The order page lists this branch." },
    { slug: "little-greek", miles: 7.08, label: "7.1 driving miles from the resort marker", note: "Census match for 8310 Champions Gate Blvd, then OSRM." },
    { slug: "tijuana-flats", miles: 7.29, label: "7.3 driving miles from the resort marker", note: "Census match for 8274 Champions Gate Blvd, then OSRM." },
    { slug: "palma", miles: 7.30, label: "7.3 driving miles from the resort marker", note: "Census match for 8266 Champions Gate Blvd, then OSRM." },
    { slug: "four-corners-tavern", miles: 7.33, label: "7.3 driving miles from the resort marker", note: "Census match for 8250 Champions Gate Blvd, then OSRM." },
    { slug: "tacos-don-andres", miles: 7.34, label: "7.3 driving miles from the resort marker", note: "Census match for 8281 Champions Gate Blvd, then OSRM." },
    { slug: "honeys-bbq", miles: 7.39, label: "7.4 driving miles from the resort marker", note: "Census match for 2200 Posner Blvd, then OSRM." },
    { slug: "millers", miles: 7.54, label: "7.5 driving miles from the resort marker", note: "Census match for 8170 Laura Ln, then OSRM." },
    { slug: "fords-garage", miles: 8.03, label: "8.0 driving miles from the resort marker", note: "Census match for 8035 Osceola Polk Line Rd, then OSRM." },
    { slug: "outback", miles: 8.07, label: "8.1 driving miles from the resort marker", note: "Census match for 996 Heritage Pass, Davenport, then OSRM." },
    { slug: "longhorn", miles: 8.08, label: "8.1 driving miles from the resort marker", note: "Census match for 8095 Osceola Polk Line Rd, Davenport, then OSRM." },
    { slug: "carrabbas", miles: 8.12, label: "8.1 driving miles from the resort marker", note: "Coordinates 28.258896, -81.605550 on the Carrabba's Davenport page for 1005 Heritage Pass, then OSRM. Census did not match that street number." },
    { slug: "flippers", miles: 8.19, label: "8.2 driving miles from the resort marker", note: "Census match for 7967 Osceola Polk Line Rd, then OSRM." }
  ];
  var extras = {
    "chick-fil-a": { href: "https://www.chick-fil-a.com/locations/fl/champions-crossing", name: "Chick-fil-A, Champions Crossing", text: "Fast chicken at 1201 Champions Drive. The location page lists Sunday as closed.", image: "/davenport-table/media/food/chick-fil-a-champions-crossing.jpg", alt: "Chick-fil-A restaurant exterior with the red logo on the building.", caption: "Photo of restaurant 05565 from Chick-fil-A's location images. That is the Champions Crossing page." },
    "culvers": { href: "https://www.google.com/maps/dir/?api=1&destination=1107%20Posner%20Blvd%2C%20Davenport%2C%20FL%2033837", name: "Culver's, Posner Blvd", text: "Burgers and frozen custard at 1107 Posner Blvd. Directions, because a first-party branch URL was not found.", image: "/davenport-table/media/food/culvers-logo.svg", alt: "Culver's logo.", caption: "Official Culver's logo, not a photo of the Posner Boulevard restaurant." },
    "five-guys": { href: "https://restaurants.fiveguys.com/fl/davenport", name: "Five Guys, Davenport", text: "Burgers and fries at 1321 Posner Blvd." },
    "huey-magoos": { href: "https://order.hueymagoos.com/", name: "Huey Magoo's, ChampionsGate", text: "Chicken tenders at 8316 Champions Gate Blvd. The order page lists this branch. No hours are copied from the 2019 opening notice.", image: "/davenport-table/media/food/huey-magoos-logo.jpg", alt: "Huey Magoo's Chicken Tenders logo.", caption: "Official Huey Magoo's logo, not a photo of the ChampionsGate restaurant." },
    "moes": { href: "https://locations.moes.com/fl/clermont/890-us-hwy-27", name: "Moe's Southwest Grill, Four Corners", text: "The nearest verified Moe's branch, at 890 US Hwy 27, Clermont. Burritos and bowls. This is not a Champions Gate storefront.", image: "/davenport-table/media/food/moes-logo.png", alt: "Moe's Southwest Grill logo.", caption: "Official logo from the Four Corners location page, not a photo of the restaurant." },
    "outback": { href: "https://locations.outback.com/florida/davenport/996-heritage-pass", name: "Outback Steakhouse, Davenport", text: "Steaks at 996 Heritage Pass. The only Outback listed for Davenport." },
    "longhorn": { href: "https://www.longhornsteakhouse.com/locations/fl/davenport/championsgate/5616", name: "LongHorn Steakhouse, ChampionsGate", text: "Steaks at 8095 Osceola Polk Line Rd, just east of I-4 exit 58." },
    "carrabbas": { href: "https://locations.carrabbas.com/florida/davenport/1005-heritage-pass", name: "Carrabba's Italian Grill, Davenport", text: "Italian grill at 1005 Heritage Pass, next to the Davenport Outback." },
    "texas-roadhouse": { href: "https://www.texasroadhouse.com/locations/champions-gate", name: "Texas Roadhouse, Champions Gate", text: "The Champions Gate store is at 1997 Aegean Way, Davenport, FL 33896. Census did not match that address, and the location page did not publish coordinates, so it is not given a mile ranking." }
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
    if (extra.image) {
      var figure = document.createElement("figure");
      figure.className = "food-photo";
      var img = document.createElement("img");
      img.src = extra.image;
      img.alt = extra.alt;
      var cap = document.createElement("figcaption");
      cap.textContent = extra.caption;
      figure.appendChild(img);
      figure.appendChild(cap);
      article.appendChild(figure);
    }
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
    var ledeText = "Sorted by driving miles from the resort map marker. " + METHOD;
    if (lede && lede.textContent !== ledeText) lede.textContent = ledeText;
    var host = document.getElementById("unrouted-places");
    if (!host) {
      host = document.createElement("section");
      host.id = "unrouted-places";
      host.className = "stack";
      host.innerHTML = '<h2>Address known, distance not routed</h2><p class="hint" id="unrouted-note"></p><div class="card-grid" id="unrouted-grid"></div>';
      grid.insertAdjacentElement("afterend", host);
    }
    var unroutedNote = "These addresses are verified. Driving miles are not shown, so they are not in the ranking. Blue Marlin is the resort restaurant at 1115 Aloha Blvd; Census and OpenStreetMap did not match that street number, and the map marker only reverse-geocodes to Aloha Boulevard. Texas Roadhouse Champions Gate is at 1997 Aegean Way; Census did not match it, and the location page did not publish coordinates.";
    var noteEl = document.getElementById("unrouted-note");
    if (noteEl && noteEl.textContent !== unroutedNote) noteEl.textContent = unroutedNote;
    var blue = document.querySelector('article[data-place="blue-marlin"]');
    if (!blue) {
      var cards = document.querySelectorAll("article");
      for (var n = 0; n < cards.length; n += 1) {
        var link = cards[n].querySelector("a");
        var href = link ? link.getAttribute("href") || "" : "";
        if (href.indexOf("/blue-marlin") !== -1) { blue = cards[n]; break; }
      }
    }
    var roadhouse = document.querySelector('article[data-place="texas-roadhouse"]') || card("texas-roadhouse");
    var unroutedGrid = document.getElementById("unrouted-grid");
    if (roadhouse && unroutedGrid && roadhouse.parentElement !== unroutedGrid) unroutedGrid.appendChild(roadhouse);
    var roadNote = roadhouse.querySelector(".distance-note");
    var roadText = "Distance not routed. No Census match and no coordinates on the location page.";
    if (!roadNote) {
      roadNote = document.createElement("p");
      roadNote.className = "hint distance-note";
      roadhouse.appendChild(roadNote);
    }
    if (roadNote.textContent !== roadText) roadNote.textContent = roadText;
    if (blue && unroutedGrid) {
      blue.setAttribute("data-place", "blue-marlin");
      if (blue.parentElement !== unroutedGrid) unroutedGrid.appendChild(blue);
      var blueNote = blue.querySelector(".distance-note");
      var blueText = "Distance not routed. The street number did not geocode, so it is not in the mile ranking.";
      if (!blueNote) {
        blueNote = document.createElement("p");
        blueNote.className = "hint distance-note";
        blue.appendChild(blueNote);
      }
      if (blueNote.textContent !== blueText) blueNote.textContent = blueText;
    }
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

  function gamesBoard() {
    if (!/\/games\/?$/.test(location.pathname) || document.querySelector("script[data-games-board]")) return;
    var script = document.createElement("script");
    script.src = "/davenport-table/games-board.js";
    script.dataset.gamesBoard = "1";
    document.body.appendChild(script);
  }
  function apply() {
    nav();
    eats();
    gamesLink();
    gamesBoard();
  }
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
})();
