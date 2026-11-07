import { DurableObject } from "cloudflare:workers";
import { findSlot } from "../../lib/house";
import { HEAT_CENTS, LODGING_CENTS, referenceRows, shareCents } from "../../lib/money";
import { cleanNickname, cleanNote, cleanPlayers, cleanTitle } from "../../lib/sanitize";
import { normalizeStayMoment, stayOrderError } from "../../lib/stay";
import type { Attendee, Board, Claim, Game } from "../../lib/types";
import type { Env } from "./index";
import ownedCatalog from "../../collections/owned.json";

const CLAIM_COOKIE = "table_claim";

type OwnedGame = {
  bggId: number;
  title: string;
  url: string;
  isExpansion: boolean;
  owners: string[];
};

const ownedGames = (ownedCatalog as { games: OwnedGame[] }).games;
const ownedById = new Map(ownedGames.map((game) => [game.bggId, game]));
const RATE_LIMIT = {
  ok: false as const,
  status: 429,
  error: "Too many saves from this network. Wait a few minutes and try again.",
};

type Sql = SqlStorage;
type Row = Record<string, SqlStorageValue>;

function all(sql: Sql, query: string, ...params: unknown[]): Row[] {
  return sql.exec(query, ...params).toArray() as Row[];
}

function first(sql: Sql, query: string, ...params: unknown[]): Row | undefined {
  return all(sql, query, ...params)[0];
}

function written(sql: Sql, query: string, ...params: unknown[]): number {
  return Number(sql.exec(query, ...params).rowsWritten || 0);
}

function bytesToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return undefined;
}

function presentedCredential(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return cookieValue(request, CLAIM_COOKIE) || null;
}

function crossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

function secureRequest(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return new URL(request.url).protocol === "https:";
}

