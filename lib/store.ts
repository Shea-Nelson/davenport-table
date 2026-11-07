import crypto from "crypto";
import { closeDriver, databaseKind, getDriver, isUniqueError, type Transaction } from "./driver";
import { findSlot } from "./house";
import { HEAT_CENTS, LODGING_CENTS, referenceRows, shareCents } from "./money";
import { cleanNickname, cleanNote, cleanPlayers, cleanTitle } from "./sanitize";
import type { Attendee, Board, Claim, Game } from "./types";

export const CLAIM_COOKIE = "table_claim";
export { databaseKind };

export type Fail = { ok: false; status: number; error: string };
export type Pass<T> = { ok: true } & T;

export async function closeDb() {
  await closeDriver();
}

async function one<T>(sql: string, params: unknown[] = []) {
  const driver = await getDriver();
  const rows = await driver.query<T>(sql, params);
  return rows[0];
}

async function many<T>(sql: string, params: unknown[] = []) {
  const driver = await getDriver();
  return driver.query<T>(sql, params);
}

async function write(sql: string, params: unknown[] = []) {
  const driver = await getDriver();
  return driver.run(sql, params);
}

function limitFor(kind: "signup" | "mutation") {
  if (kind === "signup") return Number(process.env.RETREAT_SIGNUP_LIMIT || 40);
  return Number(process.env.RETREAT_MUTATION_LIMIT || 240);
}

export async function takeRate(bucket: string, kind: "signup" | "mutation"): Promise<boolean> {
  const limit = limitFor(kind);
  const windowMs = 10 * 60 * 1000;
  const now = Date.now();
  const windowStart = now - (now % windowMs);
  const driver = await getDriver();
  return driver.transaction(async (tx) => {
    const row = await tx.get<{ count: number }>(
      "SELECT count FROM rate_limits WHERE bucket = ? AND window_start = ?",
      [bucket, windowStart],
    );
    const count = Number(row?.count ?? 0);
    if (count >= limit) {
      tx.rollback();
      return false;
    }
    if (row) {
      await tx.run("UPDATE rate_limits SET count = count + 1 WHERE bucket = ? AND window_start = ?", [
        bucket,
        windowStart,
      ]);
    } else {
      await tx.run("INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1)", [bucket, windowStart]);
    }
    await tx.run("DELETE FROM rate_limits WHERE window_start < ?", [now - windowMs * 3]);
    return true;
  });
}

const joinedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatJoined(iso: string) {
  return `${joinedFormatter.format(new Date(iso))} ET`;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sessionFromCookie(cookieValue: string | undefined | null) {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf(".");
  if (dot < 1) return null;
  const id = cookieValue.slice(0, dot);
  const token = cookieValue.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id) || token.length < 20 || token.length > 200) return null;
  const row = await one<{ id: string; nickname: string; token_hash: string }>(
    "SELECT id, nickname, token_hash FROM attendees WHERE id = ?",
    [id],
  );
  if (!row) return null;
  const actual = Buffer.from(hashToken(token));
  const expected = Buffer.from(row.token_hash);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  return { id: row.id, nickname: row.nickname };
}

type AttendeeRow = { id: string; nickname: string; note: string; created_at: string };

function publicAttendee(row: AttendeeRow): Attendee {
  return {
    id: row.id,
    nickname: row.nickname,
    note: row.note,
    createdAt: row.created_at,
    joinedLabel: formatJoined(row.created_at),
  };
}

