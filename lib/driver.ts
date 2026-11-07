import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient } from "pg";

export type Querier = {
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
};

export type Transaction = Querier & { rollback: () => void };

type Driver = {
  kind: "sqlite" | "postgres";
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

const globalDriver = globalThis as unknown as { __retreatDriver?: Driver };

/** Apps docs say a needed database is provisioned Postgres. The variable name is not specified there; DATABASE_URL is the name Cursor's secrets docs use. */
export function databaseKind(): "sqlite" | "postgres" {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return "sqlite";
  if (/^postgres(?:ql)?:\/\//i.test(url)) return "postgres";
  throw new Error("DATABASE_URL is set but is not a postgres connection string. Unset it to use the local SQLite file.");
}

function placeholders(sql: string, postgres: boolean) {
  if (!postgres) return sql;
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

const SQLITE_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
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
  updated_at TEXT NOT NULL,
  FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  min_players INTEGER,
  max_players INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
`;

const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attendees (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS attendees_nickname_ci ON attendees (lower(nickname));
CREATE TABLE IF NOT EXISTS claims (
  slot_id TEXT PRIMARY KEY,
  attendee_id TEXT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  attendee_id TEXT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  min_players INTEGER,
  max_players INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);
`;

function sqliteFile() {
  return process.env.RETREAT_DB_PATH || path.join(process.cwd(), "data", "retreat.sqlite");
}

function openSqlite(): Driver {
  const file = sqliteFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SQLITE_SCHEMA);
  let tail: Promise<void> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T> | T): Promise<T> => {
    const run = tail.then(() => fn());
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
  const querier = (): Querier => ({
    async get<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async run(sql: string, params: unknown[] = []) {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },
  });
  return {
    kind: "sqlite",
    query(sql, params = []) {
      return exclusive(() => querier().all(sql, params));
    },
    run(sql, params = []) {
      return exclusive(() => querier().run(sql, params));
    },
    transaction(fn) {
      return exclusive(async () => {
        db.exec("BEGIN IMMEDIATE");
        let rolled = false;
        try {
          const tx: Transaction = {
            ...querier(),
            rollback() {
              rolled = true;
            },
          };
          const value = await fn(tx);
          db.exec(rolled ? "ROLLBACK" : "COMMIT");
          return value;
        } catch (error) {
          try {
            db.exec("ROLLBACK");
          } catch {
            /* already closed */
          }
          throw error;
        }
      });
    },
    async close() {
      db.close();
    },
  };
}

function openPostgres(): Driver {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
  });
  const querier = (client: Pool | PoolClient): Querier => ({
    async get<T>(sql: string, params: unknown[] = []) {
      const result = await client.query(placeholders(sql, true), params);
      return result.rows[0] as T | undefined;
    },
    async all<T>(sql: string, params: unknown[] = []) {
      const result = await client.query(placeholders(sql, true), params);
      return result.rows as T[];
    },
    async run(sql: string, params: unknown[] = []) {
      const result = await client.query(placeholders(sql, true), params);
      return { changes: result.rowCount ?? 0 };
    },
  });
  return {
    kind: "postgres",
    query: (sql, params) => querier(pool).all(sql, params),
    run: (sql, params) => querier(pool).run(sql, params),
    async transaction(fn) {
      const client = await pool.connect();
      let rolled = false;
      try {
        await client.query("BEGIN");
        const tx: Transaction = {
          ...querier(client),
          rollback() {
            rolled = true;
          },
        };
        const value = await fn(tx);
        await client.query(rolled ? "ROLLBACK" : "COMMIT");
        return value;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* already closed */
        }
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

async function ensureSeed(driver: Driver) {
  if (driver.kind === "postgres") {
    for (const statement of POSTGRES_SCHEMA.split(";").map((part) => part.trim()).filter(Boolean)) {
      await driver.query(statement);
    }
  }
  const salt = await driver.query<{ value: string }>("SELECT value FROM meta WHERE key = 'salt'");
  if (!salt[0]) {
    const { randomBytes } = await import("crypto");
    await driver.run("INSERT INTO meta (key, value) VALUES ('salt', ?)", [randomBytes(16).toString("hex")]);
  }
  const heat = await driver.query("SELECT value FROM settings WHERE key = 'heat'");
  if (!heat[0]) {
    await driver.run("INSERT INTO settings (key, value) VALUES ('heat', '0')");
  }
}

export async function getDriver(): Promise<Driver> {
  if (!globalDriver.__retreatDriver) {
    const driver = databaseKind() === "postgres" ? openPostgres() : openSqlite();
    await ensureSeed(driver);
    globalDriver.__retreatDriver = driver;
  }
  return globalDriver.__retreatDriver;
}

export async function closeDriver() {
  if (!globalDriver.__retreatDriver) return;
  await globalDriver.__retreatDriver.close();
  globalDriver.__retreatDriver = undefined;
}

export function isUniqueError(error: unknown) {
  return /unique|duplicate key/i.test(String(error));
}
