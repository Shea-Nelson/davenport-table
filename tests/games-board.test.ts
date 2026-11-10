import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("games page keeps the requested section after the real page hydrates", async () => {
  const sitePort = 8891;
  const root = mkdtempSync(path.join(tmpdir(), "games-site-"));
  symlinkSync(process.cwd(), path.join(root, "davenport-table"));
  const site = spawn("python3", ["-m", "http.server", String(sitePort), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--remote-debugging-port=9261", "--user-data-dir=/tmp/chrome-games-board", "about:blank",
  ], { stdio: "ignore" });
  try {
    const page = await openPage();
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: mockFetch });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "sessionStorage.setItem('fixture-who','Shea'); sessionStorage.setItem('retreat-edit-code','fixture.shea');" });
    const target = `http://127.0.0.1:${sitePort}/davenport-table/games/?board=1`;
    await page.send("Page.navigate", { url: target });
    await waitFor(page, "document.getElementById('requested-heading') && document.getElementById('requested-heading').isConnected && document.body.innerText.includes('On the shelf')");
    await new Promise((resolve) => setTimeout(resolve, 6500));
    const shea = await page.eval(snapshot);
    assert.equal(shea.connected, true);
    assert.equal(shea.total, "3 games being brought");
    assert.deepEqual(shea.counts, { Shea: "2", Grease: "0", Mel: "0", Shaun: "1" });
    assert.equal(shea.titles.includes("Both Declined"), false);
    assert.deepEqual(shea.buttons["Captain Sonar"], ["Bring it", "Decline"]);
    assert.deepEqual(shea.buttons["Tales from the Red Dragon Inn"], ["Bring it", "Decline"]);
    assert.deepEqual(shea.buttons["Only Grease Owns"], []);
    assert.match(shea.waiting["Tales from the Red Dragon Inn"], /Still waiting on Shea/);
    assert.match(shea.waiting["Only Grease Owns"], /Still waiting on Grease/);
    const shelf = await page.eval("document.getElementById('shelf-cards').innerText");
    assert.match(shelf, /Captain Sonar/);
    assert.match(shelf, /2–8/);
    assert.match(shelf, /Best 8/);
    assert.match(shelf, /Best with a referee/);
    await page.eval("document.querySelector('#gb-plays button[data-v=\"4\"]').click()");
    await waitFor(page, "!document.getElementById('shelf-cards').innerText.includes('Another Shea') && document.getElementById('shelf-cards').innerText.includes('Captain Sonar')");
    await page.eval("document.querySelector('#requested-list article h3').parentElement.querySelector('button').click()");
    await waitFor(page, "sessionStorage.getItem('fixture-post')");
    const posted = await page.eval("JSON.parse(sessionStorage.getItem('fixture-post'))");
    assert.equal(posted.url.endsWith("/api/requests/req-sonar/decision"), true);
    assert.deepEqual(posted.body, { decision: "bring" });

    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "sessionStorage.setItem('fixture-who','Mel'); sessionStorage.setItem('retreat-edit-code','fixture.mel');" });
    await page.send("Page.navigate", { url: target });
    await waitFor(page, "document.getElementById('requested-heading') && document.getElementById('requested-heading').isConnected && document.body.innerText.includes('Requested by')");
    const mel = await page.eval(snapshot);
    assert.equal(mel.connected, true);
    assert.equal(mel.buttonCount, 0);
    assert.deepEqual(mel.titles, ["Captain Sonar", "Only Grease Owns", "Tales from the Red Dragon Inn"]);
  } finally {
    chrome.kill("SIGKILL");
    site?.kill("SIGKILL");
  }
});

