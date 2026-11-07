import { BoardDurableObject } from "./board-do";

export { BoardDurableObject };

export interface Env {
  BOARD: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
  RETREAT_SIGNUP_LIMIT?: string;
  RETREAT_MUTATION_LIMIT?: string;
  RETREAT_HOUSE_LIMIT?: string;
  ADMIN_TOKEN?: string;
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request, env: Env): Headers | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  let requestHost = "";
  try {
    requestHost = new URL(origin).host;
  } catch {
    return null;
  }
  const workerHost = new URL(request.url).host;
  const allowed = requestHost === workerHost || allowedOrigins(env).includes(origin);
  if (!allowed) return null;
  const headers = new Headers();
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-headers", "authorization, content-type, accept");
  headers.set("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
  headers.set("access-control-max-age", "600");
  headers.set("access-control-expose-headers", "x-retreat-credential");
  headers.set("vary", "Origin");
  return headers;
}

function json(body: unknown, status: number, extra?: Headers) {
  const headers = extra ?? new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" ) {
      return json(
        {
          ok: true,
          service: "davenport-table",
          authority: "sqlite-durable-object",
          notion: "not-connected",
          plan: "workers-free",
        },
        200,
      );
    }
    if (!url.pathname.startsWith("/api/")) {
      return json({ error: "Not found." }, 404);
    }
    const cors = corsHeaders(request, env);
    if (request.headers.get("origin") && !cors) {
      return json({ error: "Cross-origin request blocked." }, 403);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors ?? undefined });
    }
    const stub = env.BOARD.get(env.BOARD.idFromName("davenport-table-2027"));
    const response = await stub.fetch(request);
    const headers = new Headers(response.headers);
    if (cors) {
      cors.forEach((value, key) => headers.set(key, value));
    }
    return new Response(response.body, { status: response.status, headers });
  },
};

export default worker;
