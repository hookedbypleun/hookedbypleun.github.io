#!/usr/bin/env python3
"""
WhatsApp Chat Export Importer voor Crochet by Pleun

Pakt een _chat.txt + bijbehorende foto's uit de WhatsApp chat-export
en genereert automatisch items.json + img/items/ bestanden.

Gebruik:
    python tools/import-whatsapp-export.py <pad-naar-zip-of-map>

Voorbeeld:
    python tools/import-whatsapp-export.py "C:\\Users\\Dave\\Downloads\\Haak-shop chat.zip"

Wat het doet:
1. Pakt ZIP uit (indien ZIP) naar tijdelijke map
2. Parseert _chat.txt op berichten met "Nieuw! [naam] voor [prijs]"
3. Matcht IMG-XXXX.jpg attachments aan berichten
4. Hernoemt foto's naar slug van item-naam
5. Schrijft items naar data/items.json (merge met bestaande items)
6. Kopieert foto's naar img/items/

Veilig: maakt eerst een backup van items.json voordat het schrijft.
"""

import sys, os, re, json, shutil, zipfile, datetime
from pathlib import Path

# ============================================================
# Pad-config
# ============================================================
SCRIPT_DIR  = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
ITEMS_PATH  = PROJECT_DIR / "data" / "items.json"
IMG_DIR     = PROJECT_DIR / "img" / "items"
IMG_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# Categorie-detectie op basis van keywords in naam/beschrijving
# ============================================================
CATEGORY_KEYWORDS = {
    "diertjes":       ["jellyfish", "frog", "kikker", "axolotl", "konijn", "olifant", "kat", "knuffel", "diertje", "beest", "egel", "hond"],
    "scrunchies":     ["scrunchie", "scrunchy", "scrunchies"],
    "blobs":          ["blob", "squishy", "stress-bal", "stressbal"],
    "sleutelhangers": ["sleutelhanger", "keychain", "garen sleutelhanger", "mini blob"],
    "mutsen":         ["muts", "hoed", "bucket", "beanie"],
    "onderzetters":   ["onderzetter", "granny square", "coaster"],
    "tassen":         ["tas", "clutch", "schoudertas", "bag"],
    "haakpakketten":  ["haakpakket", "diy", "patroon"]
}

def detect_category(naam):
    nl = naam.lower()
    for cat, kws in CATEGORY_KEYWORDS.items():
        for kw in kws:
            if kw in nl:
                return cat
    return "diertjes"  # default

