export const LISTING_URL = "https://www.airbnb.com/rooms/1808417579546681827";
export const LISTING_TITLE = "Sleep 24 Super Spacious Pool Villa Steps to Resort";
export const AREA_MAP_URL =
  "https://www.openstreetmap.org/search?query=Four%20Corners%2C%20Florida%20US-27";
/** Public Maps search for the resort area. Not a Maps API key, and not a pin on the house. */
export const RESORT_GOOGLE_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Windsor+Island+Resort+Davenport+Florida";
/**
 * Keyless embed centered on the resort, not a villa street.
 * 28.312206 N, 81.659872 W is the resort point published by Coasterpedia.
 * z=15 is neighborhood scale. No pb= parameters.
 */
export const RESORT_GOOGLE_MAPS_EMBED_URL =
  "https://www.google.com/maps?ll=28.312206,-81.659872&z=15&output=embed";
export const AI_FOOD_CAPTION = "AI-generated food illustration—not a restaurant photo";
export const PHOTO_CREDIT = "Listing photograph from the public Airbnb page";

export type Photo = { src: string; alt: string };

const shot = (id: string, alt: string): Photo => ({
  src: `/media/listing/${id}.jpg`,
  alt,
});

export type SlotDef = { id: string; label: string; detail: string };
export type RoomDef = {
  id: string;
  name: string;
  arrangement: string;
  bath: string;
  slots: SlotDef[];
  photos: Photo[];
  note?: string;
};

const wholeRoom = (id: string, detail: string): SlotDef => ({
  id,
  label: "Whole room",
  detail,
});

