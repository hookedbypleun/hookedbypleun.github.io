# 🛠️ Tools voor Crochet by Pleun

## `import-whatsapp-export.py` — Kanaal-import

**Doel:** transformeer een WhatsApp chat-export ZIP in een kant-en-klare items.json + foto's.

### Stap 1 — Export op de telefoon

Op Pleun's telefoon (Android of iOS):

1. Open WhatsApp → ga naar het kanaal **🎀Haak-shop🎀**
2. Tap op de **kanaal-naam** bovenin (header)
3. Scroll helemaal naar onderen
4. Tap **"Chat exporteren"** (Android) of **"Exporteer chat"** (iOS)
5. Kies **"Met media"** ✨ (cruciaal — anders krijg je geen foto's!)
6. Deel naar e-mail / Drive / WhatsApp — stuur naar Dave

> **iOS tip:** als de kanaal-info-pagina geen "Exporteer chat" heeft, probeer in de chat-weergave drie puntjes → "Meer" → "Exporteer chat".

> **Werkt het niet voor kanalen?** Sommige WhatsApp-versies beperken export voor abonnees. Pleun is **eigenaar** van het kanaal — als eigenaar zou de optie er moeten zijn. Anders: open kanaal als gewone chat, tap op contact, exporteer.

### Stap 2 — Run het script

```powershell
cd C:\Users\Dave\projects\crochet-by-pleun
python tools\import-whatsapp-export.py "C:\Users\Dave\Downloads\WhatsApp Chat - Haak-shop.zip"
```

### Wat gebeurt er

1. ZIP wordt uitgepakt naar tijdelijke map
2. `_chat.txt` wordt geparseerd op berichten met patroon `Nieuw! [naam] voor €[prijs]`
3. Foto's worden gematcht aan berichten via timestamp
4. Items worden toegevoegd aan `data/items.json`:
   - **Nieuwe items** worden toegevoegd
   - **Bestaande items** (op basis van ID) worden bijgewerkt — handmatige velden blijven behouden (`eigenPatroon`, `uitgelicht`, `prijsOud`, etc.)
5. Foto's worden gekopieerd naar `img/items/` met nette naam: `categorie-itemnaam.jpg`
6. Voor je eigen rust: backup van oude `items.json` naar `data/items.backup-YYYYMMDD-HHMMSS.json`

### Output voorbeeld

```
📦 ZIP uitpakken naar C:\Users\Dave\Downloads\Haak-shop_extracted...
📄 Chat-bestand: ...\_chat.txt
💬 47 berichten gevonden
🧶 23 mogelijke items gedetecteerd
💾 Backup oude items.json: ...\items.backup-20260508-143022.json

✅ Klaar!
   📦 8 nieuwe items toegevoegd
   🔄 15 bestaande items bijgewerkt
   📸 23 foto's gekopieerd naar img/items/
   📄 items.json bijgewerkt (totaal 23 items)
```

### Stap 3 — Verfijnen

Open `admin/index.html` om handmatig:
- Beschrijvingen mooier te maken (script gebruikt eerste 300 chars van WhatsApp-bericht)
- Kleuren toe te voegen
- Eigen-ontwerp-vinkje aan te zetten voor het juiste item
- Items op uitverkocht te zetten (als script het gemist heeft)

### Stap 4 — Push naar GitHub

```powershell
git add data/items.json img/items/
git commit -m "Catalogus geïmporteerd uit WhatsApp-export"
git push
```

Site is binnen 1 minuut bijgewerkt.

---

## ⚠️ Geen Python op je laptop?

Check via:
```powershell
python --version
```

Geen Python? Installeer via Microsoft Store ("Python 3.12") of https://python.org/downloads/. Geen extra packages nodig — script gebruikt alleen standard library.
