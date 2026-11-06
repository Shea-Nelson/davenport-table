# The Davenport Table

Static files for GitHub Pages. This is not the source repository.

The shared board API is `https://davenport-table-api.shea-nelson.workers.dev`. `GET /api/health` returned 200 with `database` `durable-object-sqlite`, `attendees` `0`, and `notion` `mirror-not-configured`. `retreat-config.js` keeps that origin and sets `window.RETREAT_BOARD` to `ready`. The client reads that flag only when `/api/board` fails. `planned` says the Worker is not a live roster. `ready` says the shared board cannot be reached.

`.github/workflows/pages.yml` publishes this directory on a push to `main` after GitHub Pages is set to GitHub Actions. The project path is `/davenport-table`. The Worker allow-list origin is `https://shea-nelson.github.io`.

No roster, edit code, or payment secret is in these files.