export const ROOMS: RoomDef[] = [
  {
    id: "bedroom-1",
    name: "Bedroom 1",
    arrangement: "1 king",
    bath: "Private bathroom toward the patio, per the host description.",
    slots: [wholeRoom("bedroom-1", "One claim for the whole room. A king is not split between two peeps.")],
    photos: [
      shot("2882993928", "Bedroom 1, one large bed the listing calls a king, with a patterned cover, wood dresser, and a doorway into a bathroom."),
      shot("2882993929", "Closer view of the Bedroom 1 bed, gray dresser, and a mirror, with the bathroom doorway in the background."),
      shot("2882993931", "Bedroom 1 from the foot of the bed, showing a geometric wall medallion, dresser, and double closet doors."),
    ],
  },
  {
    id: "bedroom-2",
    name: "Bedroom 2",
    arrangement: "2 queens",
    bath: "Private bathroom, per the host description.",
    slots: [
      { id: "bedroom-2-a", label: "Queen bed A", detail: "One of the two queens. A peep can claim one bed or both." },
      { id: "bedroom-2-b", label: "Queen bed B", detail: "The other queen. Claiming a bed coordinates sleep, it does not price a share." },
    ],
    photos: [
      shot("2882993962", "Bedroom 2 with two queen beds, gray tufted headboards, and windows with palm trees outside."),
      shot("2882993953", "The two Bedroom 2 queens from the near bed, with a dresser and mirror on the far wall."),
    ],
  },
  {
    id: "bedroom-3",
    name: "Bedroom 3",
    arrangement: "1 king",
    bath: "Private bathroom, per the host description.",
    slots: [wholeRoom("bedroom-3", "One claim for the whole room.")],
    photos: [
      shot("2882994159", "Bedroom 3, one large bed the listing calls a king, pale wood bench at the foot, three windows."),
      shot("2882994164", "Bedroom 3 from beside the bed, with a light wood dresser and a framed abstract print."),
    ],
  },
  {
    id: "bedroom-4",
    name: "Bedroom 4",
    arrangement: "2 twins",
    bath: "Shares a bathroom with Bedroom 5, per the host description.",
    slots: [
      { id: "bedroom-4-a", label: "Twin bed A", detail: "One twin. Two people can claim this room as separate beds." },
      { id: "bedroom-4-b", label: "Twin bed B", detail: "The other twin." },
    ],
    photos: [
      shot("2882994202", "Bedroom 4 with two narrower beds the listing calls twins, a diamond-pattern accent wall, and a bathroom visible through the door."),
      shot("2882994215", "Both Bedroom 4 twin beds, geometric wall panels, and a window with a patterned valance."),
    ],
  },
  {
    id: "bedroom-5",
    name: "Bedroom 5",
    arrangement: "1 king",
    bath: "Shares a bathroom with Bedroom 4, per the host description.",
    slots: [wholeRoom("bedroom-5", "One claim for the whole room.")],
    photos: [
      shot("2882994216", "Bedroom 5, one large bed the listing calls a king, tufted gray headboard, crystal ceiling light, and beige walls."),
      shot("2882994269", "Bedroom 5 from the bed toward a dresser, with a bathroom doorway and a view into another room."),
    ],
  },
  {
    id: "bedroom-6",
    name: "Bedroom 6",
    arrangement: "1 king",
    bath: "Private bathroom, per the host description.",
    slots: [wholeRoom("bedroom-6", "One claim for the whole room.")],
    photos: [
      shot("2882994087", "Bedroom 6, one large bed the listing calls a king, cream cover, paneled accent wall, and a blue-patterned window valance."),
      shot("2882994082", "Bedroom 6 from the pillows, with an open bathroom showing a toilet and vanity."),
    ],
  },
  {
    id: "bedroom-7",
    name: "Bedroom 7",
    arrangement: "1 king",
    bath: "Private bathroom, per the host description.",
    slots: [wholeRoom("bedroom-7", "One claim for the whole room.")],
    photos: [
      shot("2882994032", "Bedroom 7, one large bed the listing calls a king, gray geometric accent wall, and two nightstands."),
      shot("2882994028", "Bedroom 7 from the side of the bed, round mirror, dresser, and a doorway toward another lit room."),
    ],
  },
  {
    id: "bedroom-8",
    name: "Bedroom 8",
    arrangement: "1 king",
    bath: "Private bathroom, per the host description.",
    note: "The photograph looks through one doorway into a bathroom and through another toward the pool table and snack bar.",
    slots: [wholeRoom("bedroom-8", "One claim for the whole room.")],
    photos: [
      shot("2882994073", "Bedroom 8, one large bed the listing calls a king. One doorway shows a bathroom; another opens toward the pool table and snack bar."),
    ],
  },
  {
    id: "bedroom-9",
    name: "Bedroom 9",
    arrangement: "Full-over-full bunk",
    bath: "Shares a bathroom with Bedroom 10, per the host description.",
    slots: [
      { id: "bedroom-9-lower", label: "Lower full bunk", detail: "Lower bunk of the full-over-full bed." },
      { id: "bedroom-9-upper", label: "Upper full bunk", detail: "Upper bunk. A claim is a sleeping spot, not a priced share." },
    ],
    photos: [
      shot("2882994161", "Bedroom 9, a dark wood bunk bed in a light blue room. The listing describes the bunks as full over full."),
      shot("2882994157", "The Bedroom 9 bunk from the side, blue wall, polka-dot curtains, and a small black side table."),
    ],
  },
  {
    id: "bedroom-10",
    name: "Bedroom 10",
    arrangement: "Twin-over-full bunk",
    bath: "Shares a bathroom with Bedroom 9, per the host description.",
    slots: [
      { id: "bedroom-10-lower", label: "Lower full bunk", detail: "The wider lower bunk." },
      { id: "bedroom-10-upper", label: "Upper twin bunk", detail: "The narrower upper bunk." },
    ],
    photos: [
      shot("2882994121", "Bedroom 10, a bunk with a narrower top and a wider bottom. The listing describes it as twin over full. Sports bedding and blue striped walls."),
      shot("2882994118", "Bedroom 10 from the foot of the bunk, with sports prints, a soccer-ball light, and two round ottomans."),
    ],
  },
];

export function findSlot(slotId: string): { room: RoomDef; slot: SlotDef } | null {
  for (const room of ROOMS) {
    const slot = room.slots.find((item) => item.id === slotId);
    if (slot) return { room, slot };
  }
  return null;
}

export type GalleryShot = Photo & { caption: string };