test("requests page labels dataset counts, expansions, and open-ended Hot Streak", async () => {
  const sitePort = 8892;
  const root = mkdtempSync(path.join(tmpdir(), "players-site-"));
  symlinkSync(process.cwd(), path.join(root, "davenport-table"));
  const site = spawn("python3", ["-m", "http.server", String(sitePort), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--remote-debugging-port=9262", "--user-data-dir=/tmp/chrome-player-labels", "about:blank",
  ], { stdio: "ignore" });
  try {
    const page = await openPage(9262);
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: mockFetch });
    await page.send("Page.navigate", { url: `http://127.0.0.1:${sitePort}/davenport-table/requests/?players=1` });
    await waitFor(page, "document.querySelectorAll('#owned-list article').length===483");
    const labels = await page.eval(`(() => {
      const want = ["Hot Streak (English edition)", "Catan: 5-6 Player Expansion", "Excalibur (English deluxe edition)", "The Settlers of Catan", "Camel Up (Second Edition) (Lookout Games English edition)", "One Night Ultimate Werewolf: Daybreak (English fourth edition)"];
      const out = {};
      document.querySelectorAll("#owned-list article").forEach((article) => {
        const title = article.querySelector("h2").textContent;
        if (want.includes(title)) out[title] = article.querySelector("p.hint").textContent;
      });
      return out;
    })()`);
    assert.match(labels["Hot Streak (English edition)"], /Players: 2–9\+/);
    assert.equal(labels["Hot Streak (English edition)"].includes("2–9."), false);
    assert.match(labels["Catan: 5-6 Player Expansion"], /Players: 5–6 with the required base game, not a standalone count/);
    assert.match(labels["Excalibur (English deluxe edition)"], /Players: 2–8\./);
    assert.equal(labels["Excalibur (English deluxe edition)"].includes("as of"), false);
    assert.match(labels["The Settlers of Catan"], /Players: 3–4 \(as of 2023\)/);
    assert.match(labels["Camel Up (Second Edition) (Lookout Games English edition)"], /Players: 3–8\./);
    assert.equal(labels["Camel Up (Second Edition) (Lookout Games English edition)"].includes("as of"), false);
    assert.match(labels["One Night Ultimate Werewolf: Daybreak (English fourth edition)"], /Players: 3–7\./);
    assert.equal(labels["One Night Ultimate Werewolf: Daybreak (English fourth edition)"].includes("3–10"), false);
    const credit = await page.eval("document.getElementById('player-sources').textContent");
    assert.match(credit, /CC0/);
    assert.match(credit, /CC BY-SA 3\.0/);
    assert.match(credit, /99/);
    await page.eval("document.querySelector('#plays-with button[data-v=\"4\"]').click()");
    await waitFor(page, "document.querySelectorAll('#owned-list article').length < 483");
    const filtered = await page.eval(`({
      buried: [...document.querySelectorAll('#owned-list h2')].some((heading) => heading.textContent.includes('Buried Secrets')),
      hot: [...document.querySelectorAll('#owned-list h2')].some((heading) => heading.textContent.startsWith('Hot Streak')),
      excalibur: [...document.querySelectorAll('#owned-list h2')].some((heading) => heading.textContent.startsWith('Excalibur'))
    })`);
    assert.equal(filtered.buried, false);
    assert.equal(filtered.hot, true);
    assert.equal(filtered.excalibur, true);
    await page.eval("document.querySelector('#best-with button[data-v=\"5\"]').click()");
    await waitFor(page, "[...document.querySelectorAll('#owned-list h2')].some((heading) => heading.textContent.startsWith('Excalibur'))");
    const best = await page.eval("[...document.querySelectorAll('#owned-list h2')].some((heading) => heading.textContent.startsWith('Hot Streak'))");
    assert.equal(best, true);
    const before = await page.eval("document.documentElement.getAttribute('data-theme') || 'light'");
    await page.eval("document.getElementById('theme-toggle').click()");
    const after = await page.eval("document.documentElement.getAttribute('data-theme')");
    assert.notEqual(after, before);
    await page.eval("document.documentElement.setAttribute('data-theme','dark')");
    const colors = await page.eval(`(() => {
      const card = document.querySelector('.dt-card');
      const num = card.querySelector('.num');
      return { bg: getComputedStyle(card).backgroundColor, fg: getComputedStyle(num).color, chip: getComputedStyle(document.querySelector('#plays-with button[aria-pressed="true"]')).color, chipBg: getComputedStyle(document.querySelector('#plays-with button[aria-pressed="true"]')).backgroundColor };
    })()`);
    assert.notEqual(colors.bg, colors.fg);
    assert.ok(luminance(colors.fg) > luminance(colors.bg));
    assert.ok(luminance(colors.chip) < luminance(colors.chipBg));
  } finally {
    chrome.kill("SIGKILL");
    site?.kill("SIGKILL");
  }
});

