# Changelog — Hooked by Pleun

Versies vanaf v3.0.22 (de bulk-import lancering). Elke versie = één deploy. We bumpen patches per deploy (geen strict semver — versie is vooral een cache-buster en deploy-teller).

---

## v3.1.0 — 2026-05-09 — **Launch-ready**

🎉 Eerste publieke release. Alles wat in v3.0.x is opgebouwd is verzameld in één stabiele snapshot.

### Hoofdfuncties
- **Static site** op GitHub Pages (`hookedbypleun.github.io`) — homepage, galerij met filter+sort, productpagina's, bestel-flow, "over mij", "eerder gemaakt"-archief
- **Verzameldoos** (cart) met 3-tarief verzending, gratis vanaf €25, lokale Pleun Express bezorging
- **WhatsApp-checkout** zonder accounts — bericht wordt opgesteld en je opent WhatsApp met 1 klik
- **PWA** met service worker — installeerbaar op telefoon, basic offline support
- **Admin-paneel** voor Pleun: AI-wizard voor nieuwe items, variant + foto editor, smart-edit met natuurlijke taal, foto-tweak modal, reviews-moderatie, site-instellingen
- **Cloudflare Worker** als auth-laag + Gemini AI bridge + GitHub commit gateway

### Nieuw in v3.1.0
- 🎀 Volgers-aantal updatebaar via admin (`data/site-config.json`)
- ✏️ Terug-knop op productpagina (history.back met categorie-fallback)
- 📦 Cart-knop click-target gefixt (closest ipv matches)
- 🎯 Features-row gecentreerd op desktop
- 📄 CHANGELOG.md + grondige vault-export voor langetermijn-doc

### Production-blockers (zie `SECURITY.md`)
1. Rate-limit naar Cloudflare KV migreren (nu in-memory per isolate)
2. Fine-grained GitHub PAT (nu volle "Contents: write")
3. Reviews GDPR-toestemmingsflow (klantnamen in publieke repo)

---

## v3.0.45 — 2026-05-09
- features-row gecentreerd op desktop (`margin: auto`)

## v3.0.44 — 2026-05-09
- Terug-knop op productpagina met history.back fallback

## v3.0.43 — 2026-05-09
- Cart-button click target: `closest()` ipv `matches()` (klikken op emoji of count-span werkt nu)

## v3.0.42 — 2026-05-09
- Admin volledig inklapbaar: AI-wizard, Huidige items, Form, Recent, Reviews allemaal `<details>`
- Form klapt automatisch open bij ✏️, dicht bij Bewaren / Form leegmaken

## v3.0.41 — 2026-05-09
- Oude bulk drag&drop sectie verwijderd uit admin
- Bulk JS init beschermd tegen null DOM

## v3.0.40 — 2026-05-09
- **Bug fix**: `calculateShipping` subtotaal telde aantallen niet mee → gratis-verzending drempel klopte niet

## v3.0.39 — 2026-05-09
- `heeftMeerKleuren` op basis van **unieke** non-empty kleuren ipv `varianten.length > 1` — geen onnodige kleur-popup bij artikelen met dubbele varianten

## v3.0.38 — 2026-05-09
- Kleur-hint scrollt verder omhoog op mobiel (110px buffer + 4.5s zichtbaar)

## v3.0.37 — 2026-05-09
- Admin: Huidige items, Recent toegevoegd, Reviews modereren inklapbaar
- Bulk-import knop kleiner + confirm popup ("alleen samen met papa")
- Nieuw hoofdlogo (Hooked met hoofdletter)
- Cache-buster `?v=` op alle JS includes (fix cart +/- bug door SW cache)

## v3.0.36 — 2026-05-09
- Tweak-modal CSS-fix (display:flex overschreef hidden-attr)
- Verhaal-foto onerror fallback op homepage
- SECURITY.md met production-blockers