export const HOUSE_GALLERY: { id: string; title: string; lede: string; shots: GalleryShot[] }[] = [
  {
    id: "pool",
    title: "Pool and spa, on the house",
    lede: "The private pool and spa, inside the screen. The water park down the path is a different set of pictures.",
    shots: [
      {
        ...shot("2882994322", "Screened lanai with a rectangular pool and an octagonal spa in front, an outdoor dining table under the roof, and palms beyond the screen."),
        caption: "Pool, spa, and the covered table. This is the share image from the listing.",
      },
      {
        ...shot("2882993736", "The private pool looking down its length, entry steps in the water, spa at the far end, and a safety fence in front of the covered patio."),
        caption: "Pool steps and the spa at the far end.",
      },
      {
        ...shot("2882993740", "Private pool and spa inside a screen cage. A water slide is visible in the distance, outside the cage."),
        caption: "The slide in the distance is outside the screen. It is not the villa pool.",
      },
      {
        ...shot("2882993743", "Octagonal spa in the foreground, rectangular pool beside it, and the covered dining set behind a mesh fence."),
        caption: "Spa in front of the pool, dining set under the cover.",
      },
    ],
  },
  {
    id: "lanai",
    title: "The screened patio",
    lede: "Grill, sofa, and a table under the roof. Whether it becomes the second game table is still open.",
    shots: [
      {
        ...shot("2882994281", "Covered patio with a built-in grill, wicker dining chairs, and the screened pool to the right."),
        caption: "A grill is visible. The listing prices an optional BBQ at $100 for the stay. That fee is not in the lodging split.",
      },
      {
        ...shot("2882993671", "Screened lanai with a wicker sofa, a glass dining table set for six in this view, opening into the indoor dining room."),
        caption: "Lanai seating looking into the house. This crop shows six chairs, not a verified count of ten.",
      },
      {
        ...shot("2882993681", "Wide view of the screened lanai, pool and spa on the left, wicker dining table on the right."),
        caption: "Pool, spa, and the outdoor table together.",
      },
    ],
  },
  {
    id: "play",
    title: "Mario room",
    lede: "Downstairs, the way the host describes it: Mario on the walls, foosball, air hockey, and a small white console.",
    shots: [
      {
        ...shot("2882994328", "Mario-themed game room with a foosball table in front, an air-hockey table beside a Mario and Yoshi mural, and a small white game console on a shelf."),
        caption: "Foosball, air hockey, and a Mario mural. The white console's brand is not legible.",
      },
      {
        ...shot("2882994274", "Game room with Mario murals, a yellow and red counter, foosball, air hockey, two gaming chairs, and screens in brick alcoves."),
        caption: "The room the listing calls the Mario arcade.",
      },
      {
        ...shot("2882994276", "Foosball table in front of a brick wall of Mario art, with a small white game console on the shelf between screens."),
        caption: "Listing amenities include a game console. The photograph shows a small white one; the brand is not named here.",
      },
      {
        ...shot("2882994277", "Air-hockey table in the foreground, foosball behind it, Mario wall art, and a staircase at the right edge."),
        caption: "Stairs at the edge of the Mario room.",
      },
    ],
  },
  {
    id: "table",
    title: "Pool table and snack bar",
    lede: "Upstairs living room, pool table, and a snack bar with a cold fridge.",
    shots: [
      {
        ...shot("2882994022", "Light wood pool table with balls racked, three black pendants, and a sectional living room visible beyond."),
        caption: "Pool table. The listing names a pool table; this is the photograph.",
      },
      {
        ...shot("2882993979", "Pool table, a wall-mounted television, black barn doors, and a high-top table with chairs."),
        caption: "The same loft, from the other side.",
      },
      {
        ...shot("2882993988", "Snack nook with a round high-top, a sink, white cabinets, and a glass-door beverage fridge."),
        caption: "The snack bar next to the pool table.",
      },
      {
        ...shot("2882993955", "Upstairs-style living room with a large gray sectional, coffee table, and a television over a cabinet."),
        caption: "Sectional in the second living room, connected to the pool table.",
      },
      {
        ...shot("2882993981", "Sectional in the foreground and the pool table visible down the room."),
        caption: "One continuous loft: sofa, then the pool table.",
      },
    ],
  },
  {
    id: "dining",
    title: "Kitchen and the long indoor table",
    lede: "The long indoor table, with the kitchen island beside it.",
    shots: [
      {
        ...shot("2882993837", "Open dining and living room with a long wood table, upholstered chairs, tufted counter stools, and sliding doors toward the pool."),
        caption: "Indoor table, looking toward the pool.",
      },
      {
        ...shot("2882993783", "Long light-wood dining table with upholstered chairs and round mirrors on a paneled wall."),
        caption: "The indoor table. Seat count is the organizer's figure, not a count from this photo.",
      },
      {
        ...shot("2882994320", "Great room with a cream sectional, glass coffee table, kitchen island, and the dining table in the background."),
        caption: "Living room, kitchen island, and dining in one view.",
      },
      {
        ...shot("2882993884", "White kitchen with a large island, four gray tufted stools, a stainless refrigerator, and a microwave over the range."),
        caption: "The kitchen island.",
      },
    ],
  },
];

