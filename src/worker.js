/*
 * CJ ♥ Margaret wedding site — Cloudflare Worker
 *
 * Every request lands here first (assets.run_worker_first). Guests without
 * the auth cookie get the Y2K password gate; everyone else gets the static
 * site from public/ plus the /api/* endpoints backed by D1.
 *
 * Secrets (wrangler secret put … / .dev.vars for local):
 *   SITE_PASSWORD — the shared guest password (compared case-insensitively)
 *   AUTH_SECRET   — random string used to sign the auth cookie
 */

const COOKIE = 'cjm_key';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days — outlasts the engagement

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env, url);
    }

    const authed = await isAuthed(request, env);

    if (path.startsWith('/api/')) {
      if (!authed) return json({ error: 'who goes there!!' }, 401);
      return handleApi(request, env, path);
    }

    if (!authed) {
      return new Response(gatePage(url.searchParams.has('wrong')), {
        status: 401,
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};

/* ---------- auth ---------- */

async function guestToken(env) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('cjm-wedding-guest'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function isAuthed(request, env) {
  if (!env.AUTH_SECRET) return false;
  const m = (request.headers.get('Cookie') || '').match(
    new RegExp('(?:^|;\\s*)' + COOKIE + '=([0-9a-f]{64})')
  );
  return m !== null && m[1] === (await guestToken(env));
}

async function handleLogin(request, env, url) {
  const form = await request.formData().catch(() => null);
  const guess = String(form?.get('password') || '').trim().toLowerCase();
  const real = String(env.SITE_PASSWORD || '').trim().toLowerCase();
  if (!real || guess !== real) {
    return Response.redirect(new URL('/?wrong', url).toString(), 303);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL('/', url).toString(),
      'Set-Cookie': `${COOKIE}=${await guestToken(env)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

/* ---------- api ---------- */

async function handleApi(request, env, path) {
  try {
    if (path === '/api/visit' && request.method === 'POST') {
      const row = await env.DB
        .prepare("UPDATE counters SET value = value + 1 WHERE name = 'hits' RETURNING value")
        .first();
      return json({ hits: row.value });
    }

    if (path === '/api/guestbook' && request.method === 'GET') {
      const { results } = await env.DB
        .prepare('SELECT name, from_where, homepage, msg, created_at FROM guestbook ORDER BY id ASC LIMIT 500')
        .all();
      return json({
        entries: results.map((r) => ({ name: r.name, from: r.from_where, hp: r.homepage, msg: r.msg, at: r.created_at })),
      });
    }

    if (path === '/api/guestbook' && request.method === 'POST') {
      const b = await request.json().catch(() => null);
      if (!b || b.fax) return json({ ok: true }); // honeypot tripped: lie politely
      const msg = clip(b.msg, 300);
      if (!msg) return json({ error: 'a guestbook entry needs words!!' }, 400);
      const entry = {
        name: clip(b.name, 40) || 'Anonymous Well-Wisher',
        from: clip(b.from, 40),
        hp: clip(b.hp, 80),
        msg,
      };
      const row = await env.DB
        .prepare('INSERT INTO guestbook (name, from_where, homepage, msg) VALUES (?, ?, ?, ?) RETURNING created_at')
        .bind(entry.name, entry.from, entry.hp, entry.msg)
        .first();
      return json({ ok: true, entry: { ...entry, at: row.created_at } });
    }

    if (path === '/api/rsvp' && request.method === 'POST') {
      const b = await request.json().catch(() => null);
      if (!b || b.fax) return json({ ok: true });
      await env.DB
        .prepare('INSERT INTO rsvps (name, email, attending, party, meal, song, boogie, msg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(
          clip(b.name, 60) || 'Mystery Guest',
          clip(b.email, 80),
          b.attending ? 1 : 0,
          clip(b.party, 10),
          clip(b.meal, 12),
          clip(b.song, 80),
          b.boogie ? 1 : 0,
          clip(b.msg, 400)
        )
        .run();
      const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM rsvps WHERE attending = 1').first();
      return json({ ok: true, count: row.n });
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    console.error('api error', path, e.message);
    return json({ error: 'the hamsters powering our server need a rest' }, 500);
  }
}

function clip(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Cache-Control': 'no-store' },
  });
}

/* ---------- the gate ---------- */

function gatePage(wrong) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>🔒 GUESTS ONLY!! - CJ ♥ MARGARET 4EVER</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px 12px;
    background: #17114a url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Ctext x=%228%22 y=%2224%22 font-size=%2212%22 fill=%22%23241b6b%22%3E%E2%9C%A6%3C/text%3E%3Ctext x=%2252%22 y=%2264%22 font-size=%229%22 fill=%22%23241b6b%22%3E%E2%98%85%3C/text%3E%3C/svg%3E');
    font: 12px/1.6 Verdana, Geneva, sans-serif; color: #17114a;
  }
  .box {
    width: min(430px, 94vw); background: #fdfdff; border: 4px ridge #cfcae9;
    box-shadow: 6px 6px 0 #0c0830; text-align: center; padding: 0 0 18px;
  }
  .bar {
    background: linear-gradient(90deg, #574fb5, #b04fb5); color: #fff;
    font-weight: bold; letter-spacing: .08em; padding: 5px 8px; text-align: left;
  }
  h1 {
    font-family: 'Comic Sans MS', 'Comic Sans', cursive;
    font-size: 26px; margin: 18px 10px 4px; color: #574fb5;
    text-shadow: 2px 2px 0 #f3b1dd;
  }
  .dog { font-size: 44px; margin-top: 14px; }
  p { margin: 8px 18px; }
  .wrong {
    color: #d40000; font-weight: bold; animation: blink 1s steps(1) infinite;
  }
  @keyframes blink { 50% { opacity: 0; } }
  input[type=password] {
    font: 14px 'Courier New', monospace; padding: 6px 8px; width: 200px;
    border: 2px inset #cfcae9; background: #fffef5;
  }
  input[type=submit] {
    font: bold 12px Verdana, sans-serif; padding: 6px 14px; margin-left: 4px;
    background: linear-gradient(180deg, #fdfdfd, #cfcae9); border: 3px outset #f6f4ff;
    color: #17114a; cursor: pointer; text-transform: uppercase;
  }
  input[type=submit]:active { border-style: inset; }
  .hint { font-size: 10px; color: #574fb5; }
  .foot { font-size: 9px; color: #8a84c9; margin-top: 14px; }
</style>
</head>
<body>
  <div class="box">
    <div class="bar">🔒 SECURITY.EXE — TOP SECRET AREA</div>
    <div class="dog">🐶</div>
    <h1>HALT!! WHO GOES THERE??</h1>
    <p>This is the <b>OFFICIAL WEDDING HOMEPAGE</b> of CJ ♥ Margaret.<br>
    Jeeeves the dog is on duty and demands the <b>SECRET PASSWORD</b>.</p>
    ${wrong ? '<p class="wrong">❌ WRONG PASSWORD!! Jeeeves is disappointed but not surprised. Try again!!</p>' : ''}
    <form method="POST" action="/api/login">
      <p>
        <input type="password" name="password" placeholder="pssst…" autofocus required>
        <input type="submit" value="🚪 Enter!!">
      </p>
    </form>
    <p class="hint">(the password is on your invitation!! capitalization doesn't count)</p>
    <p class="foot">Best viewed in Netscape Navigator 4.0 at 800×600 ✦ Guarded by one (1) very good boy</p>
  </div>
</body>
</html>`;
}
