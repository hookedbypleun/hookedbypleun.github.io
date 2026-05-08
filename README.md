# 🧶 Crochet by Pleun

> *Made small. Made with love.*

Handgehaakte items van Pleun (12) — webshop op GitHub Pages, gratis hosting, bestelling via WhatsApp.

## 🚀 Snelstart (live krijgen)

### 1. GitHub Organization aanmaken (eenmalig, ~2 min)
- Ga naar https://github.com/account/organizations/new
- Kies plan **Free**
- Organization name: `crochetbypleun`
- Contact email: jouw e-mail
- Belongs to: My personal account
- → Klik "Create organization"

### 2. Repo aanmaken in de organization
- https://github.com/organizations/crochetbypleun/repositories/new
- Repository name: **`crochetbypleun.github.io`** (exact deze naam = automatische root-URL)
- Public, geen README/gitignore (we hebben er al)
- → Create repository

### 3. Code pushen vanuit deze map
```powershell
cd C:\Users\Dave\projects\crochet-by-pleun
git init
git add .
git commit -m "Eerste versie Crochet by Pleun"
git branch -M main
git remote add origin https://github.com/crochetbypleun/crochetbypleun.github.io.git
git push -u origin main
```

### 4. Pages aanzetten
- Repo → Settings → Pages
- Source: **GitHub Actions** (de workflow staat al klaar in `.github/workflows/pages.yml`)
- Eerste deploy duurt ~1 minuut. Daarna: **https://crochetbypleun.github.io**

## 📁 Structuur

```
crochet-by-pleun/
├── index.html         Home: hero, uitgelichte items, nieuw
├── galerij.html       Alle items met categorie-filter
├── product.html       Single item (?id=xxx)
├── over.html          Over Pleun + privacy-statement
├── bestellen.html     Bestelproces + verzending uitleg
├── admin/             Lokaal admin paneel (item-CRUD)
├── data/items.json    De catalogus (bron van waarheid)
├── img/items/         Productfoto's
├── css/style.css      Designsysteem
├── js/
│   ├── config.js      Telefoonnummer, dorpen, verzendkosten
│   ├── app.js         Item-rendering
│   ├── cart.js        Verzameldoos (localStorage)
│   └── postcode.js    Pleun Express check
└── .github/workflows/pages.yml  Auto-deploy
```

## ✏️ Items toevoegen / wijzigen

**Lokaal via admin paneel** (makkelijkst voor Pleun):
1. Open `admin/index.html` in je browser (dubbelklik bestand)
2. Voeg nieuw item toe of klik ✏️ bij bestaand item
3. Klik "Bewaren" — wijzigingen blijven in je browser
4. Klik "Genereer + kopieer naar klembord"
5. Open `data/items.json` en plak (vervang hele inhoud)
6. Commit + push:
   ```powershell
   git add data/items.json
   git commit -m "Nieuwe items"
   git push
   ```
7. Site is binnen 1 minuut bijgewerkt

**Of direct in `data/items.json` editen** als je vertrouwd bent met JSON.

## 🔧 Configuratie

Alle instelbare dingen staan in `js/config.js`:
- WhatsApp-nummer voor bestellingen
- Lokale postcodes (Pleun Express)
- Verzendkosten + bundel-grens

Wijzig daar 1 regel → verandert overal op de site.

## 🛡️ Privacy

- Pleun's nummer staat nu in `js/config.js`. Dit is publiek zichtbaar zodra de site live is — dat is per ontwerp (klanten moeten kunnen bestellen).
- Bij groei: vervang door ouder-nummer of email-formulier (Web3Forms / Formspree).
- Geen tracking, geen cookies, geen analytics.

## 📦 Verzending

| Doelgroep | Hoe | Kosten |
|---|---|---|
| Biezenmortel · Udenhout · Helvoirt | Pleun Express, zaterdag | **Gratis** |
| Rest NL, 1 item | Brievenbuspakje PostNL | €4,75 |
| Rest NL, 2+ items | Brievenbuspakje PostNL | **Gratis** |

## 🌍 Toekomst (klaar voor scale)

| Fase | Wat |
|---|---|
| 1 (nu) | GitHub Pages + WhatsApp + lokaal NL |
| 2 | Eigen domein `crochetbypleun.com` (~€8/jaar via Cloudflare) |
| 3 | Pinterest + Instagram + TikTok handles activeren |
| 4 | Etsy-store voor internationaal |
| 5 | Haakpakketten als PDF-download (95% marge) |

## 🔌 Tools (opt-in voor later)

- **Pinterest API** — auto-pin nieuwe items (in `js/marketing.js` later)
- **Instagram Graph API** — auto-post (Meta business account vereist)
- **Mollie Payment Links** — als WhatsApp-Tikkie te omslachtig wordt
- **Web3Forms** — email-formulier als alternatief voor WhatsApp

## 📋 Roadmap

- [x] Site-architectuur + designsysteem
- [x] Items.json met echte catalogus uit Haak-shop kanaal
- [x] WhatsApp bestel-flow (single + verzameldoos)
- [x] Pleun Express postcode-check
- [x] Admin paneel
- [x] GitHub Pages auto-deploy workflow
- [ ] **Eerste push naar GitHub** (jij doet dit eenmalig)
- [ ] Vervang screenshot-foto's door schone productfoto's
- [ ] Social handles reserveren `@crochetbypleun` op IG/TikTok/Pinterest
- [ ] Pinterest Pin-templates per item
- [ ] Email-formulier als 2e bestelkanaal

---

🧶 Gebouwd voor Pleun · 💝 met liefde door Dave + Claude