export async function getBoard(session: { id: string } | null): Promise<Board> {
  const attendeeRows = await many<AttendeeRow>(
    "SELECT id, nickname, note, created_at FROM attendees ORDER BY created_at ASC, nickname ASC",
  );
  const attendees = attendeeRows.map(publicAttendee);
  const claims = (
    await many<Claim>(
      `SELECT c.slot_id AS "slotId", c.attendee_id AS "attendeeId", c.note AS note, a.nickname AS nickname
       FROM claims c JOIN attendees a ON a.id = c.attendee_id
       ORDER BY c.created_at ASC`,
    )
  ).map((row) => ({
    slotId: String(row.slotId),
    attendeeId: String(row.attendeeId),
    nickname: String(row.nickname),
    note: String(row.note ?? ""),
  }));
  const games = (
    await many<Game>(
      `SELECT g.id AS id, g.title AS title, g.attendee_id AS "attendeeId", a.nickname AS "broughtBy",
              g.min_players AS "minPlayers", g.max_players AS "maxPlayers", g.note AS note, g.created_at AS "createdAt"
       FROM games g JOIN attendees a ON a.id = g.attendee_id
       ORDER BY g.created_at ASC, g.title ASC`,
    )
  ).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    attendeeId: String(row.attendeeId),
    broughtBy: String(row.broughtBy),
    minPlayers: row.minPlayers == null ? null : Number(row.minPlayers),
    maxPlayers: row.maxPlayers == null ? null : Number(row.maxPlayers),
    note: String(row.note ?? ""),
    createdAt: String(row.createdAt),
  }));
  const heatRow = await one<{ value: string }>("SELECT value FROM settings WHERE key = 'heat'");
  const includeHeatEstimate = heatRow?.value === "1";
  const people = attendees.length;
  const lodgingShareCents = people > 0 ? shareCents(LODGING_CENTS, people) : null;
  const heatShareCents = people > 0 && includeHeatEstimate ? shareCents(HEAT_CENTS, people) : null;
  const you = session ? attendees.find((person) => person.id === session.id) : undefined;
  const shared = { attendees, claims, games, includeHeatEstimate };
  const revision = crypto.createHash("sha256").update(JSON.stringify(shared)).digest("hex").slice(0, 16);
  return {
    revision,
    ...shared,
    you: you ? { id: you.id, nickname: you.nickname } : null,
    cost: {
      people,
      lodgingTotalCents: LODGING_CENTS,
      heatTotalCents: HEAT_CENTS,
      lodgingShareCents,
      heatShareCents,
      combinedCents: lodgingShareCents == null ? null : lodgingShareCents + (heatShareCents ?? 0),
      reference: referenceRows(),
    },
  };
}

const RATE_LIMIT: Fail = {
  ok: false,
  status: 429,
  error: "Too many saves from this network. Wait a few minutes and try again.",
};

export async function createAttendee(
  input: { nickname: unknown; note: unknown },
  rateKey: string,
): Promise<Pass<{ attendee: Attendee; claimToken: string }> | Fail> {
  if (!(await takeRate(`signup:${rateKey}`, "signup"))) return RATE_LIMIT;
  const nickname = cleanNickname(input.nickname);
  if (!nickname) {
    return {
      ok: false,
      status: 400,
      error: "Use a nickname of 2–24 characters: letters, numbers, spaces, and . ' _ - . No email and no legal name.",
    };
  }
  const note = cleanNote(input.note, 140);
  if (note === null) {
    return { ok: false, status: 400, error: "The note has to be plain text, 140 characters or fewer." };
  }
  const countRow = await one<{ n: number | string }>("SELECT COUNT(*) AS n FROM attendees");
  if (Number(countRow?.n ?? 0) >= 40) {
    return { ok: false, status: 400, error: "The roster is capped at 40 nicknames." };
  }
  const id = crypto.randomUUID();
  const claimToken = crypto.randomBytes(32).toString("base64url");
  const createdAt = new Date().toISOString();
  try {
    await write("INSERT INTO attendees (id, nickname, note, token_hash, created_at) VALUES (?, ?, ?, ?, ?)", [
      id,
      nickname,
      note,
      hashToken(claimToken),
      createdAt,
    ]);
  } catch (error) {
    if (isUniqueError(error)) {
      return {
        ok: false,
        status: 409,
        error: "That nickname is already on the roster. Pick another, or use the browser that created it.",
      };
    }
    throw error;
  }
  return { ok: true, attendee: publicAttendee({ id, nickname, note, created_at: createdAt }), claimToken };
}

