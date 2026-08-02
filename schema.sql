-- CJ ♥ Margaret wedding site — D1 schema
-- Apply locally:  npm run db:local
-- Apply to prod:  npm run db:remote

CREATE TABLE IF NOT EXISTS rsvps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT,
  attending  INTEGER NOT NULL,          -- 1 = yes, 0 = no
  party      TEXT,                      -- "1".."6 (whoa)"
  meal       TEXT,                      -- chicken | steak | veggie
  song       TEXT,
  boogie     INTEGER,                   -- solemnly swore to boogie
  msg        TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guestbook (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  from_where TEXT,
  homepage   TEXT,
  msg        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- the velvet rope: who may RSVP, and how many humans their invite covers.
-- while this table is empty the rope is down (anyone with the password can RSVP).
CREATE TABLE IF NOT EXISTS guestlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,              -- matched against the RSVP name (loosely: case/punctuation-insensitive)
  max_party  INTEGER NOT NULL DEFAULT 2, -- max humans for this invite
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

-- the hit counter starts at 1337, obviously
INSERT OR IGNORE INTO counters (name, value) VALUES ('hits', 1337);