function claimCookie(id: string, token: string, request: Request, clear = false): string {
  const value = clear ? "" : `${id}.${token}`;
  const maxAge = clear ? "0" : String(60 * 60 * 24 * 60);
  const origin = request.headers.get("origin") || "";
  const httpsPage = origin ? origin.startsWith("https:") : secureRequest(request);
  const parts = [`${CLAIM_COOKIE}=${value}`, "HttpOnly", "Path=/", `Max-Age=${maxAge}`];
  // SameSite=None requires Secure. An http dev proxy keeps Lax so the browser can store it.
  if (crossSite(request) && httpsPage) {
    parts.push("Secure", "SameSite=None", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
    if (httpsPage) parts.push("Secure");
  }
  return parts.join("; ");
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

function publicAttendee(row: Row): Attendee {
  const createdAt = String(row.created_at);
    return {
    id: String(row.id),
    nickname: String(row.nickname),
    note: String(row.note ?? ""),
    createdAt,
    joinedLabel: formatJoined(createdAt),
    arrivalAt: row.arrival_at ? String(row.arrival_at) : null,
    departureAt: row.departure_at ? String(row.departure_at) : null,
  };
}

function json(body: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  if (cookie) headers.append("set-cookie", cookie);
  if (status === 429) headers.set("retry-after", "120");
  return new Response(JSON.stringify(body), { status, headers });
}

function isUnique(error: unknown): boolean {
  return error instanceof Error && /unique/i.test(error.message);
}

export class BoardDurableObject extends DurableObject<Env> {
  private readonly sql: Sql;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS attendees (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
        note TEXT NOT NULL DEFAULT '',
        token_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS claims (
        slot_id TEXT PRIMARY KEY,
        attendee_id TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        attendee_id TEXT NOT NULL,
        min_players INTEGER,
        max_players INTEGER,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rate_limits (
        bucket TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (bucket, window_start)
      );
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS game_requests (
        id TEXT PRIMARY KEY,
        attendee_id TEXT NOT NULL,
        bgg_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (attendee_id, bgg_id)
      );
      CREATE TABLE IF NOT EXISTS game_request_decisions (
        request_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        attendee_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        shelf_game_id TEXT,
        decided_at TEXT NOT NULL,
        PRIMARY KEY (request_id, owner_name)
      );
    `);
    if (!first(this.sql, "SELECT value FROM meta WHERE key = 'salt'")) {
      this.sql.exec("INSERT INTO meta (key, value) VALUES ('salt', ?)", crypto.randomUUID() + crypto.randomUUID());
    }
    if (!first(this.sql, "SELECT value FROM settings WHERE key = 'heat'")) {
      this.sql.exec("INSERT INTO settings (key, value) VALUES ('heat', '0')");
    }
    const columns = all(this.sql, "PRAGMA table_info(attendees)").map((row) => String(row.name));
    if (!columns.includes("arrival_at")) this.sql.exec("ALTER TABLE attendees ADD COLUMN arrival_at TEXT");
    if (!columns.includes("departure_at")) this.sql.exec("ALTER TABLE attendees ADD COLUMN departure_at TEXT");
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.replace(/^\/api\//, "");
    const method = request.method.toUpperCase();
    if (method === "GET" && key === "health") {
      const board = await this.board(null);
      return json({
        ok: true,
        attendees: board.attendees.length,
        revision: board.revision,
        database: "durable-object-sqlite",
        notion: "mirror-not-configured",
      });
    }
    if (method === "GET" && key === "board") {
      const header = request.headers.get("authorization") || "";
      const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
      const cookie = cookieValue(request, CLAIM_COOKIE) || "";
      let session = bearer ? await this.sessionFrom(bearer) : null;
      if (!session && cookie) session = await this.sessionFrom(cookie);
      const stale = Boolean((bearer || cookie) && !session);
      const response = json(await this.board(session), 200, stale && cookie ? claimCookie("", "", request, true) : undefined);
      if (stale) response.headers.set("x-retreat-credential", "stale");
      return response;
    }
    if (method === "GET" && key === "owned") return json(ownedCatalog);
    if (method === "GET" && key === "requests") return json({ requests: this.listRequests() });
    if (method === "GET") return json({ error: "Not found." }, 404);

    if (method === "POST" && key === "admin/reset") {
      const expected = this.env.ADMIN_TOKEN || "";
      if (expected.length < 16) return json({ error: "Not found." }, 404);
      const header = request.headers.get("authorization") || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!safeEqual(token, expected)) return json({ error: "Not found." }, 404);
      this.reset();
      return json({ ok: true });
    }

    const payload = await readPayload(request, method);
    if ("error" in payload) return json({ error: payload.error }, 400);
    const data = payload.data;
    const rateKey = await this.rateKey(request);
    const credential = presentedCredential(request);
    const session = await this.sessionFrom(credential);

    if (method === "POST" && key === "attendees") {
      if (session) {
        return json({ error: "This browser is already on the roster. Leave that peep before adding another." }, 409);
      }
      const result = await this.createAttendee({ nickname: data.nickname, note: data.note }, rateKey);
      if (!result.ok) return json({ error: result.error }, result.status);
      const board = await this.board({ id: result.attendee.id });
      return json(
        { board, claimToken: result.claimToken },
        200,
        claimCookie(result.attendee.id, result.claimToken, request),
      );
    }

    if (!session) {
      return json(
        {
          error: credential
            ? "That private edit code does not match a peep on the roster."
            : "Join the roster on this browser first. A peep name is not a password, but this browser has not joined yet.",
        },
        401,
      );
    }

    if ((method === "PATCH" || method === "POST" || method === "DELETE") && key === "attendees/me") {
      if (method === "DELETE" || data.intent === "leave") {
        const result = this.deleteAttendee(session.id, rateKey);
        if (!result.ok) return json({ error: result.error }, result.status);
        return json({ board: await this.board(null) }, 200, claimCookie(session.id, "", request, true));
      }
      const result = this.updateAttendee(session.id, {
        nickname: data.nickname,
        note: data.note,
        arrival: data.arrival,
        departure: data.departure,
        hasArrival: Object.prototype.hasOwnProperty.call(data, "arrival"),
        hasDeparture: Object.prototype.hasOwnProperty.call(data, "departure"),
      }, rateKey);
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ board: await this.board(session) });
    }

    if (key === "claims" && (method === "POST" || method === "DELETE")) {
      const slotId = method === "DELETE" ? url.searchParams.get("slotId") : data.slotId;
      const releasing = method === "DELETE" || data.intent === "release";
      const result = releasing
        ? this.releaseSlot(session.id, slotId, rateKey)
        : this.claimSlot({ attendeeId: session.id, slotId, note: data.note, rateKey });
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ board: await this.board(session) });
    }

    if (method === "POST" && key === "games") {
      const result = this.createGame(
        session.id,
        { title: data.title, note: data.note, minPlayers: data.minPlayers, maxPlayers: data.maxPlayers },
        rateKey,
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ board: await this.board(session) });
    }

    const gameMatch = key.match(/^games\/([0-9a-f-]{36})$/i);
    if (gameMatch && (method === "PATCH" || method === "DELETE")) {
      const gameId = gameMatch[1];
      const result =
        method === "DELETE"
          ? this.deleteGame(session.id, gameId, rateKey)
          : this.updateGame(
              session.id,
              gameId,
              {
              title: data.title,
              note: data.note,
              minPlayers: data.minPlayers,
              maxPlayers: data.maxPlayers,
              setPlayers: Object.prototype.hasOwnProperty.call(data, "minPlayers") || Object.prototype.hasOwnProperty.call(data, "maxPlayers"),
            },
              rateKey,
            );
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ board: await this.board(session) });
    }

    if (method === "POST" && key === "requests") {
      const result = this.createRequest(session.id, data.bggId, rateKey);
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ ok: true, created: result.created, request: result.request });
    }

    const decisionMatch = key.match(/^requests\/([0-9a-f-]{36})\/decision$/i);
    if (decisionMatch && method === "POST") {
      const result = this.decideRequest(session, decisionMatch[1], data.decision, rateKey);
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({
        ok: true,
        created: result.created,
        decision: result.decision,
        request: result.request,
        board: await this.board(session),
      });
    }

    const requestById = key.match(/^requests\/([0-9a-f-]{36})$/i);
    if (requestById && method === "DELETE") {
      const result = this.withdrawRequest(session.id, requestById[1], rateKey);
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ ok: true, removed: result.removed });
    }

    const requestByGame = key.match(/^requests\/(\d+)$/);
    if (requestByGame && method === "DELETE") {
      const result = this.withdrawRequestByGame(session.id, Number(requestByGame[1]), rateKey);
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ ok: true, removed: result.removed });
    }

    if (method === "POST" && key === "settings") {
      const include = asBool(data.includeHeatEstimate);
      if (include === null) return json({ error: "Say whether the heat estimate should be included." }, 400);
      const result = this.setHeat(session.id, include, rateKey);
      if (!result.ok) return json({ error: result.error }, result.status);
      return json({ board: await this.board(session) });
    }

    return json({ error: "Not found." }, 404);
  }

  private limit(kind: "signup" | "mutation" | "house"): number {
    const raw =
      kind === "signup" ? this.env.RETREAT_SIGNUP_LIMIT : kind === "house" ? this.env.RETREAT_HOUSE_LIMIT : this.env.RETREAT_MUTATION_LIMIT;
    const fallback = kind === "signup" ? 40 : kind === "house" ? 240 : 40;
    const parsed = Number(raw || fallback);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  /** Each nickname has its own save budget. The house ceiling is only a backstop for one shared address. */
  private allowMutation(attendeeId: string, rateKey: string): boolean {
    return this.takeRate(`house:${rateKey}`, "house") && this.takeRate(`who:${attendeeId}`, "mutation");
  }

  private takeRate(bucket: string, kind: "signup" | "mutation" | "house"): boolean {
    const limit = this.limit(kind);
    const windowMs = 10 * 60 * 1000;
    const now = Date.now();
    const windowStart = now - (now % windowMs);
    return this.ctx.storage.transactionSync(() => {
      const row = first(this.sql, "SELECT count FROM rate_limits WHERE bucket = ? AND window_start = ?", bucket, windowStart);
      const count = Number(row?.count ?? 0);
      if (count >= limit) return false;
      if (row) {
        this.sql.exec("UPDATE rate_limits SET count = count + 1 WHERE bucket = ? AND window_start = ?", bucket, windowStart);
      } else {
        this.sql.exec("INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1)", bucket, windowStart);
      }
      this.sql.exec("DELETE FROM rate_limits WHERE window_start < ?", now - windowMs * 3);
      return true;
    });
  }

  private async rateKey(request: Request): Promise<string> {
    const salt = String(first(this.sql, "SELECT value FROM meta WHERE key = 'salt'")?.value || "");
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    return (await sha256(`${salt}|${ip}`)).slice(0, 32);
  }

  private async sessionFrom(credential: string | null): Promise<{ id: string; nickname: string } | null> {
    if (!credential) return null;
    const dot = credential.indexOf(".");
    if (dot < 1) return null;
    const id = credential.slice(0, dot);
    const token = credential.slice(dot + 1);
    if (!/^[0-9a-f-]{36}$/i.test(id) || token.length < 20 || token.length > 200) return null;
    const row = first(this.sql, "SELECT id, nickname, token_hash FROM attendees WHERE id = ?", id);
    if (!row) return null;
    const actual = await sha256(token);
    if (!safeEqual(actual, String(row.token_hash))) return null;
    return { id: String(row.id), nickname: String(row.nickname) };
  }

  private async board(session: { id: string } | null): Promise<Board> {
    const attendees = all(
      this.sql,
      "SELECT id, nickname, note, created_at, arrival_at, departure_at FROM attendees ORDER BY created_at ASC, nickname ASC",
    ).map(publicAttendee);
    const claims = all(
      this.sql,
      `SELECT c.slot_id AS slotId, c.attendee_id AS attendeeId, c.note AS note, a.nickname AS nickname
       FROM claims c JOIN attendees a ON a.id = c.attendee_id
       ORDER BY c.created_at ASC`,
    ).map(
      (row): Claim => ({
        slotId: String(row.slotId),
        attendeeId: String(row.attendeeId),
        nickname: String(row.nickname),
        note: String(row.note ?? ""),
      }),
    );
    const games = all(
      this.sql,
      `SELECT g.id AS id, g.title AS title, g.attendee_id AS attendeeId, a.nickname AS broughtBy,
              g.min_players AS minPlayers, g.max_players AS maxPlayers, g.note AS note, g.created_at AS createdAt
       FROM games g JOIN attendees a ON a.id = g.attendee_id
       ORDER BY g.created_at ASC, g.title ASC`,
    ).map(
      (row): Game => ({
        id: String(row.id),
        title: String(row.title),
        attendeeId: String(row.attendeeId),
        broughtBy: String(row.broughtBy),
        minPlayers: row.minPlayers == null ? null : Number(row.minPlayers),
        maxPlayers: row.maxPlayers == null ? null : Number(row.maxPlayers),
        note: String(row.note ?? ""),
        createdAt: String(row.createdAt),
      }),
    );
    const includeHeatEstimate = String(first(this.sql, "SELECT value FROM settings WHERE key = 'heat'")?.value) === "1";
    const people = attendees.length;
    const lodgingShareCents = people > 0 ? shareCents(LODGING_CENTS, people) : null;
    const heatShareCents = people > 0 && includeHeatEstimate ? shareCents(HEAT_CENTS, people) : null;
    const you = session ? attendees.find((person) => person.id === session.id) : undefined;
    const shared = { attendees, claims, games, includeHeatEstimate };
    const revision = (await sha256(JSON.stringify(shared))).slice(0, 16);
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

  private async createAttendee(input: { nickname: unknown; note: unknown }, rateKey: string) {
    if (!this.takeRate(`signup:${rateKey}`, "signup")) return RATE_LIMIT;
    const nickname = cleanNickname(input.nickname);
    if (!nickname) {
      return {
        ok: false as const,
        status: 400,
        error: "Use a peep name of 2–24 characters: letters, numbers, spaces, and . ' _ - . No email and no legal name.",
      };
    }
    const note = cleanNote(input.note, 140);
    if (note === null) return { ok: false as const, status: 400, error: "The note has to be plain text, 140 characters or fewer." };
    const count = Number(first(this.sql, "SELECT COUNT(*) AS n FROM attendees")?.n ?? 0);
    if (count >= 40) return { ok: false as const, status: 400, error: "The roster is capped at 40 peeps." };
    const id = crypto.randomUUID();
    const claimToken = randomToken();
    const createdAt = new Date().toISOString();
    const tokenHash = await sha256(claimToken);
    try {
      this.sql.exec("INSERT INTO attendees (id, nickname, note, token_hash, created_at) VALUES (?, ?, ?, ?, ?)", id, nickname, note, tokenHash, createdAt);
    } catch (error) {
      if (isUnique(error)) {
        return {
          ok: false as const,
          status: 409,
          error: "That peep name is already on the roster. Pick another, or use the browser that created it.",
        };
      }
      throw error;
    }
    return { ok: true as const, attendee: publicAttendee({ id, nickname, note, created_at: createdAt }), claimToken };
  }

  private updateAttendee(
    attendeeId: string,
    input: {
      nickname: unknown;
      note: unknown;
      arrival: unknown;
      departure: unknown;
      hasArrival: boolean;
      hasDeparture: boolean;
    },
    rateKey: string,
  ) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    const nickname = cleanNickname(input.nickname);
    if (!nickname) {
      return { ok: false as const, status: 400, error: "Use a peep name of 2–24 characters: letters, numbers, spaces, and . ' _ - ." };
    }
    const note = cleanNote(input.note, 140);
    if (note === null) return { ok: false as const, status: 400, error: "The note has to be plain text, 140 characters or fewer." };
    const current = first(this.sql, "SELECT arrival_at, departure_at FROM attendees WHERE id = ?", attendeeId);
    if (!current) return { ok: false as const, status: 404, error: "That peep is no longer on the roster." };
    let arrivalAt = current.arrival_at ? String(current.arrival_at) : null;
    let departureAt = current.departure_at ? String(current.departure_at) : null;
    if (input.hasArrival) {
      const parsed = normalizeStayMoment(input.arrival);
      if (parsed === undefined) {
        return { ok: false as const, status: 400, error: "Arrival has to be between Thu Jan 14, 4:00 p.m. and Mon Jan 18, 10:00 a.m. Eastern, or left blank." };
      }
      arrivalAt = parsed;
    }
    if (input.hasDeparture) {
      const parsed = normalizeStayMoment(input.departure);
      if (parsed === undefined) {
        return { ok: false as const, status: 400, error: "Departure has to be between Thu Jan 14, 4:00 p.m. and Mon Jan 18, 10:00 a.m. Eastern, or left blank." };
      }
      departureAt = parsed;
    }
    const order = stayOrderError(arrivalAt, departureAt);
    if (order) return { ok: false as const, status: 400, error: order };
    try {
      const changes = written(
        this.sql,
        "UPDATE attendees SET nickname = ?, note = ?, arrival_at = ?, departure_at = ? WHERE id = ?",
        nickname,
        note,
        arrivalAt,
        departureAt,
        attendeeId,
      );
      if (changes === 0) return { ok: false as const, status: 404, error: "That peep is no longer on the roster." };
    } catch (error) {
      if (isUnique(error)) return { ok: false as const, status: 409, error: "Someone else already has that peep name." };
      throw error;
    }
    return { ok: true as const };
  }

  private deleteAttendee(attendeeId: string, rateKey: string) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    const removed = this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM claims WHERE attendee_id = ?", attendeeId);
      this.sql.exec("DELETE FROM games WHERE attendee_id = ?", attendeeId);
      this.sql.exec("DELETE FROM game_request_decisions WHERE attendee_id = ?", attendeeId);
      this.sql.exec(
        "DELETE FROM game_request_decisions WHERE request_id IN (SELECT id FROM game_requests WHERE attendee_id = ?)",
        attendeeId,
      );
      this.sql.exec("DELETE FROM game_requests WHERE attendee_id = ?", attendeeId);
      return written(this.sql, "DELETE FROM attendees WHERE id = ?", attendeeId);
    });
    if (removed === 0) return { ok: false as const, status: 404, error: "That peep is already gone." };
    return { ok: true as const };
  }

  private claimSlot(input: { attendeeId: string; slotId: unknown; note: unknown; rateKey: string }) {
    if (!this.allowMutation(input.attendeeId, input.rateKey)) return RATE_LIMIT;
    if (typeof input.slotId !== "string" || !findSlot(input.slotId)) {
      return { ok: false as const, status: 404, error: "That spot is not on the verified room list." };
    }
    const note = cleanNote(input.note, 80);
    if (note === null) return { ok: false as const, status: 400, error: "The claim note has to be plain text, 80 characters or fewer." };
    const slotId = input.slotId;
    try {
      return this.ctx.storage.transactionSync(() => {
        const existing = first(this.sql, "SELECT attendee_id FROM claims WHERE slot_id = ?", slotId);
        if (existing && String(existing.attendee_id) !== input.attendeeId) {
          return {
            ok: false as const,
            status: 409,
            error: "Someone else already claimed that spot. Refresh if you still see it open.",
          };
        }
        const now = new Date().toISOString();
        if (existing) {
          this.sql.exec("UPDATE claims SET note = ?, updated_at = ? WHERE slot_id = ?", note, now, slotId);
        } else {
          this.sql.exec(
            "INSERT INTO claims (slot_id, attendee_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            slotId,
            input.attendeeId,
            note,
            now,
            now,
          );
        }
        return { ok: true as const };
      });
    } catch (error) {
      if (isUnique(error)) return { ok: false as const, status: 409, error: "Someone else already claimed that spot." };
      throw error;
    }
  }

  private releaseSlot(attendeeId: string, slotId: unknown, rateKey: string) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    if (typeof slotId !== "string") return { ok: false as const, status: 400, error: "Missing spot." };
    const changes = written(this.sql, "DELETE FROM claims WHERE slot_id = ? AND attendee_id = ?", slotId, attendeeId);
    if (changes === 0) return { ok: false as const, status: 403, error: "That spot is not yours to release." };
    return { ok: true as const };
  }

  private setHeat(attendeeId: string, include: boolean, rateKey: string) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    if (!first(this.sql, "SELECT id FROM attendees WHERE id = ?", attendeeId)) {
      return { ok: false as const, status: 401, error: "Join the roster before changing the shared estimate." };
    }
    this.sql.exec("UPDATE settings SET value = ? WHERE key = 'heat'", include ? "1" : "0");
    return { ok: true as const };
  }

  private createGame(
    attendeeId: string,
    input: { title: unknown; note: unknown; minPlayers: unknown; maxPlayers: unknown },
    rateKey: string,
  ) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    const title = cleanTitle(input.title);
    if (!title) return { ok: false as const, status: 400, error: "Give the game a plain-text title, 2–80 characters, with no HTML." };
    const note = cleanNote(input.note, 400);
    if (note === null) return { ok: false as const, status: 400, error: "The house note has to be plain text, 400 characters or fewer." };
    const players = cleanPlayers(input.minPlayers, input.maxPlayers);
    if (!players) {
      return {
        ok: false as const,
        status: 400,
        error: "Player counts, if you add them, are whole numbers from 1 to 20, minimum not above maximum.",
      };
    }
    const mine = Number(first(this.sql, "SELECT COUNT(*) AS n FROM games WHERE attendee_id = ?", attendeeId)?.n ?? 0);
    if (mine >= 12) return { ok: false as const, status: 400, error: "Twelve games is the cap for one peep." };
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.sql.exec(
      "INSERT INTO games (id, title, attendee_id, min_players, max_players, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      title,
      attendeeId,
      players.min,
      players.max,
      note,
      now,
      now,
    );
    return { ok: true as const, id };
  }

  private updateGame(
    attendeeId: string,
    gameId: string,
    input: { title: unknown; note: unknown; minPlayers: unknown; maxPlayers: unknown; setPlayers: boolean },
    rateKey: string,
  ) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    const title = cleanTitle(input.title);
    if (!title) return { ok: false as const, status: 400, error: "Give the game a plain-text title, 2–80 characters." };
    const note = cleanNote(input.note, 400);
    if (note === null) return { ok: false as const, status: 400, error: "The house note has to be plain text, 400 characters or fewer." };
    const players = input.setPlayers ? cleanPlayers(input.minPlayers, input.maxPlayers) : { min: null, max: null };
    if (!players) return { ok: false as const, status: 400, error: "Player counts must be whole numbers from 1 to 20." };
    const changes = input.setPlayers
      ? written(
          this.sql,
          "UPDATE games SET title = ?, note = ?, min_players = ?, max_players = ?, updated_at = ? WHERE id = ? AND attendee_id = ?",
          title,
          note,
          players.min,
          players.max,
          new Date().toISOString(),
          gameId,
          attendeeId,
        )
      : written(
          this.sql,
          "UPDATE games SET title = ?, note = ?, updated_at = ? WHERE id = ? AND attendee_id = ?",
          title,
          note,
          new Date().toISOString(),
          gameId,
          attendeeId,
        );
    if (changes === 0) return { ok: false as const, status: 403, error: "Only the person who added that game can edit it." };
    return { ok: true as const };
  }

  private deleteGame(attendeeId: string, gameId: string, rateKey: string) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    const changes = written(this.sql, "DELETE FROM games WHERE id = ? AND attendee_id = ?", gameId, attendeeId);
    if (changes === 0) return { ok: false as const, status: 403, error: "Only the person who added that game can remove it." };
    return { ok: true as const };
  }

  private listRequests() {
    const decisions = all(
      this.sql,
      `SELECT request_id AS requestId, owner_name AS owner, attendee_id AS attendeeId,
              decision, shelf_game_id AS shelfGameId, decided_at AS decidedAt
       FROM game_request_decisions
       ORDER BY decided_at ASC`,
    );
    const byRequest = new Map<string, ReturnType<BoardDurableObject["decisionView"]>[]>();
    for (const row of decisions) {
      const requestId = String(row.requestId);
      const list = byRequest.get(requestId) ?? [];
      list.push(this.decisionView(row));
      byRequest.set(requestId, list);
    }
    return all(
      this.sql,
      `SELECT r.id AS id, r.bgg_id AS bggId, r.title AS title, r.attendee_id AS requesterId,
              a.nickname AS requesterName, r.created_at AS createdAt
       FROM game_requests r JOIN attendees a ON a.id = r.attendee_id
       ORDER BY r.created_at ASC, r.title ASC`,
    ).map((row) => this.requestView(row, byRequest.get(String(row.id)) ?? []));
  }

  private decisionView(row: Row) {
    return {
      owner: String(row.owner),
      attendeeId: String(row.attendeeId),
      decision: String(row.decision),
      shelfGameId: row.shelfGameId ? String(row.shelfGameId) : null,
      decidedAt: String(row.decidedAt),
    };
  }

  private requestView(row: Row, decisions: ReturnType<BoardDurableObject["decisionView"]>[]) {
    const bggId = Number(row.bggId ?? row.bgg_id);
    const requesterId = String(row.requesterId ?? row.attendee_id);
    const owned = ownedById.get(bggId);
    return {
      id: String(row.id),
      bggId,
      title: String(row.title),
      requesterId,
      requesterName: row.requesterName ? String(row.requesterName) : "",
      createdAt: String(row.createdAt ?? row.created_at),
      owners: owned ? owned.owners.slice() : [],
      decisions,
    };
  }

  private createRequest(attendeeId: string, bggId: unknown, rateKey: string) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    if (typeof bggId !== "number" || !Number.isInteger(bggId) || bggId < 1) {
      return { ok: false as const, status: 400, error: "Use the BoardGameGeek id from the owned list." };
    }
    const game = ownedById.get(bggId);
    if (!game) return { ok: false as const, status: 400, error: "That game is not in the owned-collection snapshot." };
    const existing = first(this.sql, "SELECT id, bgg_id, title, attendee_id, created_at FROM game_requests WHERE attendee_id = ? AND bgg_id = ?", attendeeId, bggId);
    if (existing) return { ok: true as const, created: false, request: this.requestFromRow(existing) };
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    try {
      this.sql.exec(
        "INSERT INTO game_requests (id, attendee_id, bgg_id, title, created_at) VALUES (?, ?, ?, ?, ?)",
        id,
        attendeeId,
        bggId,
        game.title,
        createdAt,
      );
    } catch (error) {
      if (!isUnique(error)) throw error;
      const raced = first(this.sql, "SELECT id, bgg_id, title, attendee_id, created_at FROM game_requests WHERE attendee_id = ? AND bgg_id = ?", attendeeId, bggId);
      if (!raced) throw error;
      return { ok: true as const, created: false, request: this.requestFromRow(raced) };
    }
    return { ok: true as const, created: true, request: this.requestFromRow({ id, bgg_id: bggId, title: game.title, attendee_id: attendeeId, created_at: createdAt }) };
  }

  private requestFromRow(row: Row) {
    const id = String(row.id);
    const decisions = all(
      this.sql,
      `SELECT owner_name AS owner, attendee_id AS attendeeId, decision, shelf_game_id AS shelfGameId, decided_at AS decidedAt
       FROM game_request_decisions WHERE request_id = ? ORDER BY decided_at ASC`,
      id,
    ).map((item) => this.decisionView(item));
    const requesterId = String(row.attendee_id);
    const person = first(this.sql, "SELECT nickname FROM attendees WHERE id = ?", requesterId);
    return this.requestView({ ...row, bggId: row.bgg_id, requesterId, requesterName: person?.nickname ?? "", createdAt: row.created_at }, decisions);
  }

  private withdrawRequest(attendeeId: string, requestId: string, rateKey: string) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    const row = first(this.sql, "SELECT attendee_id FROM game_requests WHERE id = ?", requestId);
    if (!row) return { ok: true as const, removed: false };
    if (String(row.attendee_id) !== attendeeId) {
      return { ok: false as const, status: 403, error: "Only the peep who asked for that game can withdraw it." };
    }
    this.sql.exec("DELETE FROM game_request_decisions WHERE request_id = ?", requestId);
    const changes = written(this.sql, "DELETE FROM game_requests WHERE id = ? AND attendee_id = ?", requestId, attendeeId);
    return { ok: true as const, removed: changes > 0 };
  }

  private withdrawRequestByGame(attendeeId: string, bggId: number, rateKey: string) {
    if (!this.allowMutation(attendeeId, rateKey)) return RATE_LIMIT;
    const rows = all(this.sql, "SELECT id FROM game_requests WHERE attendee_id = ? AND bgg_id = ?", attendeeId, bggId);
    for (const row of rows) this.sql.exec("DELETE FROM game_request_decisions WHERE request_id = ?", String(row.id));
    const changes = written(this.sql, "DELETE FROM game_requests WHERE attendee_id = ? AND bgg_id = ?", attendeeId, bggId);
    return { ok: true as const, removed: changes > 0 };
  }

  private decideRequest(session: { id: string; nickname: string }, requestId: string, decision: unknown, rateKey: string) {
    if (!this.allowMutation(session.id, rateKey)) return RATE_LIMIT;
    if (decision !== "bring" && decision !== "decline") {
      return { ok: false as const, status: 400, error: "Choose bring or decline." };
    }
    const request = first(this.sql, "SELECT id, bgg_id, title, attendee_id, created_at FROM game_requests WHERE id = ?", requestId);
    if (!request) return { ok: false as const, status: 404, error: "That request is no longer on the list." };
    const owned = ownedById.get(Number(request.bgg_id));
    const ownerName = owned?.owners.find((owner) => owner.toLowerCase() === session.nickname.trim().toLowerCase());
    if (!ownerName) {
      return { ok: false as const, status: 403, error: "Only a peep who owns that game can decide. Shea and Grease match the collection names." };
    }
    const prior = first(
      this.sql,
      `SELECT owner_name AS owner, attendee_id AS attendeeId, decision, shelf_game_id AS shelfGameId, decided_at AS decidedAt
       FROM game_request_decisions WHERE request_id = ? AND owner_name = ?`,
      requestId,
      ownerName,
    );
    if (prior) {
      if (String(prior.decision) !== decision) {
        return { ok: false as const, status: 409, error: "That owner already decided. The earlier choice stays." };
      }
      return { ok: true as const, created: false, decision: this.decisionView(prior), request: this.requestFromRow(request) };
    }
    let shelfGameId: string | null = null;
    if (decision === "bring") {
      const shelfTitle = shelfTitleFor(String(request.title));
      if (!shelfTitle) return { ok: false as const, status: 400, error: "That title cannot be added to the shelf." };
      const already = all(this.sql, "SELECT id, title, note FROM games WHERE attendee_id = ?", session.id).find((row) =>
        titlesMatch(String(row.title), String(request.title)),
      );
      if (already) {
        shelfGameId = String(already.id);
      } else {
        shelfGameId = crypto.randomUUID();
        const now = new Date().toISOString();
        this.sql.exec(
          "INSERT INTO games (id, title, attendee_id, min_players, max_players, note, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, '', ?, ?)",
          shelfGameId,
          shelfTitle,
          session.id,
          now,
          now,
        );
      }
    }
    const decidedAt = new Date().toISOString();
    this.sql.exec(
      `INSERT INTO game_request_decisions (request_id, owner_name, attendee_id, decision, shelf_game_id, decided_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      requestId,
      ownerName,
      session.id,
      decision,
      shelfGameId,
      decidedAt,
    );
    return {
      ok: true as const,
      created: true,
      decision: { owner: ownerName, attendeeId: session.id, decision, shelfGameId, decidedAt },
      request: this.requestFromRow(request),
    };
  }

  private reset() {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM claims");
      this.sql.exec("DELETE FROM games");
      this.sql.exec("DELETE FROM game_request_decisions");
      this.sql.exec("DELETE FROM game_requests");
      this.sql.exec("DELETE FROM attendees");
      this.sql.exec("UPDATE settings SET value = '0' WHERE key = 'heat'");
      this.sql.exec("DELETE FROM rate_limits");
    });
  }
}

function titlesMatch(left: string, right: string): boolean {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const strip = (value: string) => norm(value).replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return norm(left) === norm(right) || strip(left) === strip(right);
}

function shelfTitleFor(title: string): string | null {
  const direct = cleanTitle(title);
  if (direct) return direct;
  return cleanTitle(title.replace(/\s*\([^)]*\)\s*/g, " "));
}

function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "1" || value === "true" || value === "on") return true;
  if (value === "0" || value === "false" || value === "off") return false;
  return null;
}

async function readPayload(
  request: Request,
  method: string,
): Promise<{ data: Record<string, unknown> } | { error: string }> {
  if (method === "DELETE" || method === "GET") return { data: {} };
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { error: "Send a JSON object." };
  }
  const text = await request.text();
  if (text.length > 20_000) return { error: "That request is too large." };
  try {
    const data = JSON.parse(text || "{}") as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "Send a JSON object." };
    return { data: data as Record<string, unknown> };
  } catch {
    return { error: "That JSON could not be read." };
  }
}