const snapshot = `(() => {
  const section = document.getElementById("brought-summary");
  const buttons = {};
  const waiting = {};
  const titles = [];
  document.querySelectorAll("#requested-list article").forEach((article) => {
    const title = article.querySelector("h3").textContent;
    titles.push(title);
    buttons[title] = [...article.querySelectorAll("button")].map((button) => button.textContent);
    waiting[title] = article.querySelector("p.hint").textContent;
  });
  const counts = {};
  document.querySelectorAll("#brought-by-peep li").forEach((item) => {
    const parts = item.textContent.split(": ");
    counts[parts[0]] = parts[1];
  });
  return {
    connected: !!(section && section.isConnected),
    total: document.getElementById("brought-total") && document.getElementById("brought-total").textContent,
    counts,
    titles,
    buttons,
    waiting,
    buttonCount: document.querySelectorAll("#requested-list button").length
  };
})()`;

const mockFetch = `
window.__posts = [];
const requests = [
  {id:"req-sonar", bggId:171131, title:"Captain Sonar", requesterId:"shea", requesterName:"Shea", createdAt:"2026-11-07T00:00:00.000Z", owners:["Shea"], decisions:[]},
  {id:"req-tales", bggId:345266, title:"Tales from the Red Dragon Inn", requesterId:"mel", requesterName:"Mel", createdAt:"2026-11-07T00:01:00.000Z", owners:["Shea","Grease"], decisions:[{owner:"Grease", attendeeId:"grease", decision:"decline", shelfGameId:null, decidedAt:"2026-11-07T00:02:00.000Z"}]},
  {id:"req-grease", bggId:1, title:"Only Grease Owns", requesterId:"mel", requesterName:"Mel", createdAt:"2026-11-07T00:03:00.000Z", owners:["Grease"], decisions:[]},
  {id:"req-done", bggId:2, title:"Both Declined", requesterId:"mel", requesterName:"Mel", createdAt:"2026-11-07T00:04:00.000Z", owners:["Shea","Grease"], decisions:[{owner:"Shea", decision:"decline"},{owner:"Grease", decision:"decline"}]}
];
const orig = window.fetch.bind(window);
window.fetch = function (url, opts) {
  const u = String(url);
  const method = (opts && opts.method) || "GET";
  const who = sessionStorage.getItem("fixture-who") || "Shea";
  if (u.indexOf("/api/board") !== -1) {
    const board = {
      you: {id: who === "Shea" ? "shea" : "mel", nickname: who},
      revision: "fixture-rev",
      attendees: [
        {id:"shea", nickname:"Shea"},
        {id:"grease", nickname:"Grease"},
        {id:"mel", nickname:"Mel"},
        {id:"shaun", nickname:"Shaun"}
      ],
      claims: [],
      games: [
        {id:"g1", title:"Captain Sonar", note:"Best with a referee", broughtBy:"Shea", attendeeId:"shea"},
        {id:"g2", title:"Another Shea", note:"", broughtBy:"Shea", attendeeId:"shea"},
        {id:"g3", title:"Saboteur", note:"", broughtBy:"Shaun", attendeeId:"shaun"}
      ],
      includeHeatEstimate: false
    };
    return Promise.resolve(new Response(JSON.stringify(board), {status:200, headers:{"content-type":"application/json"}}));
  }
  if (u.indexOf("/api/requests") !== -1 && method === "POST") {
    const body = JSON.parse(opts.body);
    const record = {url: u, body: body};
    window.__posts.push(record);
    sessionStorage.setItem("fixture-post", JSON.stringify(record));
    return Promise.resolve(new Response(JSON.stringify({ok:true, created:true, decision: body.decision, request: requests[0], board: null}), {status:200, headers:{"content-type":"application/json"}}));
  }
  if (u.indexOf("/api/requests") !== -1 || u.indexOf("/api/owned") !== -1) {
    if (u.indexOf("/api/owned") !== -1) return orig(new URL("/davenport-table/collections/owned.json", location.origin).href);
    return Promise.resolve(new Response(JSON.stringify({requests: requests}), {status:200, headers:{"content-type":"application/json"}}));
  }
  return orig(url, opts);
};
`;

function luminance(color: string) {
  const channels = (color.match(/[\d.]+/g) || ["0", "0", "0"]).slice(0, 3).map(Number);
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

async function openPage(port = 9261) {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let version: { webSocketDebuggerUrl: string } | null = null;
  for (let i = 0; i < 40 && !version; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
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
  for (let i = 0; i < 50; i += 1) {
    try {
      if (await page.eval(expression)) return;
      last = String(await page.eval("document.getElementById('requested-status')?.textContent || document.body.innerText.slice(0,240)"));
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${expression}. Last: ${last}`);
}
