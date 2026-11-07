import { escapeHtml } from "./sanitize";

export function htmlPage(input: {
  title: string;
  heading: string;
  paragraphs: string[];
  backHref: string;
  backLabel: string;
  token?: string;
  status?: number;
  cookie?: string;
}): Response {
  const tokenBlock = input.token
    ? `<label for="edit-code">Private edit code</label>
       <input id="edit-code" readonly value="${escapeHtml(input.token)}">
       <p>Store this code. This site keeps only a hash of it. There is no email recovery.</p>`
    : "";
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { margin: 0 auto; max-width: 40rem; padding: 2rem 1.25rem 4rem; background: #f3eee4; color: #1a1430; font: 1.05rem/1.5 Georgia, "Iowan Old Style", serif; }
    a { color: #0c5e56; }
    input { width: 100%; box-sizing: border-box; font: 1rem ui-monospace, monospace; padding: 0.6rem; }
    label { display: block; font: 600 0.95rem/1.4 "Segoe UI", sans-serif; margin-top: 1rem; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(input.heading)}</h1>
    ${input.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    ${tokenBlock}
    <p><a href="${escapeHtml(input.backHref)}">${escapeHtml(input.backLabel)}</a></p>
  </main>
</body>
</html>`;
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  if (input.cookie) headers.set("set-cookie", input.cookie);
  return new Response(body, { status: input.status ?? 200, headers });
}