export const RESORT_GALLERY: GalleryShot[] = [
  {
    ...shot("2882994325", "Stone entrance sign reading Windsor Island Resort, with a small tower and palm trees."),
    caption: "The listing places the house at Windsor Island Resort. This is the resort sign, not a street address.",
  },
  {
    ...shot("2882994395", "Aerial of a resort lazy river with a looping water slide, inner tubes, and palm trees. Not the villa's private pool."),
    caption: "Resort lazy river from the listing gallery. Not the house pool.",
  },
  {
    ...shot("2882993786", "Mini-golf green with a pale boulder, palms, and a resort building in the background."),
    caption: "Resort mini golf.",
  },
  {
    ...shot("2882993793", "Another mini-golf hole with a pelican statue on a stump."),
    caption: "Resort mini golf, second hole in the gallery.",
  },
  {
    ...shot("2882994380", "Aerial of a bright blue outdoor basketball court, with the resort pool complex behind it."),
    caption: "Resort basketball court. The pool behind it is the resort pool, not the villa.",
  },
  {
    ...shot("2882994357", "Wide aerial of the resort pool, lazy river, and blue-roofed buildings. No map pin is drawn on this photo."),
    caption: "Resort overview. An aerial that had a graphic map pin was left out of this site.",
  },
  {
    ...shot("2882994358", "Sunset beyond palm trees, with striped hammocks and lounge chairs. The photo is not labeled as the villa yard."),
    caption: "Sunset hammocks in the listing gallery. Not labeled as the house.",
  },
  {
    ...shot("2882994360", "Large fitness room with several treadmills and weight machines, and palm trees outside tall windows."),
    caption: "The listing names a gym. This photograph looks like a shared resort fitness room, so it is not filed as a room of the house.",
  },
  {
    ...shot("2882994396", "A room signed Gaming Zone, with commercial arcade cabinets and an air-hockey table by a wall of windows."),
    caption: "A separate gaming-zone photo. It is not labeled as the villa's Mario room, and it is not presented as one.",
  },
];

export type Highlight = { name: string; detail: string; href?: string };
export type FoodPhoto = {
  src: string;
  alt: string;
  caption: string;
  /** Set when a picture is added later. Illustrations must say they are not restaurant photos. */
  kind?: "official" | "illustration";
  credit?: string;
};
export type Restaurant = {
  slug: string;
  name: string;
  why: string;
  address: string;
  phone: string;
  site: string;
  siteLabel: string;
  menu: string;
  hours: string | null;
  hoursGap: string | null;
  highlights: Highlight[];
  photos: FoodPhoto[];
  note: string;
};

