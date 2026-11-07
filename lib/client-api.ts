import type { Board } from "./types";

const CODE_KEY = "retreat-edit-code";

export type ApiResult = {
  ok: boolean;
  status: number;
  data: { error?: string; board?: Board; claimToken?: string };
};

export function apiUrl(path: string): string {
  const fromWindow = typeof window !== "undefined" ? window.RETREAT_API : "";
  const base = (fromWindow || process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function credentialHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const token = sessionStorage.getItem(CODE_KEY);
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function rememberEditCode(code: string) {
  sessionStorage.setItem(CODE_KEY, code);
}

export function forgetEditCode() {
  try {
    sessionStorage.removeItem(CODE_KEY);
  } catch {
    /* private mode */
  }
}

export async function sendJson(url: string, method: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(apiUrl(url), {
    method,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...credentialHeaders(),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: ApiResult["data"] = {};
  try {
    data = (await response.json()) as ApiResult["data"];
  } catch {
    data = { error: "The board response could not be read." };
  }
  if (response.status === 401) forgetEditCode();
  return { ok: response.ok, status: response.status, data };
}
