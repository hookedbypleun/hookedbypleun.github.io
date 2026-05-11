-- Hooked by Pleun — D1 schema voor events-history
-- Eén INSERT per event; rijke queries via SQL.

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,           -- ms unix timestamp
  day         TEXT    NOT NULL,           -- YYYY-MM-DD
  hour        INTEGER NOT NULL,           -- 0..23 UTC
  type        TEXT    NOT NULL,           -- pageview | product_view | cart_add | cart_open | whatsapp_click | review_submit | postcode_check
  path        TEXT,
  product_id  TEXT,
  kleur       TEXT,
  device      TEXT,
  country     TEXT,
  ref         TEXT,
  postcode    TEXT,
  visitor_id  TEXT                        -- anonieme daily-hash voor unique-tracking
);

CREATE INDEX IF NOT EXISTS idx_events_day      ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_type     ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_day_hour ON events(day, hour);
CREATE INDEX IF NOT EXISTS idx_events_product  ON events(product_id);
CREATE INDEX IF NOT EXISTS idx_events_visitor  ON events(day, visitor_id);

-- Self-check log (voor monitoring)
CREATE TABLE IF NOT EXISTS health_checks (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  target    TEXT NOT NULL,                -- bv. 'homepage', 'galerij', 'worker'
  status    INTEGER NOT NULL,             -- HTTP status, of 0 bij netwerkfail
  latency   INTEGER,                      -- ms
  ok        INTEGER NOT NULL DEFAULT 0    -- 1 = goed, 0 = fout
);

CREATE INDEX IF NOT EXISTS idx_health_ts ON health_checks(ts);
