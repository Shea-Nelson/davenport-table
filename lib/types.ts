export type Attendee = {
  id: string;
  /** Stored name. The screen says peep. */
  nickname: string;
  note: string;
  createdAt: string;
  joinedLabel: string;
  /** Eastern ISO, or null when the peep has not set a time. Omitted by an older board. */
  arrivalAt?: string | null;
  departureAt?: string | null;
};

export type Claim = {
  slotId: string;
  attendeeId: string;
  nickname: string;
  note: string;
};

export type Game = {
  id: string;
  title: string;
  attendeeId: string;
  broughtBy: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  note: string;
  createdAt: string;
};

export type RateSource = "organizer-screenshot" | "computed";

export type RateRow = {
  people: number;
  lodgingCents: number;
  heatCents: number;
  source: RateSource;
};

export type CostSnapshot = {
  people: number;
  lodgingTotalCents: number;
  heatTotalCents: number;
  lodgingShareCents: number | null;
  heatShareCents: number | null;
  combinedCents: number | null;
  reference: RateRow[];
};

export type Board = {
  revision: string;
  attendees: Attendee[];
  claims: Claim[];
  games: Game[];
  includeHeatEstimate: boolean;
  you: { id: string; nickname: string } | null;
  cost: CostSnapshot;
};

export type ApiFail = { error: string; board?: Board };
export type ApiOk = { board: Board; claimToken?: string };
