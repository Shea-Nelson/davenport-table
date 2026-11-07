import { cleanNickname, cleanPlayers } from "./sanitize";

export const NICKNAME_HINT =
  "Letters, numbers, spaces, and . ' _ - . Two to 24 characters. No email and no legal name.";

export const PEEP_HINT = NICKNAME_HINT;

export function nicknameField(raw: string): { value: string; message: string; invalid: boolean; count: number } {
  const cleaned = raw.normalize("NFKC").replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, "");
  let value = cleaned;
  let message = "";
  if (value.length > 24) {
    value = value.slice(0, 24);
    message = "Peep names stop at 24 characters. The extra characters were removed.";
  }
  const count = value.trim().length;
  if (count === 0) return { value, message, invalid: false, count };
  if (cleanNickname(value) === null) {
    message = count < 2 ? "Use at least 2 characters." : "Parentheses and other marks are not allowed in a peep name. Use letters, numbers, spaces, and . ' _ - .";
    return { value, message, invalid: true, count };
  }
  return { value, message, invalid: false, count };
}

export function playerRangeMessage(min: string, max: string): string {
  if (cleanPlayers(min, max)) return "";
  const lo = min.trim() === "" ? null : Number(min);
  const hi = max.trim() === "" ? null : Number(max);
  if (lo != null && hi != null && Number.isInteger(lo) && Number.isInteger(hi) && lo > hi) {
    return "Minimum players cannot be higher than maximum players.";
  }
  return "Player counts, if you add them, are whole numbers from 1 to 20.";
}

/** A poll must not replace a message from a save that started or finished after the poll began. */
export function remoteStatus(input: {
  stampAtFetch: number;
  stampNow: number;
  knownRevision: string;
  nextRevision: string;
}): string | null {
  if (input.stampAtFetch !== input.stampNow) return null;
  if (!input.knownRevision || input.nextRevision === input.knownRevision) return null;
  return "The shared board changed.";
}
