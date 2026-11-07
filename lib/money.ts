import type { RateRow } from "./types";

/** Inferred from the organizer's per-person quotes. Not an Airbnb invoice. */
export const LODGING_CENTS = 217_950;
export const HEAT_PER_NIGHT_CENTS = 4_000;
export const HEAT_NIGHTS = 4;
export const HEAT_CENTS = HEAT_PER_NIGHT_CENTS * HEAT_NIGHTS;
/** Listing text: spa-only heat. Not part of the shared toggle. */
export const SPA_ONLY_PER_NIGHT_CENTS = 2_500;
/** Listing text: optional grill fee. Not part of the inferred lodging total. */
export const BBQ_STAY_CENTS = 10_000;

/** Figures copied from the organizer's message for 7–10 people. */
export const SCREENSHOT_LODGING: Record<number, number> = {
  10: 21_795,
  9: 24_217,
  8: 27_244,
  7: 31_136,
};

export function shareCents(totalCents: number, people: number): number {
  if (!Number.isInteger(people) || people < 1) {
    throw new Error("A share needs at least one person.");
  }
  return Math.round(totalCents / people);
}

/** Equal share of the inferred lodging total, plus the four-night heat estimate when it is on. */
export function seatShare(people: number, includeHeat: boolean): { people: number; perPeepCents: number | null } {
  if (!Number.isInteger(people) || people < 1) return { people: 0, perPeepCents: null };
  const total = includeHeat ? LODGING_CENTS + HEAT_CENTS : LODGING_CENTS;
  return { people, perPeepCents: shareCents(total, people) };
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function referenceRows(): RateRow[] {
  const rows: RateRow[] = [];
  for (let people = 7; people <= 11; people += 1) {
    rows.push({
      people,
      lodgingCents: shareCents(LODGING_CENTS, people),
      heatCents: shareCents(HEAT_CENTS, people),
      source: SCREENSHOT_LODGING[people] != null ? "organizer-screenshot" : "computed",
    });
  }
  return rows;
}
