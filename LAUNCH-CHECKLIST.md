# 🚀 Launch Checklist — Crochet by Pleun

Doel: **zondag 10 mei 12:00** site live, samen met Pleun's scrunchie-collectie launch.

## Vrijdag 8 mei — Voorbereiding

- [ ] Lokaal testen: open `index.html` in browser, klik door alles
- [ ] Mobiel testen: verbind telefoon met laptop (USB/wifi), open lokale URL
- [ ] WhatsApp-knop testen: tap → opent WhatsApp met voorgevormd bericht
- [ ] Postcode-check testen: 5074 / 5071 / 5268 → "Pleun Express", andere postcode → "verzending"
- [ ] Verzameldoos testen: 2 items toevoegen → checkout → 1 WhatsApp-bericht met alles

## Zaterdag 9 mei — Naar GitHub

- [ ] **Pleun + Dave samen:** site doorlopen, Pleun's correcties verzamelen (foutieve namen, prijzen, kleuren)
- [ ] Correcties verwerken via `admin/index.html` of direct in `data/items.json`
- [ ] **GitHub-organization `crochetbypleun` aanmaken** (zie README stap 1)
- [ ] Repo `crochetbypleun.github.io` aanmaken (zie README stap 2)
- [ ] Eerste push (zie README stap 3)
- [ ] Pages aanzetten + workflow draait → check `https://crochetbypleun.github.io`

## Zondag 10 mei — LAUNCH

- [ ] Voor 12:00: scrunchie-foto's klaarzetten in `img/items/`
- [ ] Items toevoegen via admin paneel (per scrunchie 1 item) → committen → push
- [ ] **12:00:** Pleun post in haar 🎀Haak-shop🎀 kanaal:
  > "🎀 De nieuwe scrunchie-collectie is LIVE! Bekijk ze hier: https://crochetbypleun.github.io 💝"
- [ ] Status-update op Pleun's eigen WhatsApp met directe link
- [ ] Familie-app: link delen naar oma's, tantes, familie
- [ ] Schoolvriendinnen-groep: link delen

## Maandag 11 mei — Eerste analyse

- [ ] Hoeveel klikken? Hoeveel bestellingen?
- [ ] Welke items zijn populair?
- [ ] Wat moet beter (op basis van vragen die binnenkomen)?

## Week erna — Optimalisatie

- [ ] Vervang screenshot-foto's door schone productfoto's (witte achtergrond, natuurlijk licht)
- [ ] Reserveer social handles `@crochetbypleun`:
  - Instagram (jij beheert, Pleun is gezicht)
  - TikTok
  - Pinterest (sterk voor haakwerk)
- [ ] Eerste 5 Pinterest-pins maken met productfoto's
- [ ] Eerste TikTok proces-video (60 sec haken)

## Wanneer succes meetbaar is

| Mijlpaal | Vervolgactie |
|---|---|
| 5 bestellingen via webshop | Tikkie-flow goed ingewerkt? Anders Mollie aanzetten |
| 10 lokale bezorgingen | Pleun Express-route optimaliseren (vaste tijden) |
| 50+ verzendingen | MyParcel-account aanmaken (~€1 goedkoper per pakket) |
| Aanvragen "op maat" | Wachtlijst-systeem in admin paneel toevoegen |
| Eerste internationale interesse | Etsy-store openen |
| €30+ omzet/week | Eigen domein `crochetbypleun.com` kopen (~€8/jaar Cloudflare) |
| €100+ omzet/maand | Mollie aanzetten + Pinterest-API auto-posting |
| 250+ webshop-bezoekers | Haakpatronen als PDF-download verkopen |

## ⚠️ Rode vlag-momenten

- **Pleun raakt overweldigd door bestellingen.** Plan: pauzeer de "Bestel"-knop tijdelijk via `js/config.js` (`whatsappNumber: ""`) → site blijft staan, knop niet aanklikbaar.
- **Een klant vraagt om persoonlijke gegevens (adres) en je twijfelt.** Plan: Pleun vraagt het ALTIJD eerst aan ouders. Bestellingen onder ouder-toezicht.
- **Een klant betaalt niet.** Plan: geen verzending zonder Tikkie-bevestiging. Eenvoudig.
- **Negatieve berichten op kanaal.** Plan: blokkeer en verwijder. Pleun's mentale rust eerst.
