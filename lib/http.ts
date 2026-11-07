import crypto from "crypto";
import { CLAIM_COOKIE, rateSalt, sessionFromCookie } from "./store";
import type { Board } from "./types";

export async function clientRateKey(req: Request): Promise<string> {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ip = forwarded || "local";
  return crypto.createHash("sha256").update(`${await rateSalt()}|${ip}`).digest("hex").slice(0, 32);
}

export function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return site !== "cross-site";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function cookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return undefined;
}

export async function readSession(req: Request) {
  return sessionFromCookie(cookieValue(req, CLAIM_COOKIE));
}

export function secureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function claimCookie(id: string, token: string, secure: boolean): string {
  const parts = [
    `${CLAIM_COOKIE}=${id}.${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 60}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearClaimCookie(secure: boolean): string {
  const parts = [`${CLAIM_COOKIE}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function jsonResponse(body: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  if (cookie) headers.set("set-cookie", cookie);
  if (status === 429) headers.set("retry-after", "120");
  return new Response(JSON.stringify(body), { status, headers });
}

export async function readPayload(
  req: Request,
): Promise<{ json: boolean; data: Record<string, unknown> } | { error: string }> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const text = await req.text();
    if (text.length > 20_000) return { error: "That request is too large." };
    try {
      const data = JSON.parse(text || "{}") as unknown;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { error: "Send a JSON object." };
      }
      return { json: true, data: data as Record<string, unknown> };
    } catch {
      return { error: "That JSON could not be read." };
    }
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: "The form could not be read." };
  }
  const data: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") return { error: "File uploads are not accepted." };
    if (value.length > 4_000) return { error: "That field is too long." };
    data[key] = value;
  }
  return { json: false, data };
}

export function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "1" || value === "true" || value === "on") return true;
  if (value === "0" || value === "false" || value === "off") return false;
  return null;
}

export type Mutation =
  | { ok: true; board: Board; claimToken?: string; clearCookie?: boolean }
  | { ok: false; status: number; error: string; board?: Board };