## v3.0.35 — 2026-05-09 — Worker security
- Timing-safe password compare (`timingSafeEqual`)
- Rate limit `/auth` (5/5min), `/review` (3/10min)
- `/upload-photo` magic-byte MIME-validatie + extensie-forceer
- `/upload-photo` 8MB cap + path traversal protection
- `/smart-edit` 800-char cap + control-char strip

## v3.0.34 — 2026-05-09 — Team review fixes
- Cart v2 schema + migratie van v1 (oude entries gemerged)
- `datumToegevoegd` behoud bij update
- Lege variant warning bij Bewaren
- Variant ↑↓ knoppen 18→30px (touch-friendly)
- Items.json kleuren genormaliseerd (lowercase)
- 4 items op `uitgelicht: true` voor "Mijn favorieten"
- 5× `outline:none` → visible focus (WCAG-AA)
- AI password TTL 12u → 2u + Logout-knop
- Foto-thumb onerror + aria-label

## v3.0.33 — 2026-05-09
- **Bug fix**: varianten-merge na save (frontend stuurde geen varianten bij 1-variant items, Worker behield oude → wijzigingen kwamen niet door)
- Foto thumb-knoppen ← 🎨 → groter

## v3.0.32 — 2026-05-09
- Variant ↑↓ knoppen om varianten te herorderen

## v3.0.31 — 2026-05-09
- Tweak-modal opende automatisch (CSS specificity bug)
- Verhaal-foto graceful fallback op homepage

## v3.0.30 — 2026-05-09
- Admin foto-editor: dataURL preview na upload (geen wit vak meer)
- ← → pijltjes om foto-volgorde aan te passen
- 🎨 Foto-tweak modal: helderheid + contrast sliders, upload als nieuwe foto

## v3.0.29 — 2026-05-09 — Variant editor
- Worker `/upload-photo` endpoint
- `/smart-edit`: ALLE bestaande paden moeten in resultaat (auto-recover bij verlies)
- Admin variant-editor: foto's per kleur-variant beheren, x-knop, +-knop, variant toevoegen/verwijderen
- Form leest varianten uit editor bij Bewaren

## v3.0.28 — 2026-05-09 — Smart-edit
- Nieuw `/smart-edit` Worker endpoint: AI past gerichte wijziging toe in NL
- Foto-paden gegarandeerd intact (validatie tegen origineel)
- Onveranderlijke velden id + datumToegevoegd worden teruggezet
- Admin tekstvak in edit-bar voor smart-edit

## v3.0.27 — 2026-05-09
- Admin laadt altijd vers items.json (niet stale localStorage)
- Product: kleurGekozen-tracking met shake-hint bij bestel zonder kleurkeuze
- Hint verdwijnt zodra kleur geklikt

## v3.0.26 — 2026-05-09
- **Alle variant-fotos direct zichtbaar** op productpagina (was: alleen variant 0)
- Kleur-knop = bestel-keuze (springt naar foto, thumbs blijven compleet)
- Varianten-label: "Kies je kleur" ipv "Kleur:"
- Admin thumbnail valt terug op `varianten[0].fotos[0]`

## v3.0.25 — 2026-05-09
- Nav: ⋯ dropdown voor "Eerder gemaakt"
- Galerij: `<select>` sort-dropdown ipv 3-knop balk

## v3.0.24 — 2026-05-09
- Admin auto-publish via Worker (`/update-item`, `/delete-item`)
- "Bewaren" pusht direct naar GitHub, geen export-stap meer

## v3.0.23 — 2026-05-09
- Voorraad-tracking weggehaald (Pleun maakt op bestelling)
- 30 items met kapotte foto-paden gerepareerd via slug-matching
- "Eerder gemaakt" tab vervangen door footer-link + galerij CTA

## v3.0.22 — 2026-05-09 — Bulk import
- 55 items + 109 fotos in één keer toegevoegd via bulk-wizard

---

## Eerdere milestones

- **v3.0.14** — Varianten-support + bulk-import wizard
- **v1.0.0** — Initial launch — Crochet by Pleun (oude naam)
