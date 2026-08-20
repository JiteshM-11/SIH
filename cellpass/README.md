# CellPass — full-stack demo (real backend)

A working Node/Express backend behind the CellPass frontend: real signup/login
(bcrypt + JWT), a battery dashboard driven by API calls, lab-certification,
and a public server-rendered "verified passport" webpage that the QR code
and PDF export both link to.

## Run it

```bash
npm install
npm start
```

Then open **http://localhost:3000** — the server serves the frontend and the
API from the same origin, so there's nothing else to configure.

## What's real vs. simulated

| Piece | Status |
|---|---|
| Signup / login | Real — bcrypt-hashed passwords, JWT sessions (`routes/auth.js`) |
| Dashboard data | Real — served from `/api/passport/dashboard`, computed in `lib/metrics.js` |
| Lab certification | Real endpoint (`POST /api/passport/certify`), persisted to disk |
| Public verify page | Real — `GET /verify/:passportId` is a server-rendered HTML page; this is what the QR code and PDF link to |
| PDF export | Real — built client-side with jsPDF from live API data |
| Storage | A JSON file at `data/db.json` — good for a demo, not for production concurrency |
| Battery diagnostics (SoH, cycles, temperature…) | **Simulated.** Deterministically derived from the account's email + purchase date in `lib/metrics.js`. Swap this function out for a real telemetry/device feed when you have one. |
| Sessions | Stateless JWT, held in the browser's memory only (not localStorage) — refreshing the page logs you out. Swap in a refresh-token flow or server sessions if you want persistence. |

## Project layout

```
server.js              Express entrypoint — serves public/ and mounts /api
lib/store.js            Tiny JSON-file datastore (no native deps to compile)
lib/metrics.js           Deterministic mock battery metrics
middleware/auth.js       JWT verification middleware
routes/auth.js           /api/auth/signup, /login, /logout, /me
routes/passport.js       /api/passport/dashboard, /certify, /verify/:id
public/index.html        Frontend (calls the API via fetch)
data/db.json             JSON "database" (created automatically)
```

## Extending it

- **Real telemetry**: replace `buildMetrics()` in `lib/metrics.js` with a call
  to your actual battery/BMS data source.
- **Real database**: swap `lib/store.js` for Postgres/Mongo/etc. — the rest
  of the app only calls `findUserByEmail`, `findUserById`,
  `findUserByPassportId`, `insertUser`, `updateUser`, so you only need to
  reimplement those five functions.
- **Production auth**: rotate `JWT_SECRET` via an environment variable
  (`JWT_SECRET=...` before `npm start`) instead of the default dev secret in
  `middleware/auth.js`, and consider shorter-lived tokens + refresh tokens.
- **Your own hero video**: change the `data-video-id` attribute on
  `#heroYtBg` in `public/index.html` to any YouTube video ID.