export async function updateAttendee(
  attendeeId: string,
  input: { nickname: unknown; note: unknown },
  rateKey: string,
): Promise<Pass<{ attendee: Attendee }> | Fail> {
  if (!(await takeRate(`mut:${rateKey}`, "mutation"))) return RATE_LIMIT;
  const nickname = cleanNickname(input.nickname);
  if (!nickname) {
    return {
      ok: false,
      status: 400,
      error: "Use a nickname of 2–24 characters: letters, numbers, spaces, and . ' _ - .",
    };
  }
  const note = cleanNote(input.note, 140);
  if (note === null) {
    return { ok: false, status: 400, error: "The note has to be plain text, 140 characters or fewer." };
  }
  try {
    const result = await write("UPDATE attendees SET nickname = ?, note = ? WHERE id = ?", [nickname, note, attendeeId]);
    if (result.changes === 0) return { ok: false, status: 404, error: "That nickname is no longer on the roster." };
  } catch (error) {
    if (isUniqueError(error)) {
      return { ok: false, status: 409, error: "Someone else already has that nickname." };
    }
    throw error;
  }
  const row = await one<AttendeeRow>("SELECT id, nickname, note, created_at FROM attendees WHERE id = ?", [attendeeId]);
  if (!row) return { ok: false, status: 404, error: "That nickname is no longer on the roster." };
  return { ok: true, attendee: publicAttendee(row) };
}

export async function deleteAttendee(attendeeId: string, rateKey: string): Promise<{ ok: true } | Fail> {
  if (!(await takeRate(`mut:${rateKey}`, "mutation"))) return RATE_LIMIT;
  const result = await write("DELETE FROM attendees WHERE id = ?", [attendeeId]);
  if (result.changes === 0) return { ok: false, status: 404, error: "That nickname is already gone." };
  return { ok: true };
}

export async function claimSlot(input: {
  attendeeId: string;
  slotId: unknown;
  note: unknown;
  rateKey: string;
}): Promise<{ ok: true } | Fail> {
  if (!(await takeRate(`mut:${input.rateKey}`, "mutation"))) return RATE_LIMIT;
  if (typeof input.slotId !== "string" || !findSlot(input.slotId)) {
    return { ok: false, status: 404, error: "That spot is not on the verified room list." };
  }
  const note = cleanNote(input.note, 80);
  if (note === null) {
    return { ok: false, status: 400, error: "The claim note has to be plain text, 80 characters or fewer." };
  }
  const slotId = input.slotId;
  const driver = await getDriver();
  try {
    return await driver.transaction(async (tx: Transaction) => {
      const existing = await tx.get<{ attendee_id: string }>("SELECT attendee_id FROM claims WHERE slot_id = ?", [slotId]);
      if (existing && existing.attendee_id !== input.attendeeId) {
        tx.rollback();
        return {
          ok: false as const,
          status: 409,
          error: "Someone else already claimed that spot. Refresh if you still see it open.",
        };
      }
      const now = new Date().toISOString();
      if (existing) {
        await tx.run("UPDATE claims SET note = ?, updated_at = ? WHERE slot_id = ?", [note, now, slotId]);
      } else {
        await tx.run(
          "INSERT INTO claims (slot_id, attendee_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          [slotId, input.attendeeId, note, now, now],
        );
      }
      return { ok: true as const };
    });
  } catch (error) {
    if (isUniqueError(error)) {
      return { ok: false, status: 409, error: "Someone else already claimed that spot." };
    }
    throw error;
  }
}

export async function releaseSlot(
  attendeeId: string,
  slotId: unknown,
  rateKey: string,
): Promise<{ ok: true } | Fail> {
  if (!(await takeRate(`mut:${rateKey}`, "mutation"))) return RATE_LIMIT;
  if (typeof slotId !== "string") return { ok: false, status: 400, error: "Missing spot." };
  const result = await write("DELETE FROM claims WHERE slot_id = ? AND attendee_id = ?", [slotId, attendeeId]);
  if (result.changes === 0) {
    return { ok: false, status: 403, error: "That spot is not yours to release." };
  }
  return { ok: true };
}

