const NICKNAME =
  /^[\p{L}\p{N}](?:[\p{L}\p{N} .'_-]{0,22}[\p{L}\p{N}])?$/u;

export function cleanNickname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < 2 || normalized.length > 24) return null;
  if (!NICKNAME.test(normalized)) return null;
  return normalized;
}

/** Plain text only. Returns null when the field is not acceptable. */
export function cleanNote(input: unknown, max: number): string | null {
  if (input == null || input === "") return "";
  if (typeof input !== "string") return null;
  if (input.length > 4_000) return null;
  const stripped = input.replace(/<[^>]*>/g, " ");
  const cleaned = stripped
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/[<>]/.test(cleaned)) return null;
  if (cleaned.length > max) return null;
  return cleaned;
}

export function cleanTitle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (/[<>]/.test(cleaned)) return null;
  return cleaned;
}

export function cleanPlayers(
  min: unknown,
  max: unknown,
): { min: number | null; max: number | null } | null {
  const parse = (value: unknown): number | null | undefined => {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 20) return undefined;
    return n;
  };
  const lo = parse(min);
  const hi = parse(max);
  if (lo === undefined || hi === undefined) return null;
  if (lo != null && hi != null && lo > hi) return null;
  return { min: lo, max: hi };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
