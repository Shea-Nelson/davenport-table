import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const pageUrl = process.env.REQUESTS_PAGE_URL || "";

test("clicking a rendered row requests that row, including the first of 483", async () => {
  const sitePort = 8877;
  const root = mkdtempSync(path.join(tmpdir(), "row-site-"));
  symlinkSync(process.cwd(), path.join(root, "davenport-table"));
  const site = pageUrl ? null : spawn("python3", ["-m", "http.server", String(sitePort), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--remote-debugging-port=9254", "--user-data-dir=/tmp/chrome-row-binding", "about:blank",
  ], { stdio: "ignore" });
  try {
    const page = await openPage();
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: mockFetch });
    const target = pageUrl || `http://127.0.0.1:${sitePort}/davenport-table/requests/?rows=1`;
    await page.send("Page.navigate", { url: target });
    await waitFor(page, "document.querySelectorAll('#owned-list article').length===483 && document.querySelector('#owned-list button').textContent==='Request' && !document.querySelector('#owned-list button').disabled");
    const first = await page.eval("document.querySelector('#owned-list h2').textContent");
    assert.equal(first, "12 Days");
    await page.eval("document.querySelector('#owned-list button').click()");
    await waitFor(page, "window.__posts.length===1");
    const firstPost = await page.eval("window.__posts[0]");
    assert.deepEqual(firstPost, { bggId: 130899 });
    await page.eval("document.querySelectorAll('#owned-list button')[1].click()");
    await waitFor(page, "window.__posts.length===2");
    const secondPost = await page.eval("window.__posts[1]");
    assert.deepEqual(secondPost, { bggId: 423850 });
    await page.eval("document.getElementById('owned-search').value='Horrified: Dungeons'; document.getElementById('owned-search').dispatchEvent(new Event('input'))");
    const filtered = await page.eval("({rows: document.querySelectorAll('#owned-list article').length, title: document.querySelector('#owned-list h2').textContent})");
    assert.equal(filtered.rows, 1);
    assert.equal(filtered.title, "Horrified: Dungeons & Dragons");
    await page.eval("document.querySelector('#owned-list button').click()");
    await waitFor(page, "window.__posts.length===3");
    const filteredPost = await page.eval("window.__posts[2]");
    assert.deepEqual(filteredPost, { bggId: 437705 });
    assert.equal(await page.eval("window.__posts.some(p => p.bggId===62871)"), false);
    await page.eval("sessionStorage.setItem('fixture-phase','withdraw')");
    await page.send("Page.navigate", { url: target });
    await waitFor(page, "document.querySelector('#owned-list button').textContent==='Withdraw'");
    const withdrawTitle = await page.eval("document.querySelector('#owned-list h2').textContent");
    assert.equal(withdrawTitle, "12 Days");
    await page.eval("document.querySelector('#owned-list button').click()");
    await waitFor(page, "window.__deletes.length===1");
    const deleted = await page.eval("window.__deletes[0]");
    assert.equal(String(deleted).endsWith("/api/requests/req-12-days"), true);
    assert.equal(String(deleted).includes("62871"), false);
  } finally {
    chrome.kill("SIGKILL");
    site?.kill("SIGKILL");
  }
});

const mockFetch = `
window.__posts = [];
window.__deletes = [];
window.__saved = [{id:"req-12-days", bggId:130899, title:"12 Days", requesterId:"local-shea", requesterName:"Shea", createdAt:"2026-11-07T00:00:00.000Z"}];
window.__phase = sessionStorage.getItem("fixture-phase") || "request";
const orig = window.fetch.bind(window);
window.fetch = function (url, opts) {
  const u = String(url);
  const method = (opts && opts.method) || "GET";
  if (u.indexOf("/api/owned") !== -1 || u.indexOf("owned.json") !== -1) {
    return orig(new URL("/davenport-table/collections/owned.json", location.origin).href);
  }
  if (u.indexOf("/api/board") !== -1) {
    return Promise.resolve(new Response(JSON.stringify({you:{id:"local-shea", nickname:"Shea"}, revision:"fixture", attendees:[], claims:[], games:[], includeHeatEstimate:false}), {status:200, headers:{"content-type":"application/json"}}));
  }
  if (u.indexOf("/api/requests") !== -1 && method === "POST") {
    const body = JSON.parse(opts.body);
    window.__posts.push(body);
    return Promise.resolve(new Response(JSON.stringify({ok:true, created:true, request:{id:"new", bggId:body.bggId}}), {status:200, headers:{"content-type":"application/json"}}));
  }
  if (u.indexOf("/api/requests") !== -1 && method === "DELETE") {
    window.__deletes.push(u);
    window.__phase = "request";
    return Promise.resolve(new Response(JSON.stringify({ok:true, removed:true}), {status:200, headers:{"content-type":"application/json"}}));
  }
  if (u.indexOf("/api/requests") !== -1) {
    const rows = window.__phase === "withdraw" ? window.__saved : [];
    return Promise.resolve(new Response(JSON.stringify({requests: rows}), {status:200, headers:{"content-type":"application/json"}}));
  }
  return orig(url, opts);
};
`;

async function openPage() {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let version: { webSocketDebuggerUrl: string } | null = null;
  for (let i = 0; i < 40 && !version; i += 1) {
    try {
      const response = await fetch("http://127.0.0.1:9254/json/version");
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
  let last = "";
  for (let i = 0; i < 40; i += 1) {
    try {
      if (await page.eval(expression)) return;
      last = String(await page.eval("document.getElementById('request-status')?.textContent || document.body.innerText.slice(0,180)"));
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${expression}. Last: ${last}`);
}
