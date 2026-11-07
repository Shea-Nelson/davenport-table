export {};

declare global {
  interface Window {
    RETREAT_API?: string;
    /** "planned" means the Worker origin is the intended address and is not verified live. */
    RETREAT_BOARD?: "" | "planned" | "ready";
  }
}
