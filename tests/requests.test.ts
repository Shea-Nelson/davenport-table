import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { unstable_dev, type Unstable_DevWorker } from "wrangler";

const EXCALIBUR = 434172;
const AVALON = 128882;
const TALES = 345266;

async function start(port: number) {
  return unstable_dev(path.join(process.cwd(), "worker/src/index.ts"), {
    config: path.join(process.cwd(), "wrangler.toml"),
    ip: "127.0.0.1",
    port,
    localProtocol: "http",
    persist: true,
    persistTo: mkdtempSync(path.join(tmpdir(), "do-requests-")),
    vars: {
      ALLOWED_ORIGINS: "https://shea-nelson.github.io",
      RETREAT_SIGNUP_LIMIT: "1000",
      RETREAT_MUTATION_LIMIT: "1000",
      RETREAT_HOUSE_LIMIT: "1000",
    },
    experimental: { disableExperimentalWarning: true },
  });
}

async function signup(worker: Unstable_DevWorker, nickname: string) {
  const response = await worker.fetch("http://127.0.0.1/api/attendees", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ nickname, note: "" }),
  });
  const body = (await response.json()) as { claimToken?: string; board?: { you?: { id: string }; games: unknown[] }; error?: string };
  assert.equal(response.status, 200, body.error);
  return { code: `${body.board?.you?.id}.${body.claimToken}`, games: body.board?.games.length ?? -1 };
}

test("owned catalog is public and keeps Excalibur distinct from Avalon", async () => {
  const worker = await start(8891);
  try {
    const response = await worker.fetch("http://127.0.0.1/api/owned");
    const body = (await response.json()) as {
      rawRows: number;
      uniqueGames: number;
      games: { bggId: number; title: string; url: string; owners: string[] }[];
    };
    assert.equal(response.status, 200);
    assert.equal(body.rawRows, 501);
    assert.equal(body.uniqueGames, 483);
    const excalibur = body.games.find((game) => game.bggId === EXCALIBUR);
    const avalon = body.games.find((game) => game.bggId === AVALON);
    assert.equal(excalibur?.title, "Excalibur (English deluxe edition)");
    assert.equal(excalibur?.url, "https://boardgamegeek.com/boardgame/434172/excalibur");
    assert.equal(avalon?.title.includes("Avalon"), true);
    assert.notEqual(excalibur?.bggId, avalon?.bggId);
    const tales = body.games.find((game) => game.bggId === TALES);
    assert.deepEqual(tales?.owners, ["Shea", "Grease"]);
  } finally {
    await worker.stop();
  }
});

test("a request is idempotent, does not join the shelf, and only the requester can withdraw it", async () => {
  const worker = await start(8892);
  try {
    const anon = await worker.fetch("http://127.0.0.1/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bggId: EXCALIBUR }),
    });
    assert.equal(anon.status, 401);

    const first = await signup(worker, "ReqA");
    const second = await signup(worker, "ReqB");
    const headers = { authorization: `Bearer ${first.code}`, "content-type": "application/json" };
    const created = await worker.fetch("http://127.0.0.1/api/requests", {
      method: "POST",
      headers,
      body: JSON.stringify({ bggId: EXCALIBUR }),
    });
    const createdBody = (await created.json()) as { created: boolean; request: { id: string; bggId: number; title: string } };
    assert.equal(created.status, 200);
    assert.equal(createdBody.created, true);
    assert.equal(createdBody.request.bggId, EXCALIBUR);

    const again = await worker.fetch("http://127.0.0.1/api/requests", {
      method: "POST",
      headers,
      body: JSON.stringify({ bggId: EXCALIBUR }),
    });
    const againBody = (await again.json()) as { created: boolean; request: { id: string } };
    assert.equal(againBody.created, false);
    assert.equal(againBody.request.id, createdBody.request.id);

    const missing = await worker.fetch("http://127.0.0.1/api/requests", {
      method: "POST",
      headers,
      body: JSON.stringify({ bggId: 99999999 }),
    });
    assert.equal(missing.status, 400);

    const board = (await (await worker.fetch("http://127.0.0.1/api/board")).json()) as { games: unknown[] };
    assert.equal(board.games.length, 0);
    assert.equal(first.games, 0);

    const stolen = await worker.fetch(`http://127.0.0.1/api/requests/${createdBody.request.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${second.code}` },
    });
    assert.equal(stolen.status, 403);
    const still = (await (await worker.fetch("http://127.0.0.1/api/requests")).json()) as { requests: { id: string }[] };
    assert.equal(still.requests.some((row) => row.id === createdBody.request.id), true);

    const withdrawn = await worker.fetch(`http://127.0.0.1/api/requests/${createdBody.request.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${first.code}` },
    });
    assert.equal((await withdrawn.json() as { removed: boolean }).removed, true);
    const repeat = await worker.fetch(`http://127.0.0.1/api/requests/${EXCALIBUR}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${first.code}` },
    });
    assert.equal(repeat.status, 200);
    assert.equal((await repeat.json() as { removed: boolean }).removed, false);
  } finally {
    await worker.stop();
  }
});
