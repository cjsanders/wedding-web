# ~*~ CJ ♥ MARGARET 4EVER ~*~

The official GeoCities-style wedding homepage, hosted on Cloudflare Workers.

- `public/` — the entire site (one glorious hand-written HTML file + photos)
- `public/titanic-8.mid` + `public/lib/` — jukebox track 1 is a real 1997 MIDI file,
  played in-browser by FluidSynth compiled to WASM (`js-synthesizer`, BSD-3;
  `libfluidsynth`, LGPL — license text in `public/lib/`) with `gm.sf2`, a SoundFont
  conversion of the classic Windows "Microsoft GS Wavetable" instrument set
  (Roland-licensed samples; grey-area provenance, swap in e.g. TimGM6mb.sf2 if that
  ever bothers us). All ~3.8 MB of synth+instruments lazy-load on first play only.
- `src/worker.js` — password gate + `/api/*` endpoints (RSVP, guestbook, hit counter)
- `schema.sql` — D1 schema (rsvps, guestbook, counters)

The whole site is password-protected: guests get the shared password from their
invitation, type it once at the Y2K gate page, and a signed cookie keeps them in
for 180 days. Passwords are compared case-insensitively.

## Local dev

```sh
npm install
npm run db:local          # create tables in the local D1 emulator
npx wrangler dev          # http://localhost:8787 — password is "woof" (.dev.vars)
```

## First deploy

```sh
npx wrangler login
npx wrangler d1 create wedding        # copy the database_id it prints
#   → paste it into wrangler.jsonc (replacing REPLACE_ME_AFTER_wrangler_d1_create)
npm run db:remote                     # create tables in production D1
npx wrangler secret put SITE_PASSWORD # the password that goes on the invitations
npx wrangler secret put ADMIN_PASSWORD # a DIFFERENT password: entering it at the gate grants admin
npx wrangler secret put AUTH_SECRET   # any long random string, e.g. `openssl rand -hex 32`
npx wrangler secret put ANTHROPIC_API_KEY # from console.anthropic.com — powers Ask Jeeeves
npm run deploy
```

Later deploys are just `npm run deploy`. To hook up a custom domain, add it in
the Cloudflare dashboard under the Worker's Settings → Domains & Routes.

## Reading the data

```sh
npx wrangler d1 execute wedding --remote --command "SELECT * FROM rsvps ORDER BY id"
npx wrangler d1 execute wedding --remote --command "SELECT * FROM guestbook ORDER BY id"
npx wrangler d1 execute wedding --remote --command "SELECT value FROM counters WHERE name='hits'"
```

To delete a guestbook entry (spam, Aunt Carol's fourth signing, etc.):

```sh
npx wrangler d1 execute wedding --remote --command "DELETE FROM guestbook WHERE id = <id>"
```

## Notes

- Changing `AUTH_SECRET` logs every guest out (they just re-enter the password).
- Admin: type `ADMIN_PASSWORD` at the same password gate to get an admin
  cookie instead of a guest one (an "ADMIN MODE" badge confirms it).
  `GET /api/me` returns your role; admin-only API routes check it.
- Ask Jeeeves is real AI: `/api/jeeves` calls Claude (`JEEVES_MODEL` in
  `src/worker.js`) with a persona + site-canon fact sheet (`JEEVES_SYSTEM`).
  If the wedding details change, update that fact sheet too. Without an
  `ANTHROPIC_API_KEY` (or on any API error) the frontend falls back to the
  pre-recorded answers in `public/index.html`, so Jeeeves never goes silent.
- Both forms have a hidden "fax number" honeypot; submissions that fill it are
  silently discarded.
