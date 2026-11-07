import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { unstable_dev } from "wrangler";

const EXCALIBUR = 434172;

function startServer(port: number) {
  const root = mkdtempSync(path.join(tmpdir(), "requests-site-"));
  symlinkSync(process.cwd(), path.join(root, "davenport-table"));
  const child = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: "ignore",
  });
  return child;
}

test("requests page uses the same edit-code session as Peeps", async () => {
  const port = 8821;
  const sitePort = 8876;
  const worker = await unstable_dev(path.join(process.cwd(), "worker/src/index.ts"), {
    config: path.join(process.cwd(), "wrangler.toml"),
    ip: "127.0.0.1",
    port,
    localProtocol: "http",
    persist: true,
    persistTo: mkdtempSync(path.join(tmpdir(), "do-session-")),
    vars: {
      ALLOWED_ORIGINS: `http://127.0.0.1:${sitePort}`,
      RETREAT_SIGNUP_LIMIT: "1000",
      RETREAT_MUTATION_LIMIT: "1000",
      RETREAT_HOUSE_LIMIT: "1000",
    },
    experimental: { disableExperimentalWarning: true },
  });
  const site = startServer(sitePort);
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--remote-debugging-port=9251", "--user-data-dir=/tmp/chrome-request-session", "about:blank",
  ], { stdio: "ignore" });
  try {
    const joined = await worker.fetch("http://127.0.0.1/api/attendees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: "LocalPeep", note: "" }),
    });
    const body = await joined.json() as { claimToken?: string; board?: { you?: { id: string } }; error?: string };
    assert.equal(joined.status, 200, body.error);
    const code = `${body.board?.you?.id}.${body.claimToken}`;
    const page = await openPage();
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `window.RETREAT_API=${JSON.stringify(`http://127.0.0.1:${port}`)};sessionStorage.setItem("retreat-edit-code",${JSON.stringify(code)});`,
    });
    await page.send("Page.navigate", { url: `http://127.0.0.1:${sitePort}/davenport-table/requests/?fixture=1` });
    await waitFor(page, "document.querySelector('#owned-list button') && document.getElementById('request-status').textContent.includes('LocalPeep')");
    await page.eval("document.getElementById('owned-search').value='Excalibur (English deluxe'; document.getElementById('owned-search').dispatchEvent(new Event('input'))");
    const before = await page.eval("({text: document.querySelector('#owned-list button').textContent, disabled: document.querySelector('#owned-list button').disabled, rows: document.querySelectorAll('#owned-list article').length, titles: [...document.querySelectorAll('#owned-list h2')].map(h => h.textContent)})");
    assert.equal(before.disabled, false);
    assert.equal(before.text, "Request");
    assert.equal(before.rows, 1);
    await page.eval("document.querySelector('#owned-list button').click()");
    await waitFor(page, "document.querySelector('#owned-list button') && document.querySelector('#owned-list button').textContent==='Withdraw'");
    const saved = await worker.fetch("http://127.0.0.1/api/requests", { headers: { authorization: `Bearer ${code}` } });
    const savedBody = await saved.json() as { requests: { bggId: number; id: string }[] };
    assert.equal(savedBody.requests.length, 1, JSON.stringify({ before, saved: savedBody.requests }));
    assert.equal(savedBody.requests[0].bggId, EXCALIBUR);
    await page.send("Page.reload", { ignoreCache: true });
    await waitFor(page, "document.getElementById('request-status').textContent.includes('LocalPeep')");
    await page.eval("document.getElementById('owned-search').value='Excalibur (English deluxe'; document.getElementById('owned-search').dispatchEvent(new Event('input'))");
    await waitFor(page, "document.querySelector('#owned-list button') && document.querySelector('#owned-list button').textContent==='Withdraw'");
    await page.eval("document.querySelector('#owned-list button').click()");
    await waitFor(page, "document.querySelector('#owned-list button') && document.querySelector('#owned-list button').textContent==='Request' && !document.querySelector('#owned-list button').disabled");
    const after = await worker.fetch("http://127.0.0.1/api/requests");
    const afterBody = await after.json() as { requests: unknown[] };
    assert.equal(afterBody.requests.length, 0);
    const hosts = await page.eval("[...performance.getEntriesByType('resource')].map(e => new URL(e.name).host)");
    assert.equal(hosts.includes("davenport-table-api.shea-nelson.workers.dev"), false);
  } finally {
    chrome.kill("SIGKILL");
    site.kill("SIGKILL");
    await worker.stop();
  }
});

async function openPage() {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let version: { webSocketDebuggerUrl: string } | null = null;
  for (let i = 0; i < 40 && !version; i += 1) {
    try {
      const response = await fetch("http://127.0.0.1:9251/json/version");
      if (response.ok) version = await response.json() as { webSocketDebuggerUrl: string };
    } catch { /* chrome still starting */ }
    if (!version) await sleep(150);
  }
  if (!version) throw new Error("Chrome did not start");
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("devtools socket failed")));
  });
  let next = 1;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message: string } };
    if (!message.id || !pending.has(message.id)) return;
    const waiter = pending.get(message.id)!;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  function send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    const id = next++;
    const payload: { id: number; method: string; params: Record<string, unknown>; sessionId?: string } = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify(payload));
    });
  }
  const created = await send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const attached = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true }) as { sessionId: string };
  const sessionId = attached.sessionId;
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  return {
    send: (method: string, params?: Record<string, unknown>) => send(method, params, sessionId),
    eval: async (expression: string) => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId) as { result?: { value: unknown }; exceptionDetails?: unknown };
      if (result.exceptionDetails) throw new Error("page script failed");
      return result.result?.value;
    },
  };
}

async function waitFor(page: { eval: (expression: string) => Promise<unknown> }, expression: string) {
  for (let i = 0; i < 40; i += 1) {
    if (await page.eval(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}
