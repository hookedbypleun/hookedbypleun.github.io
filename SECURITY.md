# Security TODO — pre-launch checklist

Status: **shop draait fijn voor familie + vrienden, NOG NIET breed publiek launchen** zonder de 3 punten hieronder af te tikken.

Niveau 3 team review (v3.0.35) heeft alle code-fixes opgeleverd die ik via deze repo kan oplossen. Wat hieronder staat vereist een handeling buiten de code.

## 🔴 Blokker 1 — Rate limit naar persistente storage

**Probleem**: in-memory rate limiter (`worker.js:_rateBuckets`) werkt per Cloudflare Worker isolate. Een aanvaller met meerdere parallelle requests kan dit omzeilen — de buckets zijn niet gedeeld tussen isolates.

**Wat te doen**:
1. Maak een Cloudflare KV namespace via dashboard of `wrangler kv:namespace create RATE_LIMIT`
2. Voeg binding toe in `wrangler.toml`
3. Vervang `_rateBuckets.set/get` door `env.RATE_LIMIT.put/get` met TTL

Voor een familie-shop met tientallen bezoekers per dag: in-memory volstaat momenteel. Bij groei naar honderden bezoekers en eerste spam-attempts: KV migreren.

## 🔴 Blokker 2 — Fine-grained GitHub PAT

**Probleem**: huidige `GITHUB_TOKEN` in Worker-secrets heeft "Contents: write" op de hele repo. Bij worker-compromise → volledige repo-takeover mogelijk.

**Wat te doen**:
1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new
2. Repository access: alleen `hookedbypleun/hookedbypleun.github.io`
3. Permissions: Contents: read+write, Metadata: read
4. Geen "Issues" / "Pull requests" / "Workflows" rechten
5. Vervang `GITHUB_TOKEN` in Cloudflare Worker secrets

Verlaagt blast-radius van een eventuele lek aanzienlijk.

## 🔴 Blokker 3 — Reviews + namen GDPR

**Probleem**: `data/reviews.json` staat in publieke GitHub-repo met klantnamen + tekst. Pleun is 12 (minderjarig), klanten waarschijnlijk vaak ook. GDPR vereist toestemming voor publicatie van persoonsgegevens.

**Drie opties**:
- **A** (snelst): bij review-formulier expliciete checkbox "Ik geef toestemming dat mijn voornaam en bericht openbaar getoond worden" — alleen bij vinkje publiceren
- **B** (privacy-first): toon alleen voornaam met initiaal achternaam ("Anna B.") — anonimisering
- **C** (architectuur): reviews naar Cloudflare KV in plaats van Git-repo

Aanbevolen: optie A + B gecombineerd.

---

## ✅ Al opgelost in v3.0.34/v3.0.35

- AI password TTL: 12u → 2u + Logout-knop
- Timing-safe password compare (was: direct `===`)
- Rate limit /auth (5/5min), /review (3/10min) — in-memory voor nu
- /upload-photo magic-byte MIME-validatie + path-traversal protection
- /upload-photo max 8MB cap
- /smart-edit 800-char cap + control-char strip (DOS + injection rem)
- WCAG: outline visible op alle focus-states
- Cart migratie v1 → v2 (oude entries zonder kleur worden veilig overgenomen)

## 🟡 Bewuste keuzes (geen fix)

- WhatsApp-nummer publiek in `js/config.js` — by design (klanten moeten kunnen bestellen). Worker-redirect via `/order` verbergt het wel zodra `workerUrl` is ingesteld.
- localhost in CORS — voor lokale dev. Acceptabel risico zolang het een whitelist is, geen wildcard.
- 3.0.x versie als deploy-teller (geen semver) — bewuste keuze voor cache-busting.
