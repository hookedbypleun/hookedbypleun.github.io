# Stats KV-limiet — wat te doen bij groei

## Probleem (10-mei-2026)

Cloudflare Workers KV gratis tier = **1000 PUT-operaties per dag**. We schreven 7+ keys per pageview (path, total, visitor, geo, dev, ref, feed, event). Bij 150 actieve bezoekers raakten we al door de limiet. Daarna falen alle KV-writes met 429-errors tot 00:00 UTC reset.

## Quick-fix in v3.2.9 (live)

We schrijven nu **3 keys per pageview** in plaats van 7+:
- `pv:date:path` — pageview-counter per pagina
- `total:pv:date` — totaal pageviews
- `total:unique:date` — unieke bezoekers (alleen 1× per nieuwe visitor in isolate)

**Uitgeschakeld** om budget te halen:
- `geo:date:country` — landen-stats
- `dev:date:device` — apparaat-stats
- `ref:date:ref` — verwijzers
- `feed:recent` — live event-feed (nu in-memory, per isolate)
- `event:date:time` — historische events (nu niet meer terug te zoeken op datum/uur/type)

Met 3 PUTs per pageview houden we ruim **300+ pageviews per dag** binnen budget.

## Wat Pleun mist tot we upgraden

In admin → Statistieken werken **wel**:
- ✅ Totaal pageviews / uniques / cart / WhatsApp / reviews per dag
- ✅ Sparkline-grafieken
- ✅ Top pagina's, top producten, top cart-items, top postcodes
- ✅ Live event-feed (gedeeltelijk — alleen events binnen huidige Worker isolate)

**Niet meer**:
- ❌ Top landen / apparaten / verwijzers
- ❌ Volledige geschiedenis-zoekfunctie met datum/uur/type filter

## Twee migratie-paden

### Optie A — Cloudflare D1 (aanbevolen, gratis)

D1 is Cloudflare's serverless SQLite. Limiet = **5M reads/dag, 100k writes/dag** gratis.
Met 100k writes/dag kunnen we ALLE features terugbrengen + veel meer (rijke queries).

**Setup**:
```bash
cd cloudflare-worker
npx wrangler d1 create hooked-stats
# Kopieer de output database_id naar wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "hooked-stats"
# database_id = "<id>"

npx wrangler d1 execute hooked-stats --command "
  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    ts INTEGER NOT NULL,
    type TEXT NOT NULL,
    path TEXT,
    product_id TEXT,
    kleur TEXT,
    device TEXT,
    country TEXT,
    ref TEXT,
    postcode TEXT
  );
  CREATE INDEX idx_events_day ON events(date(ts/1000, 'unixepoch'));
  CREATE INDEX idx_events_type ON events(type);
"

npx wrangler deploy
```

Dan update `worker.js` trackEvent + getStatsSummary om naar D1 te schrijven met SQL. Dat is een bredere refactor, geschat ~2-3 uur werk.

### Optie B — Cloudflare Workers Paid plan ($5/maand)

Geeft **1 miljard KV reads + 10M KV writes per maand**. Geen code-wijzigingen nodig.

```bash
# In Cloudflare dashboard: Workers & Pages → Plans → Upgrade to Workers Paid
```

Daarna in `worker.js` trackEvent: zet de uitgeschakelde geo/dev/ref/feed/event keys terug aan.

## Aanbeveling

- **Korte termijn (familie-shop, weinig bezoekers)**: huidige v3.2.9 quick-fix volstaat — 300+ pageviews/dag is genoeg.
- **Langere termijn (groei naar 1000+ bezoekers/dag)**: optie A (D1).
- **Snelle workaround zonder refactor**: optie B ($5/mnd).

## Reset-tijden

KV-limiet reset elke dag om **00:00 UTC** (= 02:00 NL zomertijd, 01:00 NL wintertijd). Tot dan blijven nieuwe stats hangen op vorige waarden.