export async function setHeat(attendeeId: string, include: boolean, rateKey: string): Promise<{ ok: true } | Fail> {
  if (!(await takeRate(`mut:${rateKey}`, "mutation"))) return RATE_LIMIT;
  const row = await one("SELECT id FROM attendees WHERE id = ?", [attendeeId]);
  if (!row) return { ok: false, status: 401, error: "Join the roster before changing the shared estimate." };
  await write("UPDATE settings SET value = ? WHERE key = 'heat'", [include ? "1" : "0"]);
  return { ok: true };
}

export async function createGame(
  attendeeId: string,
  input: { title: unknown; note: unknown; minPlayers: unknown; maxPlayers: unknown },
  rateKey: string,
): Promise<Pass<{ id: string }> | Fail> {
  if (!(await takeRate(`mut:${rateKey}`, "mutation"))) return RATE_LIMIT;
  const title = cleanTitle(input.title);
  if (!title) {
    return { ok: false, status: 400, error: "Give the game a plain-text title, 2–80 characters, with no HTML." };
  }
  const note = cleanNote(input.note, 400);
  if (note === null) {
    return { ok: false, status: 400, error: "The house note has to be plain text, 400 characters or fewer." };
  }
  const players = cleanPlayers(input.minPlayers, input.maxPlayers);
  if (!players) {
    return { ok: false, status: 400, error: "Player counts, if you add them, are whole numbers from 1 to 20, minimum not above maximum." };
  }
  const mine = await one<{ n: number | string }>("SELECT COUNT(*) AS n FROM games WHERE attendee_id = ?", [attendeeId]);
  if (Number(mine?.n ?? 0) >= 12) return { ok: false, status: 400, error: "Twelve games is the cap for one nickname." };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await write(
    "INSERT INTO games (id, title, attendee_id, min_players, max_players, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, title, attendeeId, players.min, players.max, note, now, now],
  );
  return { ok: true, id };
}

export async function updateGame(
  attendeeId: string,
  gameId: string,
  input: { title: unknown; note: unknown; minPlayers: unknown; maxPlayers: unknown },
  rateKey: string,
): Promise<{ ok: true } | Fail> {
  if (!(await takeRate(`mut:${rateKey}`, "mutation"))) return RATE_LIMIT;
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) return { ok: false, status: 404, error: "That game is not on the shelf." };
  const title = cleanTitle(input.title);
  if (!title) return { ok: false, status: 400, error: "Give the game a plain-text title, 2–80 characters." };
  const note = cleanNote(input.note, 400);
  if (note === null) return { ok: false, status: 400, error: "The house note has to be plain text, 400 characters or fewer." };
  const players = cleanPlayers(input.minPlayers, input.maxPlayers);
  if (!players) return { ok: false, status: 400, error: "Player counts must be whole numbers from 1 to 20." };
  const now = new Date().toISOString();
  const result = await write(
    "UPDATE games SET title = ?, note = ?, min_players = ?, max_players = ?, updated_at = ? WHERE id = ? AND attendee_id = ?",
    [title, note, players.min, players.max, now, gameId, attendeeId],
  );
  if (result.changes === 0) return { ok: false, status: 403, error: "Only the person who added that game can edit it." };
  return { ok: true };
}

export async function deleteGame(attendeeId: string, gameId: string, rateKey: string): Promise<{ ok: true } | Fail> {
  if (!(await takeRate(`mut:${rateKey}`, "mutation"))) return RATE_LIMIT;
  const result = await write("DELETE FROM games WHERE id = ? AND attendee_id = ?", [gameId, attendeeId]);
  if (result.changes === 0) return { ok: false, status: 403, error: "Only the person who added that game can remove it." };
  return { ok: true };
}

export async function resetBoard() {
  const driver = await getDriver();
  await driver.transaction(async (tx) => {
    await tx.run("DELETE FROM claims");
    await tx.run("DELETE FROM games");
    await tx.run("DELETE FROM attendees");
    await tx.run("UPDATE settings SET value = '0' WHERE key = 'heat'");
    await tx.run("DELETE FROM rate_limits");
  });
}

export async function rateSalt() {
  const row = await one<{ value: string }>("SELECT value FROM meta WHERE key = 'salt'");
  if (!row) throw new Error("Server salt is missing.");
  return row.value;
}
