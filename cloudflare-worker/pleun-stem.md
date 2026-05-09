# Pleun's Stem — Stijlgids voor AI

> Dit bestand staat los van de Worker. Wanneer Pleuns interview-antwoorden binnen zijn, vatten we hier haar stem samen en kopiëren we de inhoud naar de `PLEUN_VOICE` constante in `worker.js`. Het is dus een werkdocument — geen runtime-bestand.

## Status

- [x] Basis-stem in Worker (placeholder, generiek tienertaal)
- [ ] Interview-antwoorden verwerkt (~115 vragen, zie `interview.html` op de site)
- [ ] Stem geverifieerd door Pleun (laat haar 3 voorbeeldteksten lezen — kloppen ze?)

## Hoe vullen we dit?

Wanneer Pleun haar interview-antwoorden via WhatsApp stuurt:

1. Plak de antwoorden in een nieuw gesprek met Claude
2. Vraag: "Vat dit samen tot een stijlgids voor AI: hoe schrijft Pleun, welke woorden gebruikt ze, welke emoji's, welke onderwerpen vermijden, etc."
3. Plak het resultaat hieronder onder **# De Stem**
4. Kopieer dat blok naar `PLEUN_VOICE` in `worker.js` (regel ~115)
5. Versie bumpen + Worker opnieuw deployen

## Wat hierin moet komen

Concreet en specifiek — geen abstracte adjectieven:

- **Voorbeelden van zinnen** die zij echt zou typen
- **Woorden die ze veel gebruikt** — slang, eigen uitspraken
- **Emoji-set** — welke gebruikt ze, welke niet
- **Hoofdletter-gebruik** — typt ze bijv. "ZO blij" voor nadruk?
- **Onderwerpen** — waar wordt ze enthousiast van, waar haakt ze op af
- **Don'ts** — woorden of constructies die zij nooit zou schrijven
- **Hoe ze haakt** — feiten over haar proces (lokaal, handgeschreven labeltjes, gebruikt patronen + eigen kleurkeuzes, etc.)

---

## # De Stem

> Dit blok wordt straks ingevuld met de daadwerkelijke stem-richtlijnen, gegenereerd uit haar interview-antwoorden. Tot die tijd gebruikt de Worker de generieke placeholder in `worker.js`.

```
(nog leeg — vullen na interview)
```
