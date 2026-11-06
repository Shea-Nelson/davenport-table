/* Shared Worker origin.
   The client reads RETREAT_BOARD only when GET /api/board fails.
   "planned" selects the not-live message. "ready" selects a reachability error.
   GET /api/health returned 200 before this flag was set. */
window.RETREAT_API = "https://davenport-table-api.shea-nelson.workers.dev";
window.RETREAT_BOARD = "ready";
