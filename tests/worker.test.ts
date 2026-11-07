import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { unstable_dev, type Unstable_DevWorker } from "wrangler";
import { LODGING_CENTS, shareCents } from "../lib/money";
import type { Board } from "../lib/types";

const config = path.join(process.cwd(), "wrangler.toml");

async function start(options: {
  persistTo: string;
  signupLimit?: string;
  mutationLimit?: string;
  houseLimit?: string;
  port: number;
}) {
  return unstable_dev(path.join(process.cwd(), "worker/src/index.ts"), {
    config,
    ip: "127.0.0.1",
    port: options.port,
    localProtocol: "http",
    persist: true,
    persistTo: options.persistTo,
    vars: {
      ALLOWED_ORIGINS: "https://shea-nelson.github.io,https://pages.example,http://127.0.0.1:47221",
      RETREAT_SIGNUP_LIMIT: options.signupLimit || "1000",
      RETREAT_MUTATION_LIMIT: options.mutationLimit || "1000",
      RETREAT_HOUSE_LIMIT: options.houseLimit || "1000",
    },
    experimental: { disableExperimentalWarning: true },
  });
}

async function readJson(response: Response) {
  return (await response.json()) as {
    error?: string;
    claimToken?: string;
    board?: Board;
    ok?: boolean;
    database?: string;
    notion?: string;
    attendees?: number;
  } & Partial<Board>;
}

async function signup(worker: Unstable_DevWorker, nickname: string, note = "", ip = "203.0.113.10") {
  const response = await worker.fetch("http://127.0.0.1/api/attendees", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ nickname, note }),
  });
  const body = await readJson(response);
  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.includes("table_claim=") ? setCookie.split(";")[0] : "";
  const code = body.board?.you && body.claimToken ? `${body.board.you.id}.${body.claimToken}` : "";
  return { response, body, cookie, setCookie, code, status: response.status };
}

test("worker board starts empty and does not publish an address", async () => {
  const worker = await start({ persistTo: mkdtempSync(path.join(tmpdir(), "do-empty-")), port: 8791 });
  try {
    const health = await worker.fetch("http://127.0.0.1/api/health");
    const healthBody = await readJson(health);
    assert.equal(health.status, 200);
    assert.equal(healthBody.database, "durable-object-sqlite");
    assert.equal(healthBody.notion, "mirror-not-configured");
    assert.equal(healthBody.attendees, 0);

    const response = await worker.fetch("http://127.0.0.1/api/board");
    const board = (await response.json()) as Board;
    assert.equal(board.attendees.length, 0);
    assert.equal(board.cost.lodgingTotalCents, LODGING_CENTS);
    assert.equal(board.cost.lodgingShareCents, null);
    assert.equal(board.you, null);
    const text = JSON.stringify(board);
    assert.equal(text.includes("latitude"), false);
    assert.equal(text.includes("longitude"), false);
    assert.equal(text.includes("Stratos"), false);
    assert.equal(text.includes("@"), false);
  } finally {
    await worker.stop();
  }
});

test("twelve peeps can keep different stays, blank means not set, and a reload keeps them", async () => {
  const persistTo = mkdtempSync(path.join(tmpdir(), "do-stay-"));
  const first = await start({ persistTo, port: 8801 });
  let code = "";
  try {
    for (let index = 0; index < 12; index += 1) {
      const joined = await signup(first, `Stay${index}`);
      assert.equal(joined.status, 200, joined.body.error);
      const self = joined.body.board?.attendees.find((person) => person.nickname === `Stay${index}`);
      assert.equal(self?.arrivalAt, null);
      assert.equal(self?.departureAt, null);
      if (index === 0) code = joined.code;
    }
    const saved = await first.fetch("http://127.0.0.1/api/attendees/me", {
      method: "PATCH",
      headers: { authorization: `Bearer ${code}`, "content-type": "application/json" },
      body: JSON.stringify({
        nickname: "Stay0",
        note: "",
        arrival: "2027-01-15T18:00:00-05:00",
        departure: "2027-01-17T11:00:00-05:00",
      }),
    });
    assert.equal(saved.status, 200);
    const tooEarly = await first.fetch("http://127.0.0.1/api/attendees/me", {
      method: "PATCH",
      headers: { authorization: `Bearer ${code}`, "content-type": "application/json" },
      body: JSON.stringify({ nickname: "Stay0", note: "", arrival: "2027-01-14T15:00:00-05:00", departure: "2027-01-17T11:00:00-05:00" }),
    });
    assert.equal(tooEarly.status, 400);
    const backwards = await first.fetch("http://127.0.0.1/api/attendees/me", {
      method: "PATCH",
      headers: { authorization: `Bearer ${code}`, "content-type": "application/json" },
      body: JSON.stringify({ nickname: "Stay0", note: "", arrival: "2027-01-17T11:00:00-05:00", departure: "2027-01-15T18:00:00-05:00" }),
    });
    assert.equal(backwards.status, 400);
    const untouched = await first.fetch("http://127.0.0.1/api/attendees/me", {
      method: "PATCH",
      headers: { authorization: `Bearer ${code}`, "content-type": "application/json" },
      body: JSON.stringify({ nickname: "Stay0", note: "still here" }),
    });
    const kept = await readJson(untouched);
    const row = kept.board?.attendees.find((person) => person.nickname === "Stay0");
    assert.equal(row?.arrivalAt, "2027-01-15T18:00:00-05:00");
    assert.equal(row?.note, "still here");
  } finally {
    await first.stop();
  }

  const second = await start({ persistTo, port: 8802 });
  try {
    const board = (await (await second.fetch("http://127.0.0.1/api/board", {
      headers: { authorization: `Bearer ${code}` },
    })).json()) as Board;
    assert.equal(board.attendees.length, 12);
    const row = board.attendees.find((person) => person.nickname === "Stay0");
    assert.equal(row?.arrivalAt, "2027-01-15T18:00:00-05:00");
    assert.equal(row?.departureAt, "2027-01-17T11:00:00-05:00");
    assert.equal(board.attendees.filter((person) => person.arrivalAt == null).length, 11);
  } finally {
    await second.stop();
  }
});

