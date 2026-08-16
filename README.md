# Co-Pilot Swarm — full stack

A working backend (auth + persistence) wired up to the Co-Pilot Swarm
frontend simulation.

## What's here

- **`server.js` / `package.json`** — Express API with:
  - Signup/login (bcrypt-hashed passwords, JWT sessions, 7-day expiry)
  - SQLite storage (via `better-sqlite3`) for hazard flares, EV
    pre-conditioning stats, Safety Token awards, and the activity feed —
    all scoped per logged-in user
  - `GET /api/swarm/state` to reload a user's saved activity
  - `DELETE /api/swarm/state` to reset it
- **`index.html`** — the swarm map UI. Now gated behind a login/signup
  screen, and every hazard flare, EV pre-condition event, token award, and
  feed entry is synced to the backend in the background as it happens.

## Running it

**1. Start the backend**

```bash
npm install
npm start
```

This starts the API on `http://localhost:4000` and creates `swarm.db` (a
SQLite file) in the same folder on first run.

> Note: `better-sqlite3` and `bcrypt` are native modules — `npm install`
> will compile them for your platform. This needs internet access to
> `nodejs.org` (for headers) the first time; if you hit a gyp/node-gyp
> error, make sure that's reachable, or install Python + build tools for
> your OS (these packages' usual prerequisites).

**2. Open the frontend**

Just open `index.html` directly in a browser, or serve it with any static
file server. It talks to the backend at `http://localhost:4000` by default.

If you're hosting the backend somewhere else, set this before the script
runs (e.g. in dev tools console, or add a `<script>` tag before the main
one in `index.html`):

```html
<script>window.SWARM_API_BASE = "https://your-backend.example.com";</script>
```

**3. Use it**

- Sign up with any username (3-32 chars) and password (6+ chars).
- Tap a car icon, or the "Simulate hazard" button, to drop a flare.
- Flares, EV pre-conditioning, Safety Tokens, and the activity feed are
  saved to your account as you go — refresh the page and log back in to
  see your history reload.
- "Reset" clears your saved activity on the backend too, not just the UI.

## API summary

| Method | Path                  | Auth | Description                          |
|--------|-----------------------|------|---------------------------------------|
| POST   | `/api/auth/signup`    | no   | Create an account, returns JWT       |
| POST   | `/api/auth/login`     | no   | Log in, returns JWT                  |
| GET    | `/api/auth/me`        | yes  | Confirm current token / user         |
| GET    | `/api/swarm/state`    | yes  | Full saved-state snapshot            |
| POST   | `/api/swarm/flares`   | yes  | Record a hazard flare                |
| POST   | `/api/swarm/tokens`   | yes  | Record a Safety Token award          |
| POST   | `/api/swarm/feed`     | yes  | Append an activity feed entry        |
| DELETE | `/api/swarm/state`    | yes  | Wipe this user's saved activity      |

All authenticated routes expect `Authorization: Bearer <token>`.

## Notes on what was tested

Native modules (`better-sqlite3`, `bcrypt`) couldn't compile in the sandbox
used to build this (no access to `nodejs.org` for build headers), so the
exact server and frontend logic was verified end-to-end against
drop-in stubs backed by Node's built-in `node:sqlite` and `crypto` modules
instead — same SQL, same routes, same JWT/bcrypt-shaped API, just swapped
native bindings. All auth, persistence, multi-user isolation, and reset
behavior passed. The real `bcrypt`/`better-sqlite3` packages will work
identically on a normal machine with internet access.
