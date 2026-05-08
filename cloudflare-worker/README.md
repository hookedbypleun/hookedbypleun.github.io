# Crochet by Pleun — Cloudflare Worker

Mini-backend voor de admin-pagina. Doet 2 dingen:

1. **Claude AI** vraagt om een vrolijke beschrijving + categorie + alt-text op basis van de foto.
2. **GitHub commit**: foto naar `img/items/` + `data/items.json` bijgewerkt.

Alles gratis (Cloudflare Workers free tier + GitHub free) behalve Claude API verbruik (~€0,003 per item).

## Setup (eenmalig)

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
| `CLAUDE_API_KEY` | Secret | `sk-ant-...` van https://console.anthropic.com |
| `GITHUB_TOKEN` | Secret | GitHub PAT (zie hieronder) |

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

- `POST /auth` — `{ password }` → check ww
- `POST /generate` — `{ photoBase64, naam, prijs, categorieHint }` → AI-content
- `POST /publish` — `{ item, photoBase64, photoFilename }` → commit naar GitHub

Alle calls vereisen `Authorization: Bearer <ADMIN_PASSWORD>`.

## Lokaal testen (optioneel)

```sh
npm install -g wrangler
wrangler login
wrangler dev
```