test("cookie and bearer edit code both authorize, and a bad code does not", async () => {
  const worker = await start({ persistTo: mkdtempSync(path.join(tmpdir(), "do-id-")), port: 8792 });
  try {
    const joined = await signup(worker, "Pixel");
    assert.equal(joined.status, 200);
    assert.ok(joined.cookie.startsWith("table_claim="));
    assert.equal(joined.setCookie.includes("HttpOnly"), true);
    assert.equal(joined.setCookie.includes("SameSite=Lax"), true);
    assert.ok(joined.code.includes("."));

    const byCookie = await worker.fetch("http://127.0.0.1/api/board", { headers: { cookie: joined.cookie } });
    const cookieBoard = (await byCookie.json()) as Board;
    assert.equal(cookieBoard.you?.nickname, "Pixel");

    const byBearer = await worker.fetch("http://127.0.0.1/api/claims", {
      method: "POST",
      headers: {
        authorization: `Bearer ${joined.code}`,
        "content-type": "application/json",
        origin: "https://pages.example",
      },
      body: JSON.stringify({ slotId: "bedroom-1", note: "Window side" }),
    });
    assert.equal(byBearer.status, 200);
    assert.equal(byBearer.headers.get("access-control-allow-origin"), "https://pages.example");
    assert.equal(byBearer.headers.get("access-control-allow-credentials"), "true");
    const claimed = await readJson(byBearer);
    assert.equal(claimed.board?.claims.length, 1);
    assert.equal(claimed.board?.claims[0]?.nickname, "Pixel");

    const bad = await worker.fetch("http://127.0.0.1/api/board", {
      headers: {
        authorization: "Bearer 11111111-1111-4111-8111-111111111111.not-a-real-edit-code-value",
        cookie: "table_claim=11111111-1111-4111-8111-111111111111.not-a-real-edit-code-value",
      },
    });
    assert.equal(bad.status, 200);
    assert.equal(bad.headers.get("x-retreat-credential"), "stale");
    assert.match(bad.headers.get("set-cookie") || "", /table_claim=;/);
    const badBoard = (await bad.json()) as Board;
    assert.equal(badBoard.you, null);
    assert.equal(badBoard.attendees.some((person) => person.nickname === "Pixel"), true);

    const badClaim = await worker.fetch("http://127.0.0.1/api/claims", {
      method: "POST",
      headers: {
        authorization: "Bearer 11111111-1111-4111-8111-111111111111.not-a-real-edit-code-value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ slotId: "bedroom-3" }),
    });
    assert.equal(badClaim.status, 401);

    const blocked = await worker.fetch("http://127.0.0.1/api/claims", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json", authorization: `Bearer ${joined.code}` },
      body: JSON.stringify({ slotId: "bedroom-3" }),
    });
    assert.equal(blocked.status, 403);

    const cross = await worker.fetch("http://127.0.0.1/api/attendees", {
      method: "POST",
      headers: {
        origin: "https://pages.example",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.44",
      },
      body: JSON.stringify({ nickname: "Cross" }),
    });
    const crossCookie = cross.headers.get("set-cookie") || "";
    assert.equal(cross.status, 200);
    assert.equal(crossCookie.includes("SameSite=None"), true);
    assert.equal(crossCookie.includes("Secure"), true);
    assert.equal(crossCookie.includes("Partitioned"), true);
    assert.equal(cross.headers.get("access-control-allow-credentials"), "true");

    const preflight = await worker.fetch("http://127.0.0.1/api/claims", {
      method: "OPTIONS",
      headers: { origin: "https://pages.example", "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://pages.example");
  } finally {
    await worker.stop();
  }
});

test("eight concurrent claims leave exactly one owner", async () => {
  const worker = await start({ persistTo: mkdtempSync(path.join(tmpdir(), "do-race-")), port: 8793 });
  try {
    const people = await Promise.all(
      Array.from({ length: 8 }, (_, index) => signup(worker, `Racer${index}`, "", `203.0.113.${index + 1}`)),
    );
    assert.ok(people.every((person) => person.status === 200 && person.code));
    const results = await Promise.all(
      people.map((person) =>
        worker.fetch("http://127.0.0.1/api/claims", {
          method: "POST",
          headers: { authorization: `Bearer ${person.code}`, "content-type": "application/json" },
          body: JSON.stringify({ slotId: "bedroom-1" }),
        }),
      ),
    );
    const statuses = results.map((result) => result.status).sort();
    assert.deepEqual(statuses, [200, 409, 409, 409, 409, 409, 409, 409]);
    const board = (await (await worker.fetch("http://127.0.0.1/api/board")).json()) as Board;
    assert.equal(board.claims.filter((claim) => claim.slotId === "bedroom-1").length, 1);
    assert.equal(board.cost.people, 8);
    assert.equal(board.cost.lodgingShareCents, shareCents(LODGING_CENTS, 8));
  } finally {
    await worker.stop();
  }
});

test("markup is rejected, notes are plain, and the roster survives a worker restart", async () => {
  const persistTo = mkdtempSync(path.join(tmpdir(), "do-keep-"));
  const first = await start({ persistTo, port: 8794 });
  let code = "";
  try {
    const markup = await signup(first, "<script>alert(1)</script>");
    assert.equal(markup.status, 400);
    const joined = await signup(first, "Quill", "hello <img src=x onerror=alert(1)> there");
    assert.equal(joined.status, 200);
    assert.equal(joined.body.board?.attendees[0]?.note.includes("<"), false);
    assert.match(joined.body.board?.attendees[0]?.note || "", /hello/);
    code = joined.code;
    assert.equal(joined.body.board?.cost.lodgingShareCents, LODGING_CENTS);
  } finally {
    await first.stop();
  }

  const second = await start({ persistTo, port: 8795 });
  try {
    const board = (await (await second.fetch("http://127.0.0.1/api/board", {
      headers: { authorization: `Bearer ${code}` },
    })).json()) as Board;
    assert.equal(board.attendees.length, 1);
    assert.equal(board.attendees[0]?.nickname, "Quill");
    assert.equal(board.you?.nickname, "Quill");
  } finally {
    await second.stop();
  }
});

test("signup rate limit fails closed instead of billing", async () => {
  const worker = await start({
    persistTo: mkdtempSync(path.join(tmpdir(), "do-rate-")),
    port: 8796,
    signupLimit: "2",
  });
  try {
    const first = await signup(worker, "One", "", "198.51.100.8");
    const second = await signup(worker, "Two", "", "198.51.100.8");
    const third = await signup(worker, "Three", "", "198.51.100.8");
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    assert.equal(third.body.error?.includes("Too many"), true);
  } finally {
    await worker.stop();
  }
});

test("one house address can register eleven nicknames, and one nickname cannot spend another's saves", async () => {
  const worker = await start({
    persistTo: mkdtempSync(path.join(tmpdir(), "do-house-")),
    port: 8798,
    signupLimit: "40",
    mutationLimit: "2",
    houseLimit: "240",
  });
  try {
    const people = [];
    for (let index = 0; index < 11; index += 1) {
      const joined = await signup(worker, `House${index}`);
      assert.equal(joined.status, 200, joined.body.error);
      people.push(joined);
    }
    const first = people[0];
    const secondPerson = people[1];
    const claim = (code: string, slotId: string) =>
      worker.fetch("http://127.0.0.1/api/claims", {
        method: "POST",
        headers: {
          authorization: `Bearer ${code}`,
          "content-type": "application/json",
          origin: "https://shea-nelson.github.io",
        },
        body: JSON.stringify({ slotId }),
      });
    assert.equal((await claim(first.code, "bedroom-1")).status, 200);
    assert.equal((await claim(first.code, "bedroom-3")).status, 200);
    assert.equal((await claim(first.code, "bedroom-5")).status, 429);
    const other = await claim(secondPerson.code, "bedroom-6");
    assert.equal(other.status, 200);
    assert.equal(other.headers.get("access-control-allow-origin"), "https://shea-nelson.github.io");
    const board = (await (await worker.fetch("http://127.0.0.1/api/board")).json()) as Board;
    assert.equal(board.attendees.length, 11);
    assert.equal(board.claims.length, 3);
  } finally {
    await worker.stop();
  }
});

test("admin reset stays hidden without a worker secret", async () => {
  const worker = await start({ persistTo: mkdtempSync(path.join(tmpdir(), "do-admin-")), port: 8797 });
  try {
    const response = await worker.fetch("http://127.0.0.1/api/admin/reset", {
      method: "POST",
      headers: { authorization: "Bearer test-admin-token-123456" },
    });
    assert.equal(response.status, 404);
  } finally {
    await worker.stop();
  }
});
