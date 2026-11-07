import { cookies } from "next/headers";
import { CLAIM_COOKIE, getBoard, sessionFromCookie } from "./store";
import type { Board } from "./types";

export async function loadBoard(): Promise<Board> {
  const jar = await cookies();
  // SQLite rows can have a null prototype, which React refuses to pass into client components.
  return JSON.parse(JSON.stringify(await getBoard(await sessionFromCookie(jar.get(CLAIM_COOKIE)?.value)))) as Board;
}
