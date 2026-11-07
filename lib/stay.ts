/** House time is Eastern. January 2027 is EST, UTC−5. */
export const STAY_DATES = ["2027-01-14", "2027-01-15", "2027-01-16", "2027-01-17", "2027-01-18"] as const;

export const STAY_START_MS = Date.parse("2027-01-14T16:00:00-05:00");
export const STAY_END_MS = Date.parse("2027-01-18T10:00:00-05:00");

export type StayDate = (typeof STAY_DATES)[number];

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});

const CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

export function stayDayLabel(date: StayDate): string {
  return DAY_LABEL.format(new Date(`${date}T12:00:00-05:00`));
}

/** null clears the time. undefined means the value is not a time inside the house window. */
export function normalizeStayMoment(input: unknown): string | null | undefined {
  if (input == null || input === "") return null;
  const ms = momentMs(input);
  if (ms == null || ms < STAY_START_MS || ms > STAY_END_MS) return undefined;
  return easternIso(ms);
}

export function stayOrderError(arrivalAt: string | null, departureAt: string | null): string | null {
  if (arrivalAt && departureAt && Date.parse(arrivalAt) >= Date.parse(departureAt)) {
    return "Arrival has to be before departure. Times are Eastern.";
  }
  return null;
}

export function formatStay(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "Not set";
  return `${DAY_LABEL.format(new Date(ms))} ${CLOCK.format(new Date(ms))} ET`;
}

export function stayParts(iso: string | null | undefined): { date: StayDate | ""; time: string } {
  if (!iso) return { date: "", time: "" };
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return { date: "", time: "" };
  const parts = easternParts(ms);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  if (!STAY_DATES.includes(date as StayDate)) return { date: "", time: "" };
  return { date: date as StayDate, time: `${parts.hour}:${parts.minute}` };
}

export type DayPresence = {
  date: StayDate;
  label: string;
  peeps: { id: string; name: string; detail: string }[];
};

export function dayPresence(
  peeps: { id: string; name: string; arrivalAt: string | null; departureAt: string | null }[],
): { days: DayPresence[]; unset: { id: string; name: string }[] } {
  const days: DayPresence[] = STAY_DATES.map((date) => {
    const start = Date.parse(`${date}T00:00:00-05:00`);
    const end = Date.parse(`${date}T23:59:59-05:00`);
    const here = peeps.flatMap((peep) => {
      const detail = presenceDetail(peep.arrivalAt, peep.departureAt, start, end);
      return detail ? [{ id: peep.id, name: peep.name, detail }] : [];
    });
    return { date, label: stayDayLabel(date), peeps: here };
  });
  const unset = peeps.filter((peep) => !peep.arrivalAt && !peep.departureAt).map((peep) => ({ id: peep.id, name: peep.name }));
  return { days, unset };
}

function presenceDetail(arrivalAt: string | null, departureAt: string | null, dayStart: number, dayEnd: number): string | null {
  const arrival = arrivalAt ? Date.parse(arrivalAt) : null;
  const departure = departureAt ? Date.parse(departureAt) : null;
  if (arrival == null && departure == null) return null;
  if (arrival != null && departure == null) {
    return arrival >= dayStart && arrival <= dayEnd ? `Arrives ${CLOCK.format(new Date(arrival))} ET` : null;
  }
  if (arrival == null && departure != null) {
    return departure >= dayStart && departure <= dayEnd ? `Leaves ${CLOCK.format(new Date(departure))} ET` : null;
  }
  if (arrival == null || departure == null || arrival >= departure) return null;
  if (departure <= dayStart || arrival > dayEnd) return null;
  if (arrival >= dayStart && arrival <= dayEnd && departure > dayEnd) return `From ${CLOCK.format(new Date(arrival))} ET`;
  if (departure >= dayStart && departure <= dayEnd && arrival < dayStart) return `Until ${CLOCK.format(new Date(departure))} ET`;
  if (arrival >= dayStart && departure <= dayEnd) {
    return `${CLOCK.format(new Date(arrival))}–${CLOCK.format(new Date(departure))} ET`;
  }
  return "Here";
}

function momentMs(input: unknown): number | null {
  if (typeof input === "string") {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(input)) return null;
    const ms = Date.parse(input);
    return Number.isNaN(ms) ? null : ms;
  }
  if (!input || typeof input !== "object") return null;
  const date = "date" in input ? String(input.date) : "";
  const time = "time" in input ? String(input.time) : "";
  if (!STAY_DATES.includes(date as StayDate) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const ms = Date.parse(`${date}T${time}:00-05:00`);
  return Number.isNaN(ms) ? null : ms;
}

function easternIso(ms: number): string {
  const parts = easternParts(ms);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00-05:00`;
}

function easternParts(ms: number): { year: string; month: string; day: string; hour: string; minute: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return {
    year: bag.year,
    month: bag.month,
    day: bag.day,
    hour: bag.hour,
    minute: bag.minute,
  };
}