def slugify(s):
    s = s.lower()
    s = re.sub(r'[àáâãäå]', 'a', s)
    s = re.sub(r'[èéêë]', 'e', s)
    s = re.sub(r'[ìíîï]', 'i', s)
    s = re.sub(r'[òóôõö]', 'o', s)
    s = re.sub(r'[ùúûü]', 'u', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = re.sub(r'^-+|-+$', '', s)
    return s or "item"

# ============================================================
# WhatsApp _chat.txt parser
# ============================================================
# Voorbeeld-regel: "[09-04-2026, 15:23:44] Pleun: Nieuw! Deze muts voor 13,00."
# Of:              "09-04-2026, 15:23 - Pleun: Nieuw!..."
# Attachment-regel: "[09-04-2026, 15:23:44] Pleun: <bijgevoegd: IMG-20260409-WA0001.jpg>"
# Of (NL android):  "(bestand bijgevoegd) IMG-20260409-WA0001.jpg"

LINE_RE_IOS    = re.compile(r'^\[(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})[, ]+(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)$')
LINE_RE_ANDROID = re.compile(r'^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})[, ]+(\d{1,2}:\d{2})\s*[-–]\s*([^:]+):\s*(.*)$')
ATTACH_RE      = re.compile(r'(?:<bijgevoegd|<attached|bestand bijgevoegd)[^>]*?:?\s*([A-Z0-9_\-\.]+\.(?:jpe?g|png|heic|webp))', re.IGNORECASE)
PRICE_RE       = re.compile(r'(?:voor\s+|€\s*|EUR\s*)(\d+[.,]\d{2}|\d+)', re.IGNORECASE)
NEW_PREFIX_RE  = re.compile(r'^Nieuw!\s+(?:Deze[n]?|Dit|De)\s+(.+?)(?:\s+voor\s+|\s*€|$)', re.IGNORECASE)

def parse_chat(chat_path):
    posts = []
    current_post = None
    with open(chat_path, "r", encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.strip().lstrip('‎﻿')
            m = LINE_RE_IOS.match(line) or LINE_RE_ANDROID.match(line)
            if m:
                date, time, sender, msg = m.groups()
                if current_post:
                    posts.append(current_post)
                current_post = {
                    "date": parse_date(date),
                    "time": time,
                    "sender": sender.strip(),
                    "text": msg.strip(),
                    "attachments": []
                }
                # Check voor inline attachment
                a = ATTACH_RE.search(msg)
                if a:
                    current_post["attachments"].append(a.group(1))
            elif current_post:
                # Vervolgregel van vorig bericht
                a = ATTACH_RE.search(line)
                if a:
                    current_post["attachments"].append(a.group(1))
                else:
                    current_post["text"] += "\n" + line
    if current_post:
        posts.append(current_post)
    return posts

def parse_date(s):
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y", "%m-%d-%Y", "%m/%d/%Y"):
        try: return datetime.datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError: continue
    return s

# ============================================================
# Item-extractie uit posts
# ============================================================
def extract_items(posts, source_dir):
    items = []
    seen_ids = set()
    for p in posts:
        text = p["text"]
        if not text:
            continue
        # Detecteer "Nieuw! ... voor €X" patroon
        nm = NEW_PREFIX_RE.search(text)
        pm = PRICE_RE.search(text)
        if not nm:
            continue

        naam_raw = nm.group(1).strip().rstrip(".,!?")
        naam = naam_raw[0].upper() + naam_raw[1:]  # capitalize first letter
        prijs = float(pm.group(1).replace(",", ".")) if pm else 0.0

        # Genereer ID + categorie
        cat = detect_category(naam)
        base_id = f"{cat}-{slugify(naam)}"
        item_id = base_id
        n = 2
        while item_id in seen_ids:
            item_id = f"{base_id}-{n}"; n += 1
        seen_ids.add(item_id)

        # Vind bijbehorende foto (in attachments van DEZE post, anders dichtstbijzijnde eerdere)
        foto_src = None
        for att in p["attachments"]:
            cand = source_dir / att
            if cand.exists():
                foto_src = cand
                break

        items.append({
            "id": item_id,
            "naam": naam,
            "categorie": cat,
            "prijs": prijs,
            "beschrijving": text[:200],
            "foto_src": foto_src,
            "datumToegevoegd": p["date"],
            "status": "beschikbaar",
            "voorraad": 1,
            "raw_text": text
        })

    # Detecteer uitverkocht-meldingen
    for p in posts:
        if "uitverkocht" in p["text"].lower():
            for it in items:
                # Zoek welk item genoemd wordt
                low = p["text"].lower()
                if it["naam"].lower().split()[0] in low:
                    it["status"] = "uitverkocht"
                    it["voorraad"] = 0

    return items

# ============================================================
# Hoofdroutine
# ============================================================
def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    if not src.exists():
        print(f"❌ Pad niet gevonden: {src}")
        sys.exit(1)

    # ZIP uitpakken indien nodig
    if src.is_file() and src.suffix.lower() == ".zip":
        extract_dir = src.parent / (src.stem + "_extracted")
        print(f"📦 ZIP uitpakken naar {extract_dir}...")
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(src) as zf:
            zf.extractall(extract_dir)
        source_dir = extract_dir
    else:
        source_dir = src

    chat_path = next(source_dir.rglob("_chat.txt"), None) or next(source_dir.rglob("*chat*.txt"), None)
    if not chat_path:
        print(f"❌ Geen _chat.txt gevonden in {source_dir}")
        sys.exit(1)
    print(f"📄 Chat-bestand: {chat_path}")

    # Update source_dir naar map met chat.txt (foto's staan ernaast)
    source_dir = chat_path.parent

    posts = parse_chat(chat_path)
    print(f"💬 {len(posts)} berichten gevonden")

    items = extract_items(posts, source_dir)
    print(f"🧶 {len(items)} mogelijke items gedetecteerd")

    # Bestaande catalogus laden
    if ITEMS_PATH.exists():
        backup = ITEMS_PATH.with_suffix(".backup-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + ".json")
        shutil.copy(ITEMS_PATH, backup)
        print(f"💾 Backup oude items.json: {backup}")
        with open(ITEMS_PATH, "r", encoding="utf-8") as f:
            existing = json.load(f)
    else:
        existing = {"categories": [], "items": []}

    by_id = {i["id"]: i for i in existing.get("items", [])}

    # Foto's kopiëren + items mergen
    new_count = 0
    update_count = 0
    photo_count = 0
    for it in items:
        ext = it["foto_src"].suffix.lower() if it["foto_src"] else ".jpg"
        target_filename = f"{it['id']}{ext}"
        target_path = IMG_DIR / target_filename
        if it["foto_src"] and not target_path.exists():
            shutil.copy(it["foto_src"], target_path)
            photo_count += 1
        elif not it["foto_src"]:
            # Geen foto gevonden; behoud oude indien aanwezig
            target_filename = by_id.get(it["id"], {}).get("foto", "").split("/")[-1] or f"{it['id']}.jpg"

        item_obj = {
            "id": it["id"],
            "naam": it["naam"],
            "categorie": it["categorie"],
            "prijs": it["prijs"],
            "beschrijving": it["beschrijving"][:300],
            "foto": f"img/items/{target_filename}",
            "status": it["status"],
            "voorraad": it["voorraad"],
            "datumToegevoegd": it["datumToegevoegd"]
        }

        if it["id"] in by_id:
            # Behoud handmatige velden zoals 'eigenPatroon', 'uitgelicht'
            for keep in ("eigenPatroon", "uitgelicht", "afgeprijsd", "prijsOud", "naam_en"):
                if keep in by_id[it["id"]]:
                    item_obj[keep] = by_id[it["id"]][keep]
            by_id[it["id"]] = item_obj
            update_count += 1
        else:
            by_id[it["id"]] = item_obj
            new_count += 1

    output = {
        "categories": existing.get("categories", []),
        "items": list(by_id.values())
    }

    with open(ITEMS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print()
    print(f"✅ Klaar!")
    print(f"   📦 {new_count} nieuwe items toegevoegd")
    print(f"   🔄 {update_count} bestaande items bijgewerkt")
    print(f"   📸 {photo_count} foto's gekopieerd naar img/items/")
    print(f"   📄 items.json bijgewerkt (totaal {len(by_id)} items)")
    print()
    print(f"💡 Volgende stap: open admin/index.html om handmatig items te verfijnen")
    print(f"   (beschrijving aanpassen, kleuren toevoegen, eigen ontwerp markeren, etc.)")

if __name__ == "__main__":
    main()