export const RESTAURANTS: Restaurant[] = [
  {
    slug: "little-greek",
    name: "Little Greek Fresh Grill",
    why: "Casual Mediterranean on Champions Gate Boulevard, with shareable starters and a catering menu for a group.",
    address: "8310 Champions Gate Blvd, Champions Gate",
    phone: "321-401-4697",
    site: "https://championsgate.littlegreekfreshgrill.com/",
    siteLabel: "Champions Gate location",
    menu: "https://championsgate.littlegreekfreshgrill.com/menu/",
    hours: "Monday–Thursday 11 a.m.–9 p.m., Friday–Saturday 11 a.m.–10 p.m., Sunday 11 a.m.–9 p.m.",
    hoursGap: "Hours as stated on the location page on November 6, 2026. Re-check before January.",
    highlights: [
      { name: "Gyro pita", detail: "Lettuce, tomatoes, onions, and tzatziki, from the first-party menu. A third-party price was seen elsewhere and is not repeated here." },
      { name: "Olympian pita", detail: "Chicken and gyro in one pita." },
      { name: "Chicken skewers (souvlaki) dinner", detail: "Three char-grilled chicken skewers over rice, with a Greek salad." },
      { name: "Greek salad", detail: "Build-your-own Greek salad on the menu." },
      { name: "Dolmades and hummus with pita", detail: "Starters named on the first-party menu. The dolmades photograph does not show the hummus." },
    ],
    photos: [
      {
        src: "/media/food/little-greek-gyro.jpg",
        alt: "Gyro in a pita with tomato, lettuce, red onion, and white sauce, wrapped in Little Greek paper.",
        caption: "Gyro, from Little Greek's image library.",
      },
      {
        src: "/media/food/little-greek-dolmades.jpg",
        alt: "Three stuffed grape leaves on a blue-rimmed plate with lemon wedges and a small cup of sauce.",
        caption: "Dolmades. Not a photo of the hummus.",
      },
      {
        src: "/media/food/little-greek-chicken-salad.png",
        alt: "Greek salad topped with grilled chicken strips, crumbled feta, tomato, cucumber, red onion, an olive, and a pepperoncini.",
        caption: "Chicken Greek salad from their image library.",
      },
      {
        src: "/media/food/little-greek-pita-bar.jpg",
        alt: "Sliced meat, a stack of pita, shredded lettuce, sliced tomato, sliced red onion, and a cup of white sauce on a wooden board.",
        caption: "Pita-bar ingredients from their image library.",
      },
    ],
    note: "Curated highlights, not the full menu. No prices are shown because the first-party lines we kept did not include a price we are willing to repeat. They also publish a catering PDF for Champions Gate.",
  },
  {
    slug: "millers",
    name: "Miller's Ale House, Champions Gate",
    why: "A big sports-bar menu with large-party boxes, on Laura Lane in Davenport.",
    address: "8170 Laura Ln, Davenport, FL 33896",
    phone: "407-274-9731",
    site: "https://millersalehouse.com/locations/champions-gate/",
    siteLabel: "Champions Gate location",
    menu: "https://millersalehouse.com/menu/",
    hours: null,
    hoursGap: "The location page disagreed with itself about the Sunday–Thursday close (2:00 a.m. in one place, 1:00 a.m. in another). No hours are listed until that is settled.",
    highlights: [
      { name: "Zingers", detail: "Six hand-breaded buttermilk chicken tenders tossed in a sauce. No photo of this dish is on this page." },
      { name: "Zingers Mountain Melt", detail: "Zingers on cheesy bacon-loaded fries." },
      { name: "Sports Bar Nachos", detail: "Smoked chicken, chorizo roasted-corn queso, cheeses, jalapeños, pico, guacamole, and sour cream." },
      { name: "Classic cheeseburger", detail: "Hand-formed burger with cheese and vegetables, and fries." },
      { name: "Wings & Zings Box / Zings Box", detail: "Large-party platters. The menu lists 24 and 50 counts." },
    ],
    photos: [
      {
        src: "/media/food/millers-bbq-plate.webp",
        alt: "Oval plate with a barbecue rib rack, french fries, green beans, and a piece of chicken topped with bacon, melted cheese, and sauce.",
        caption: "Stacked BBQ chicken and half-rack holiday plate from the Miller's site in November 2026. It is not a picture of the Zingers or the nachos.",
      },
      {
        src: "/media/food/millers-lifestyle.jpg",
        alt: "Four people toasting with beers at a wooden table, with nachos and fried appetizers. A bar and televisions are behind them.",
        caption: "Brand lifestyle photo from millersalehouse.com. Not verified as the Champions Gate dining room.",
      },
    ],
    note: "Curated highlights, not the full menu. Prices were not copied. Checked November 6, 2026, not a January quote.",
  },
  {
    slug: "palma",
    name: "Palma Italian Kitchen",
    why: "Italian plates and pizzas on Champions Gate Boulevard, with a groups page on their site.",
    address: "8266 Champions Gate Blvd, Champions Gate, FL 33896",
    phone: "407-479-2098",
    site: "https://palmaitalian.com/",
    siteLabel: "Palma Italian Kitchen",
    menu: "https://palmaitalian.com/menu/",
    hours: null,
    hoursGap: "The menu page listed more than one set of hours, including a September-only banner. No hours are shown.",
    highlights: [
      { name: "Nonna's Meatballs", detail: "$17 on November 6, 2026. Veal, beef, and pork, marinara, whipped ricotta, focaccia." },
      { name: "The Godfather Nachos", detail: "$19. Fried pasta chips, Bolognese, Alfredo, pepperoncini, pistachio pesto crema, bruschetta." },
      { name: "Hot Honey Pizza", detail: "$16. Mozzarella, ricotta, pepperoni, crispy prosciutto, red onion, hot honey." },
      { name: "Bolognese", detail: "$26. House Bolognese with pappardelle or gnocchi." },
      { name: "Lasagna Fritti", detail: "Fried nine-layer lasagna with marinara and mozzarella, plus a side salad. A price was not kept from the menu notes." },
    ],
    photos: [
      {
        src: "/media/food/palma-italian-ai-illustration.jpg",
        alt: "Illustrated plate of pasta with meatballs and a side of pizza, painted rather than photographed.",
        caption: AI_FOOD_CAPTION,
        kind: "illustration",
      },
    ],
    note: "Curated highlights, not the full menu. Prices are from the restaurant's menu page on November 6, 2026, not a promise for January. A newspaper feature image was the only picture on that page, and it is not used here. There is still no verified dish photograph.",
  },
  {
    slug: "four-corners-tavern",
    name: "4 Corners Tavern",
    why: "A Champions Gate gastropub a short walk in name from the other three. The full menu did not come through as text.",
    address: "8250 Champions Gate Blvd, Champions Gate, FL 33896",
    phone: "407-479-2172",
    site: "https://www.4cornerstavern.com/",
    siteLabel: "4 Corners Tavern",
    menu: "https://www.4cornerstavern.com/menus/lunch-and-dinner",
    hours: null,
    hoursGap: "Hours were not in the pages we could read, so none are listed.",
    highlights: [
      {
        name: "Smokehouse Nachos",
        detail: "Smoked chicken or pork $15; brisket or shaved sirloin $18. Queso, tomato, jalapeños, onions. Prices from the restaurant's item page on November 6, 2026.",
        href: "https://www.4cornerstavern.com/items/smokehouse-nachos-2",
      },
    ],
    photos: [
      {
        src: "/media/food/four-corners-logo.png",
        alt: "4 Corners Tavern wordmark in white on a solid green background.",
        caption: "Logo only. A kitchen photograph from the site showed equipment, not a dish, so it is not used.",
        kind: "official",
      },
      {
        src: "/media/food/four-corners-tavern-ai-illustration.jpg",
        alt: "Illustrated pub plate with a burger, fries, and a small bowl of smoked meat.",
        caption: AI_FOOD_CAPTION,
        kind: "illustration",
      },
    ],
    note: "The lunch and dinner menu is a script-heavy page and returned HTTP 403 to a normal fetch. That is a block, not a missing page. One item page did load. Burgers and ribs mentioned only on a third-party app listing are not included.",
  },
  {
    slug: "tacos-don-andres",
    name: "Tacos Don Andrés, ChampionsGate",
    why: "On the same Champions Gate strip. The site shows shareable tacos, birria, and a molcajete.",
    address: "8281 Champions Gate Blvd, Davenport, FL 33896",
    phone: "(321) 401-4378",
    site: "https://tacosdonandres.netlify.app/",
    siteLabel: "Tacos Don Andrés",
    menu: "https://tacosdonandres.netlify.app/",
    hours: null,
    hoursGap: "No first-party hours text was on the marketing site. Third-party listings are not repeated as January hours.",
    highlights: [
      { name: "Birria tacos", detail: "Named on the restaurant site, with a photograph from that site." },
      { name: "Quesabirria", detail: "Named on the restaurant site." },
      { name: "Molcajete", detail: "Named on the restaurant site." },
      { name: "Churrasco", detail: "Named on the restaurant site." },
    ],
    photos: [
      {
        src: "/media/food/tacos-don-andres-birria-tacos.jpg",
        alt: "Three birria tacos in a row with consome, from the Tacos Don Andrés site.",
        caption: "Photograph from the Tacos Don Andrés site.",
        kind: "official",
      },
      {
        src: "/media/food/tacos-don-andres-quesabirria.jpg",
        alt: "Quesabirria tacos with a cheese pull, from the Tacos Don Andrés site.",
        caption: "Photograph from the Tacos Don Andrés site.",
        kind: "official",
      },
      {
        src: "/media/food/tacos-don-andres-molcajete.jpg",
        alt: "A molcajete of meat and salsa, from the Tacos Don Andrés site.",
        caption: "Photograph from the Tacos Don Andrés site.",
        kind: "official",
      },
    ],
    note: "Signature dishes from the first-party site. A reservation app link only led to a login, so it is not used as a menu. No drive time is given.",
  },
  {
    slug: "fords-garage",
    name: "Ford's Garage, ChampionsGate",
    why: "A large burger room with a patio and catering platters, on Osceola Polk Line Road.",
    address: "8035 Osceola Polk Line Rd, Davenport, FL 33896",
    phone: "(321) 966-3673",
    site: "https://fordsgarageusa.com/locations/championsgate/",
    siteLabel: "ChampionsGate location",
    menu: "https://fordsgarageusa.com/menu/",
    hours: null,
    hoursGap: "A press note for this location listed hours, but they are not treated as January hours. The location and menu pages blocked an automated check with HTTP 403, which is not a missing page.",
    highlights: [
      { name: "Estate Burger", detail: "Named on the brand menu: smoked gouda, onion marmalade, onion straws." },
      { name: "Classic Cheeseburger", detail: "Named on the brand menu." },
      { name: "Baby back ribs", detail: "Named on the brand menu." },
      { name: "Bourbon BBQ wings", detail: "Named on the brand menu." },
    ],
    photos: [
      {
        src: "/media/food/fords-garage-ai-illustration.jpg",
        alt: "Illustrated burger and fries on a metal tray, not a photograph from Ford's Garage.",
        caption: AI_FOOD_CAPTION,
        kind: "illustration",
      },
    ],
    note: "No first-party dish photo could be fetched. The picture is an illustration. No drive time is given.",
  },
  {
    slug: "flippers",
    name: "Flippers Pizza Co., Champions Gate / Reunion",
    why: "Pizza, salads, and wings with dine-in, carryout, and delivery called out for this area, plus a catering page.",
    address: "7967 Osceola Polk Line Rd, Davenport, FL 33896",
    phone: "(863) 588-7711",
    site: "https://www.flipperspizzaco.com/champions-gate",
    siteLabel: "Champions Gate location",
    menu: "https://www.flipperspizzaco.com/menu",
    hours: null,
    hoursGap: "The location page listed Sunday–Saturday 10:00 a.m.–12:00 a.m. on November 6, 2026. That is not a January promise.",
    highlights: [
      { name: "Pepperoni Napoli", detail: "Named on the Flippers menu." },
      { name: "Hog & Honey", detail: "Named on the Flippers menu." },
      { name: "Margherita", detail: "Named on the Flippers menu." },
      { name: "Oven-baked wings", detail: "Named on the Flippers menu." },
    ],
    photos: [
      {
        src: "/media/food/flippers-pizza-dish-a.jpg",
        alt: "A pizza on a metal peel, from Flippers' location page.",
        caption: "Photograph from the Flippers location page.",
        kind: "official",
      },
      {
        src: "/media/food/flippers-pizza-dish-b.jpg",
        alt: "A salad plate from Flippers, not a pizza.",
        caption: "Photograph from Flippers. This frame is a salad plate.",
        kind: "official",
      },
    ],
    note: "The site also mentions a gluten-friendly cauliflower crust and says to ask about cross-contact. No drive time is given.",
  },
  {
    slug: "honeys-bbq",
    name: "Honey's BBQ, Posner Park",
    why: "Smokehouse meats by the pound and family platters, for a house dinner that is mostly meat.",
    address: "2200 Posner Blvd, Davenport, FL 33837",
    phone: "(863) 424-7300",
    site: "https://honeysbbque.com/",
    siteLabel: "Honey's BBQ",
    menu: "https://honeysbbque.com/menu/",
    hours: null,
    hoursGap: "The visit page listed Wednesday–Monday 12 p.m.–9 p.m. and Tuesday closed, as of November 6, 2026. That is not a January promise.",
    highlights: [
      { name: "Smokehouse Sampler", detail: "Listed at $25 on November 6, 2026. Not a January price." },
      { name: "Family Feast for Four", detail: "Listed at $69 on November 6, 2026. Not a January price." },
      { name: "St. Louis ribs", detail: "Named on the Honey's menu." },
      { name: "Brisket", detail: "Named on the Honey's menu as local grass-fed brisket." },
    ],
    photos: [
      {
        src: "/media/food/honeys-smokehouse-sampler.jpg",
        alt: "A board of smoked meats from Honey's BBQ.",
        caption: "Photograph from the Honey's site.",
        kind: "official",
      },
      {
        src: "/media/food/honeys-smoked-wings.jpg",
        alt: "A pile of smoked chicken wings from Honey's BBQ.",
        caption: "Photograph from the Honey's site.",
        kind: "official",
      },
    ],
    note: "Prices above are from the first-party menu on November 6, 2026. No drive time is given.",
  },
  {
    slug: "tijuana-flats",
    name: "Tijuana Flats, Champions Gate",
    why: "Build-your-own bowls, tacos, and burritos on the Champions Gate strip.",
    address: "8274 Champions Gate Blvd, Champions Gate, FL 33896",
    phone: "",
    site: "https://www.tijuanaflats.com/locations/champions-gate",
    siteLabel: "Champions Gate location",
    menu: "https://www.tijuanaflats.com/menu",
    hours: null,
    hoursGap: "The location page listed Monday–Saturday 10:30 a.m.–10:00 p.m. and Sunday 10:30 a.m.–9:00 p.m. on November 6, 2026. That is not a January promise.",
    highlights: [
      { name: "Bowl", detail: "Named on the Tijuana Flats menu." },
      { name: "Dos Tacos", detail: "Named on the Tijuana Flats menu." },
      { name: "Burrito", detail: "Named on the Tijuana Flats menu." },
      {
        name: "Menu PDF",
        detail: "A September 2025 menu PDF from the restaurant. Not a January price list.",
        href: "https://api.tijuanaflats.com/app/uploads/2024/11/Menu_Sept2025_11x17_T1_Compressed.pdf",
      },
    ],
    photos: [
      {
        src: "/media/food/tijuana-flats-burrito.jpg",
        alt: "A burrito cut open, from Tijuana Flats' site.",
        caption: "Photograph from the Tijuana Flats site.",
        kind: "official",
      },
      {
        src: "/media/food/tijuana-flats-dos-tacos.jpg",
        alt: "Two tacos on a plate, from Tijuana Flats' site.",
        caption: "Photograph from the Tijuana Flats site.",
        kind: "official",
      },
    ],
    note: "No phone number was copied because the research notes did not include a first-party number. No drive time is given.",
  },
  {
    slug: "blue-marlin",
    name: "Blue Marlin Grille, Windsor Island",
    why: "A resort grill at Windsor Island for a meal without leaving the property. It is a convenience, not the plan for a late night.",
    address: "1115 Aloha Blvd, Davenport, FL 33897",
    phone: "(863) 438-5950",
    site: "https://order.toasttab.com/online/blue-marlin-grille",
    siteLabel: "Toast order page",
    menu: "https://order.toasttab.com/online/blue-marlin-grille",
    hours: null,
    hoursGap: "Close times disagreed across secondary notes, so none are listed. January hours are not verified. The Toast page reads as an order link, not proof of a late dine-in service.",
    highlights: [
      { name: "Four Corners Sampler", detail: "Named on the Toast listing." },
      { name: "Windsor Wings", detail: "Named on the Toast listing." },
      { name: "Double Patty Smash Burger", detail: "Named on the Toast listing." },
      { name: "Aloha Burger", detail: "Named on the Toast listing." },
    ],
    photos: [
      {
        src: "/media/food/blue-marlin-grille-ai-illustration.jpg",
        alt: "Illustrated grill plate with a burger, wings, and a salad, not a photograph from Blue Marlin Grille.",
        caption: AI_FOOD_CAPTION,
        kind: "illustration",
      },
    ],
    note: "The phone is the one shown with the Toast listing. The Toast and resort pages blocked an automated check with HTTP 403, which is not a missing page. No first-party dish photo was found. No drive time is given.",
  },
];

export function restaurantBySlug(slug: string): Restaurant | undefined {
  return RESTAURANTS.find((restaurant) => restaurant.slug === slug);
}

export const CATERING_PDF = "https://cdn.littlegreekfreshgrill.com/catering/GREEK008-Champions-Gate-Catering-Menu.pdf";

/** Slot for a future rules blurb. Empty on purpose: this site does not invent rules. */
export type GameSupplement = {
  rules?: { summary: string; sourceName: string; sourceUrl: string };
  image?: { src: string; alt: string; credit: string };
};

export const gameSupplements: Record<string, GameSupplement> = {};
