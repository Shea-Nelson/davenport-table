/**
 * Looked-up facts for games already on the shelf.
 * A title with no entry stays title-only. Player counts are never guessed.
 */
export type CatalogImage = {
  src: string;
  alt: string;
  credit: string;
  kind: "official" | "illustration";
};

export type VerifiedGame = {
  boardIds: string[];
  titles: string[];
  playersMin: number;
  playersMax: number;
  playersLabel: string;
  timeLabel: string;
  /** Left empty when sources disagree and neither is chosen. */
  ageLabel: string | null;
  ageNote: string | null;
  editionNote: string;
  summary: string;
  howToPlay: string[];
  sources: { name: string; url: string }[];
  images: CatalogImage[];
};

export const VERIFIED_GAMES: VerifiedGame[] = [
  {
    boardIds: ["05933007-cef5-4c20-baa0-e2746635fe0f"],
    titles: ["Captain Sonar"],
    playersMin: 2,
    playersMax: 8,
    playersLabel: "2–8",
    timeLabel: "About 45 minutes on the Matagot page. BoardGameGeek and Dice Tower listings say 45–60.",
    ageLabel: null,
    ageNote: "Matagot’s page and an English rules PDF say 12+. Asmodee USA’s product page says 14+. Those do not match, so no single age is shown.",
    editionNote: "The shelf title does not say which printing this copy is. The photos are publisher product shots, not a photo of the box in the house.",
    summary:
      "Two teams each run a submarine and try to find the other. The captain steers and calls attacks, the radio operator tracks what the other side announces, the first mate charges systems, and the engineer marks breakdowns. With fewer than eight people, some of those jobs share a seat. You can play turn by turn or at the same time.",
    howToPlay: [
      "Split into two teams. Give each team a captain, a radio operator, a first mate, and an engineer, and combine jobs if a side has fewer than four people.",
      "The captain starts in secret and calls each move north, south, east, or west. The route cannot cross an island or its own path.",
      "The other team’s radio operator listens to those calls and marks where that sub might be.",
      "The first mate charges the ship’s systems. The engineer marks damage in the section the sub just left.",
      "When a weapon is charged, the captain can fire. Pause and see what was hit.",
      "In a short game the first solid hit can end it. In the longer hunt, a sub usually has to be hit more than once.",
    ],
    sources: [
      { name: "Matagot — Captain Sonar", url: "https://www.matagot.com/en/strategy-games/133-captain-sonar.html" },
      { name: "Asmodee USA — Captain Sonar", url: "https://store.asmodee.com/products/captain-sonar" },
      { name: "BoardGameGeek — Captain Sonar", url: "https://boardgamegeek.com/boardgame/171131/captain-sonar" },
      { name: "English rules PDF hosted by North Star Games (2–8 players)", url: "https://www.northstreetgames.com/images/Rulebooks/Captain-Sonar-Rules-v5.pdf" },
    ],
    images: [
      {
        src: "/media/games/captain-sonar-matagot-cover.jpg",
        alt: "Captain Sonar box front from the publisher, with a submarine and the Matagot logo.",
        credit: "Product photo from Matagot. Not confirmed as the printing in the house.",
        kind: "official",
      },
      {
        src: "/media/games/captain-sonar-asmodee-CPT101.jpg",
        alt: "Another retail photo of a Captain Sonar box, from Asmodee.",
        credit: "Product photo from Asmodee USA. A second retail shot, not proof of which box was brought.",
        kind: "official",
      },
    ],
  },
  {
    boardIds: ["04f28292-7b2a-4f9a-aa9c-309fdeb1bf0c"],
    titles: ["Quacks All In Edition", "Quacks: All-In Edition", "Quacks All-In Edition"],
    playersMin: 2,
    playersMax: 5,
    playersLabel: "2–5",
    timeLabel: "About 45 minutes.",
    ageLabel: "10+",
    ageNote: "Asmodee, CMYK, and BoardGameGeek agree on 10+.",
    editionNote:
      "This is the All-In edition: deluxe pieces plus the Witches and Alchemists expansions, and a fifth player. It is not the older base game that stops at four.",
    summary:
      "Each person brews a potion by drawing chips from their own bag onto a pot. Higher numbers move you farther and pay better, but white cherry-bomb chips can blow the pot. Between rounds you buy stronger ingredients. After nine rounds, the most points wins. Teach the plain pot first. The extra modules in this box can wait.",
    howToPlay: [
      "Everyone gets a bag of ingredient chips and a pot board.",
      "On a round, draw one chip at a time and place it on the pot by the number on the chip.",
      "Stop when you want, or keep drawing. Too many cherry bombs explode the pot.",
      "A quiet pot scores points and coins from how far it got. An exploded pot usually takes points or coins, not both.",
      "Spend coins on new chips and put them in the bag.",
      "After nine rounds, the highest score wins.",
    ],
    sources: [
      { name: "CMYK — Quacks", url: "https://www.cmyk.games/products/quacks" },
      { name: "Asmodee USA — Quacks: All-In Edition", url: "https://store.asmodee.com/products/quacks-all-in-edition" },
      { name: "BoardGameGeek — Quacks: All-In Edition", url: "https://boardgamegeek.com/boardgame/441706/quacks-all-in-edition" },
      { name: "How to play video linked from the CMYK product page", url: "https://www.youtube.com/watch?v=Yh-e-B00VNc" },
    ],
    images: [
      {
        src: "/media/games/quacks-all-in-asmodee-cover.jpg",
        alt: "Quacks All-In Edition box, with the All-In banner on the cover.",
        credit: "Product photo from Asmodee USA for the All-In edition.",
        kind: "official",
      },
      {
        src: "/media/games/quacks-all-in-cmyk-cover-group27.png",
        alt: "CMYK shop image of the Quacks All-In edition box.",
        credit: "Product image from CMYK for the All-In edition, not the standard or deluxe-only boxes.",
        kind: "official",
      },
    ],
  },
];

export function catalogForShelf(game: { id: string; title: string }): VerifiedGame | undefined {
  const key = game.title.trim().toLowerCase();
  return VERIFIED_GAMES.find(
    (entry) => entry.boardIds.includes(game.id) || entry.titles.some((title) => title.trim().toLowerCase() === key),
  );
}

/** Shelf min/max are the person's table note. They are not the published range. */
export function shelfPreferenceNote(
  stored: { minPlayers: number | null; maxPlayers: number | null },
  catalog: VerifiedGame | undefined,
): string | null {
  if (!catalog) return null;
  if (stored.minPlayers == null && stored.maxPlayers == null) return null;
  const sameMin = stored.minPlayers == null || stored.minPlayers === catalog.playersMin;
  const sameMax = stored.maxPlayers == null || stored.maxPlayers === catalog.playersMax;
  if (sameMin && sameMax && stored.minPlayers === catalog.playersMin && stored.maxPlayers === catalog.playersMax) return null;
  const entered = [
    stored.minPlayers != null ? `minimum ${stored.minPlayers}` : "",
    stored.maxPlayers != null ? `maximum ${stored.maxPlayers}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `Entered on the shelf: ${entered}. The published range is ${catalog.playersLabel}. The shelf number is a table preference, not the published count.`;
}
