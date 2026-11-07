import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { unstable_dev, type Unstable_DevWorker } from "wrangler";

const EXCALIBUR = 434172;
const TALES = 345266;

async function start(port: number) {
  return unstable_dev(path.join(process.cwd(), "worker/src/index.ts"), {
    config: path.join(process.cwd(), "wrangler.toml"),
    ip: "127.0.0.1",
    port,
    localProtocol: "http",
    persist: true,
    persistTo: mkdtempSync(path.join(tmpdir(), "do-decide-")),
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
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname, note: "" }),
  });
  const body = await response.json() as { claimToken?: string; board?: { you?: { id: string }; games: { id: string; title: string; note: string; broughtBy: string }[] }; error?: string };
  assert.equal(response.status, 200, body.error);
  return { code: `${body.board?.you?.id}.${body.claimToken}`, board: body.board! };
}

async function requestGame(worker: Unstable_DevWorker, code: string, bggId: number) {
  const response = await worker.fetch("http://127.0.0.1/api/requests", {
    method: "POST",
    headers: { authorization: `Bearer ${code}`, "content-type": "application/json" },
    body: JSON.stringify({ bggId }),
  });
  const body = await response.json() as { request: { id: string; bggId: number; owners: string[]; decisions: unknown[] }; error?: string };
  assert.equal(response.status, 200, body.error);
  return body.request;
}

function auth(code: string) {
  return { authorization: `Bearer ${code}`, "content-type": "application/json" };
}

test("only the matching owner can bring or decline, and a repeat bring does not duplicate the shelf", async () => {
  const worker = await start(8831);
  try {
    const anon = await worker.fetch("http://127.0.0.1/api/requests/00000000-0000-4000-8000-000000000000/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "bring" }),
    });
    assert.equal(anon.status, 401);

    const shea = await signup(worker, "Shea");
    const grease = await signup(worker, "Grease");
    const mel = await signup(worker, "Mel");
    const excalibur = await requestGame(worker, mel.code, EXCALIBUR);
    const tales = await requestGame(worker, mel.code, TALES);
    assert.deepEqual(excalibur.owners, ["Shea"]);
    assert.deepEqual(tales.owners, ["Shea", "Grease"]);

    const melBring = await worker.fetch(`http://127.0.0.1/api/requests/${excalibur.id}/decision`, {
      method: "POST",
      headers: auth(mel.code),
      body: JSON.stringify({ decision: "bring" }),
    });
    assert.equal(melBring.status, 403);
    const greaseOnShea = await worker.fetch(`http://127.0.0.1/api/requests/${excalibur.id}/decision`, {
      method: "POST",
      headers: auth(grease.code),
      body: JSON.stringify({ decision: "decline" }),
    });
    assert.equal(greaseOnShea.status, 403);

    const brought = await worker.fetch(`http://127.0.0.1/api/requests/${excalibur.id}/decision`, {
      method: "POST",
      headers: auth(shea.code),
      body: JSON.stringify({ decision: "bring" }),
    });
    const broughtBody = await brought.json() as { board: { games: { title: string; note: string; broughtBy: string }[] }; decision: { shelfGameId: string } };
    assert.equal(brought.status, 200);
    assert.equal(broughtBody.board.games.filter((game) => game.broughtBy === "Shea").length, 1);
    const again = await worker.fetch(`http://127.0.0.1/api/requests/${excalibur.id}/decision`, {
      method: "POST",
      headers: auth(shea.code),
      body: JSON.stringify({ decision: "bring" }),
    });
    const againBody = await again.json() as { created: boolean; board: { games: unknown[] } };
    assert.equal(again.status, 200);
    assert.equal(againBody.created, false);
    assert.equal(againBody.board.games.length, 1);

    const noted = await worker.fetch("http://127.0.0.1/api/games", {
      method: "POST",
      headers: auth(shea.code),
      body: JSON.stringify({ title: "Tales from the Red Dragon Inn", note: "keep this note", minPlayers: 1, maxPlayers: 4 }),
    });
    assert.equal(noted.status, 200);
    const greaseDecline = await worker.fetch(`http://127.0.0.1/api/requests/${tales.id}/decision`, {
      method: "POST",
      headers: auth(grease.code),
      body: JSON.stringify({ decision: "decline" }),
    });
    assert.equal(greaseDecline.status, 200);
    const still = await worker.fetch("http://127.0.0.1/api/requests");
    const stillBody = await still.json() as { requests: { id: string; owners: string[]; decisions: { owner: string; decision: string }[] }[] };
    const talesRow = stillBody.requests.find((row) => row.id === tales.id)!;
    assert.equal(talesRow.decisions.length, 1);
    assert.equal(talesRow.decisions[0].owner, "Grease");
    assert.equal(talesRow.owners.includes("Shea"), true);
    const sheaBring = await worker.fetch(`http://127.0.0.1/api/requests/${tales.id}/decision`, {
      method: "POST",
      headers: auth(shea.code),
      body: JSON.stringify({ decision: "bring" }),
    });
    const sheaBody = await sheaBring.json() as { board: { games: { title: string; note: string; broughtBy: string }[] } };
    assert.equal(sheaBring.status, 200);
    const talesGames = sheaBody.board.games.filter((game) => game.title.toLowerCase().includes("tales"));
    assert.equal(talesGames.length, 1);
    assert.equal(talesGames[0].note, "keep this note");
    const byPeep: Record<string, number> = {};
    for (const person of ["Shea", "Grease", "Mel"]) byPeep[person] = 0;
    for (const game of sheaBody.board.games) byPeep[game.broughtBy] += 1;
    const total = sheaBody.board.games.length;
    assert.equal(Object.values(byPeep).reduce((sum, count) => sum + count, 0), total);
    assert.equal(byPeep.Mel, 0);
    assert.equal(byPeep.Grease, 0);
    assert.equal(total, 2);

    const withdrawn = await worker.fetch(`http://127.0.0.1/api/requests/${tales.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${mel.code}` },
    });
    assert.equal(withdrawn.status, 200);
    const after = await worker.fetch("http://127.0.0.1/api/requests");
    const afterBody = await after.json() as { requests: { id: string }[] };
    assert.equal(afterBody.requests.some((row) => row.id === tales.id), false);
    const shelf = await worker.fetch("http://127.0.0.1/api/board");
    const shelfBody = await shelf.json() as { games: { note: string }[] };
    assert.equal(shelfBody.games.some((game) => game.note === "keep this note"), true);
  } finally {
    await worker.stop();
  }
});
