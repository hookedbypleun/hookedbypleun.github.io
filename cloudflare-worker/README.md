# Crochet by Pleun — Cloudflare Worker

Mini-backend voor de site. Doet 4 dingen:

1. **Gemini AI (vision)** maakt op basis van de foto + Pleuns input twee outputs tegelijk: een website-artikel én een WhatsApp-kanaal post.
2. **AI-refinement loop**: Pleun kan in eigen woorden zeggen wat anders moet (`/refine` endpoint), AI maakt nieuwe versie tot ze tevreden is.
3. **GitHub commit**: foto naar `img/items/` + `data/items.json` bijgewerkt.
4. **WhatsApp redirect**: `/order` endpoint zodat Pleun's nummer nooit in de browser komt — klant klikt → worker stuurt door → WhatsApp opent met haar nummer en het bericht.

Alles gratis: Cloudflare Workers free tier + GitHub free + **Gemini 2.5 Flash gratis** (1.500 calls/dag, ruim genoeg).

## Setup (eenmalig)

### 0. Google AI Studio API key (gratis!)
1. Ga naar https://aistudio.google.com/apikey
2. Klik **Create API key** → maak een nieuw project aan of kies een bestaand → **kopieer** de key (begint met `AIza...`)
3. Geen creditcard, geen tegoed nodig — gratis tot 1.500 calls per dag

> 💡 Pleun's shop heeft hooguit een paar items per week. Free tier is letterlijk 100× overcapaciteit.

### 1. Cloudflare account
Ga naar https://dash.cloudflare.com/sign-up — gratis, geen creditcard nodig voor de free tier.

### 2. Worker aanmaken (via dashboard, makkelijkst)

1. Dashboard → **Workers & Pages** → **Create** → **Create Worker**
2. Naam: `crochet-by-pleun` → **Deploy**
3. Klik **Edit code** → vervang alles met inhoud van `worker.js` → **Save & Deploy**

### 3. Secrets instellen

In de Worker → **Settings** → **Variables and Secrets** → **Add**:

| Naam | Type | Waarde |
|------|------|--------|
| `ADMIN_PASSWORD` | Secret | Zelfgekozen wachtwoord voor admin |
| `GEMINI_API_KEY` | Secret | `AIza...` uit stap 0 |
| `GITHUB_TOKEN` | Secret | GitHub PAT (zie stap 4) |
| `WHATSAPP_NUMBER` | Secret | Pleun's nummer, bv. `31635621715` (zonder + of spaties) |

### 4. GitHub Personal Access Token aanmaken

1. https://github.com/settings/personal-access-tokens/new
2. **Token name**: `crochet-by-pleun-worker`
3. **Resource owner**: `crochetbypleun`
4. **Repository access**: Only select repositories → `crochetbypleun.github.io`
5. **Permissions** → Repository permissions → **Contents**: Read and write
6. **Generate token** → kopieer (begint met `github_pat_...`) → plak in Cloudflare als `GITHUB_TOKEN`

### 5. Worker URL noteren

In het dashboard zie je: `https://crochet-by-pleun.<jouw-subdomein>.workers.dev`

Plaats deze URL in `js/config.js` als `workerUrl`.

## Endpoints

- `GET /order?text=...` — **publiek** — 302 redirect naar `wa.me/<WHATSAPP_NUMBER>?text=...`
- `POST /auth` — `{ password }` → check ww
- `POST /generate` — `{ photoBase64, mediaType, naam, prijs, categorieHint, urenWerk?, kleurenHint?, voorWie?, bijzonders?, vrijeTekst? }` → `{ website: {...}, social: {...} }`
- `POST /refine` — `{ type: 'website'|'social', currentOutput, userComments, originalInput?, photoBase64?, mediaType? }` → herziene versie van die ene output
- `POST /publish` — `{ item, photoBase64, photoFilename }` → commit naar GitHub

`/order` is publiek (geen auth). Alle andere calls vereisen `Authorization: Bearer <ADMIN_PASSWORD>`.

## Na deployment: nummer uit config.js halen

Zodra de Worker draait én `workerUrl` in `js/config.js` staat én `/order` werkt:

1. Test eerst: open de site, klik een "Bestel"-knop, controleer dat WhatsApp opent met Pleun's nummer.
2. Pas dan: zet `whatsappNumber: ""` in `js/config.js` zodat het nummer ook nergens meer in client code staat.

Tot dat moment werkt de site nog (fallback naar directe `wa.me/<nummer>`).

## Lokaal testen (optioneel)

```sh
npm install -g wrangler
wrangler login
wrangler dev
```
