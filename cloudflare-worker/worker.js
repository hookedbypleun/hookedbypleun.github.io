// Crochet by Pleun — Cloudflare Worker (Gemini-versie)
// Handelt af:
//   - AI-content genereren met Gemini 2.5 Flash (vision + dual output)
//   - AI-refinement loop op basis van Pleun's commentaar
//   - Publiceren naar GitHub (foto + items.json)
//   - WhatsApp redirect zodat Pleun's nummer nooit in de browser komt
//
// Secrets (instellen in Cloudflare dashboard → Settings → Variables):
//   ADMIN_PASSWORD     — wachtwoord voor de admin-pagina
//   GEMINI_API_KEY     — Google AI Studio API key (begint met "AIza...")
//   GITHUB_TOKEN       — GitHub PAT met "Contents: write" op crochetbypleun/crochetbypleun.github.io
//   WHATSAPP_NUMBER    — Pleun's WhatsApp-nummer (bv. 31635621715, zonder + of spaties)
//
// Endpoints:
//   GET  /order      — ?text=...                                    → 302 naar wa.me/[secret]?text=... (publiek)
//   POST /auth       — { password }                                 → check ww
//   POST /generate   — { photoBase64, mediaType, naam, prijs, ... } → { website: {...}, social: {...} }
//   POST /refine     — { type, currentOutput, userComments, ... }   → herziene versie van die specifieke output
//   POST /publish    — { item, photoBase64, photoFilename }         → commit naar GitHub

const REPO = 'crochetbypleun/crochetbypleun.github.io';
const ALLOWED_ORIGINS = [
  'https://crochetbypleun.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];
const GEMINI_MODEL = 'gemini-2.5-flash';

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    try {
      // === /order — publieke redirect naar WhatsApp (GEEN auth) ===
      if (url.pathname === '/order' && request.method === 'GET') {
        if (!env.WHATSAPP_NUMBER) {
          return new Response('WhatsApp number not configured', { status: 500, headers: cors });
        }
        const text = url.searchParams.get('text') || '';
        const target = `https://wa.me/${env.WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
        return new Response(null, { status: 302, headers: { ...cors, 'Location': target } });
      }

      // === Auth check (alle overige endpoints) ===
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace(/^Bearer\s+/i, '');
      if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD) {
        if (url.pathname === '/auth') {
          const body = await request.json().catch(() => ({}));
          if (body.password === env.ADMIN_PASSWORD) {
            return jsonResponse({ ok: true }, 200, cors);
          }
        }
        return jsonResponse({ error: 'unauthorized' }, 401, cors);
      }

      if (url.pathname === '/generate' && request.method === 'POST') {
        const body = await request.json();
        const result = await generateWithGemini(body, env);
        return jsonResponse(result, 200, cors);
      }

      if (url.pathname === '/refine' && request.method === 'POST') {
        const body = await request.json();
        const result = await refineWithGemini(body, env);
        return jsonResponse(result, 200, cors);
      }

      if (url.pathname === '/publish' && request.method === 'POST') {
        const body = await request.json();
        const result = await publishToGitHub(body, env);
        return jsonResponse(result, 200, cors);
      }

      if (url.pathname === '/auth') {
        return jsonResponse({ ok: true }, 200, cors);
      }

      return jsonResponse({ error: 'not_found' }, 404, cors);
    } catch (err) {
      return jsonResponse({ error: 'server_error', detail: String(err) }, 500, cors);
    }
  },
};

// ================================================================
// Pleun's stem — systeem-context voor Gemini
// Wordt uitgebreid zodra interview-antwoorden binnen zijn (pleun-stem.md)
// ================================================================
const PLEUN_VOICE = `Je bent Pleun, 12 jaar, uit Brabant. Je hebt 3 katten, doet aan top-turnen (droom = wereldkampioen), en haakt elke dag 2-3 uur kleine schattige dingetjes — diertjes, scrunchies, blobs, mutsen, sleutelhangers. Je shop heet "Hooked by Pleun" (de oude naam was "crochet by Pleun" en die mag je nog steeds als ondertitel gebruiken).

HOE HET BEGON:
Een vriendin leerde je de basisstekken. Daarna ben je YouTube-filmpjes gaan kijken en patronen gaan volgen. Voor de meeste items volg je een patroon van internet, maar de kleuren, garen en kleine accenten kies je zelf.

JOUW STEM:
- Eerste persoon, vrolijk, eerlijk, soms een beetje gek
- Vrienden zeggen dat je grappig en lief bent, soms een beetje gek
- Hoofdletters voor nadruk ("ZO leuk", "ZO blij", "ZO mooi")
- Soms verlengde klinkers voor enthousiasme ("beautifuuul", "leuukk")
- Eigen uitdrukkingen die je hier en daar gebruikt:
  * "Hoiii!" als begroeting
  * "ZO [bijvoeglijk]" om iets te benadrukken
  * "wauwie wauwie!" bij positieve verbazing
  * "pappoi" (minion-stijl) voor super-zacht/fluffy — sparzaam!
  * "omg slayyyy" voor heel cool — ALLEEN in WhatsApp-kanaal-posts, niet op de site
- Zinnen mogen natuurlijk lopen, niet formeel

EMOJI-SET (max 1-3 per zin, niet TE veel):
🧶 🎀 💝 🌸 ✨ 😂 ❤️ ⭐ 🐱 🐘 ✋ 🥹 ☀️

ONDERWERPEN DIE TYPISCH PLEUN ZIJN:
- Haar 3 katten (kat = haar lievelingsdier en haar shop-symbool)
- Zachte garen, vooral chenille
- Lichte kleurtjes — lichtroze + wit, koraal + beige, ook lichtblauw
- Handgeschreven labeltje met handtekening en datum bij elk item
- Lokaal in Brabant (Biezenmortel/Udenhout/Helvoirt) gratis op zaterdag
- Het allerliefst maakt ze: kleine beestjes, cadeautjes voor familie/vrienden
- Trots op: olifant-knuffel + muts
- Werkt aan bureau, in bed, of op de bank tijdens films

CONTEXT-AANPASSING:
- Productbeschrijvingen op de SITE: ingetogen, leesbaar, 1-2 emoji per zin, helder zodat klanten weten wat ze kopen. Hoofdletters/uitspraken sparzaam.
- Posts voor WhatsApp-KANAAL: speelser, meer hooks, meer emoji, mag "omg slayyy" of "wauwie wauwie!" gebruiken, opent vaak met "Hoiii allemaal! 🎀"

VOORBEELDEN:
Site (productbeschrijving): "Klein gehaakt katje in zacht lichtroze chenille 🐱 ZO knuffelig — past in je hand."
Social (WhatsApp post): "Hoiii allemaal! 🎀 Net klaar — een ZO schattig katje in lichtroze chenille 🐱✨ Heb 'm net op de site gezet, bekijk 'm even! 💝"

NOOIT:
- Marketingpraat ("kwalitatief hoogwaardig", "uniek-een-van-een", "exclusief")
- Het woord "letterlijk" als invulwoord (zoals influencers — irriteert haar)
- Engelse termen waar een Nederlands woord prima werkt
- Mention van papa/mama, AI, of dat er AI gebruikt is
- Donkergroene kleuren als descriptor
- Generieke openers ("Dit prachtige item is...", "Deze unieke creatie...")
- Claim dat alles 100% origineel is — ze gebruikt patronen, dat is OK
- Hele korte rokjes adviseren (niet relevant maar ze draagt ze niet)`;

const CATEGORIEEN = ['diertjes', 'scrunchies', 'blobs', 'sleutelhangers', 'mutsen', 'onderzetters', 'tassen', 'haakpakketten'];

// ================================================================
// Gemini call helper
// ================================================================
async function callGemini({ prompt, photoBase64, mediaType, env, temperature = 0.85, maxTokens = 1200 }) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY niet ingesteld in Worker secrets');

  const parts = [{ text: prompt }];
  if (photoBase64) {
    const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    parts.push({
      inline_data: {
        mime_type: mediaType || 'image/jpeg',
        data: cleanBase64,
      },
    });
  }

  const body = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: PLEUN_VOICE }] },
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data.candidates?.[0]?.finishReason;
  if (!text) throw new Error('Lege Gemini response: ' + JSON.stringify(data).slice(0, 300));

  try {
    return JSON.parse(text);
  } catch {
    // Probeer 1: regex extract
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    // Probeer 2: response was afgekapt — repareer onafgemaakte JSON
    const repaired = repairTruncatedJson(text);
    if (repaired) {
      try { return JSON.parse(repaired); } catch {}
    }
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('AI-response te lang afgekapt — probeer "kortere" tekst of vraag een nieuwe versie.');
    }
    throw new Error('AI gaf een onleesbaar antwoord. Probeer opnieuw.');
  }
}

// Repareer JSON die midden in een string is afgekapt: sluit string, sluit braces.
function repairTruncatedJson(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let s = text.slice(start);
  let inStr = false, esc = false, depthObj = 0, depthArr = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depthObj++;
    else if (c === '}') depthObj--;
    else if (c === '[') depthArr++;
    else if (c === ']') depthArr--;
  }
  let fixed = s;
  if (inStr) fixed += '"';
  // Verwijder trailing comma's vóór het sluiten
  fixed = fixed.replace(/,\s*$/, '');
  while (depthArr-- > 0) fixed += ']';
  while (depthObj-- > 0) fixed += '}';
  return fixed;
}

// ================================================================
// /generate — dual output: website-artikel + WhatsApp-bericht
// ================================================================
async function generateWithGemini(input, env) {
  const { photoBase64, mediaType, naam, prijs, categorieHint, urenWerk, kleurenHint, voorWie, bijzonders, vrijeTekst, channels } = input;
  // Default: beide kanalen aan
  const wantWebsite = !channels || channels.website !== false;
  const wantSocial = !channels || channels.social !== false;

  const inputBlok = [
    naam ? `- Naam (zoals Pleun het noemt): ${naam}` : '- Naam: nog niet ingevuld, verzin een lieve simpele',
    prijs ? `- Prijs: €${prijs}` : null,
    categorieHint ? `- Categorie hint: ${categorieHint}` : null,
    urenWerk ? `- Hoe lang Pleun erover deed: ${urenWerk}` : null,
    kleurenHint ? `- Kleuren/wol die ze gebruikte: ${kleurenHint}` : null,
    voorWie ? `- Voor wie zou het leuk zijn: ${voorWie}` : null,
    bijzonders ? `- Iets bijzonders: ${bijzonders}` : null,
    vrijeTekst ? `- Pleuns eigen woorden over dit item: "${vrijeTekst}"` : null,
  ].filter(Boolean).join('\n');

  const websiteSchema = `"website": {
    "naam": "korte lieve naam",
    "beschrijving": "max 30 woorden, in eerste persoon, zoals Pleun het zou zeggen, vrolijk en eerlijk",
    "categorie": "een van de categorieën",
    "kleuren": ["kleur1", "kleur2"],
    "altText": "korte beschrijving voor screenreaders, max 12 woorden",
    "extraKaartje": "optioneel klein zinnetje met een leuke detail of weetje, mag leeg zijn"
  }`;
  const socialSchema = `"social": {
    "tekst": "kant-en-klaar bericht voor Pleuns WhatsApp-kanaal — opent met een hook, vertelt over het item, eindigt met een uitnodiging om te bestellen via de site. Gebruik regelafbrekingen en emoji's. 60-100 woorden. Mag aan de prijs refereren als die er is.",
    "hashtags": ["bv #handgehaakt", "max 4 stuks"]
  }`;
  const schemas = [];
  if (wantWebsite) schemas.push(websiteSchema);
  if (wantSocial) schemas.push(socialSchema);

  const taakDesc = wantWebsite && wantSocial
    ? 'twee dingen: een tekst voor op de site én een post voor het WhatsApp-kanaal'
    : wantWebsite
      ? 'een tekst voor op de site (productbeschrijving)'
      : 'een post voor Pleuns WhatsApp-kanaal';

  const prompt = `Bekijk de foto en schrijf in Pleuns stem ${taakDesc} voor dit nieuwe haakwerkje.

Input van Pleun:
${inputBlok}

Beschikbare categorieën: ${CATEGORIEEN.join(', ')}.

Geef ALLEEN een JSON-object terug met deze exacte structuur (geen andere tekst):
{
${schemas.join(',\n  ')}
}`;

  const maxTokens = (wantWebsite && wantSocial) ? 3000 : 1500;
  return await callGemini({ prompt, photoBase64, mediaType, env, maxTokens });
}

// ================================================================
// /refine — herziene versie van EEN output op basis van commentaar
// ================================================================
async function refineWithGemini(input, env) {
  const { type, currentOutput, userComments, originalInput, photoBase64, mediaType } = input;

  if (!['website', 'social'].includes(type)) {
    throw new Error('type moet "website" of "social" zijn');
  }
  const hasComments = userComments && userComments.trim();

  const schemaText = type === 'website'
    ? `{
  "naam": "...",
  "beschrijving": "...",
  "categorie": "een van: ${CATEGORIEEN.join(', ')}",
  "kleuren": ["..."],
  "altText": "...",
  "extraKaartje": "..."
}`
    : `{
  "tekst": "...",
  "hashtags": ["..."]
}`;

  const contextBlok = originalInput ? `\nOorspronkelijke input van Pleun:\n${JSON.stringify(originalInput, null, 2)}\n` : '';

  const taakBlok = hasComments
    ? `Wat Pleun wil veranderen (haar eigen woorden):\n"${userComments.trim()}"\n\nMaak een nieuwe versie die haar feedback verwerkt, in haar stem, met dezelfde structuur.`
    : `Pleun wil een verse alternatieve versie zien — andere woordkeuze, andere invalshoek, dezelfde sfeer en stem. Vermijd dezelfde zinnen.`;

  const prompt = `Pleun wil de ${type === 'website' ? 'productbeschrijving op de site' : 'WhatsApp-kanaal-post'} herzien.

Huidige versie:
${JSON.stringify(currentOutput, null, 2)}
${contextBlok}
${taakBlok}

Geef ALLEEN dit JSON-object terug, niets anders:

${schemaText}`;

  return await callGemini({ prompt, photoBase64, mediaType, env, maxTokens: 2000 });
}

// ================================================================
// GitHub — foto + items.json bijwerken
// ================================================================
async function publishToGitHub({ item, photoBase64, photoFilename }, env) {
  const cleanBase64 = (photoBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  const ghHeaders = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'crochet-by-pleun-worker',
    'Content-Type': 'application/json',
  };

  const photoPath = `img/items/${photoFilename}`;
  const photoUrl = `https://api.github.com/repos/${REPO}/contents/${photoPath}`;

  let photoSha = undefined;
  const photoCheck = await fetch(photoUrl, { headers: ghHeaders });
  if (photoCheck.ok) {
    const existing = await photoCheck.json();
    photoSha = existing.sha;
  }

  const photoUpload = await fetch(photoUrl, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `📦 Add photo for ${item.naam || item.id}`,
      content: cleanBase64,
      ...(photoSha && { sha: photoSha }),
    }),
  });
  if (!photoUpload.ok) {
    throw new Error('Foto upload mislukt: ' + (await photoUpload.text()));
  }

  const itemsUrl = `https://api.github.com/repos/${REPO}/contents/data/items.json`;
  const itemsRes = await fetch(itemsUrl, { headers: ghHeaders });
  if (!itemsRes.ok) throw new Error('items.json ophalen mislukt');
  const itemsData = await itemsRes.json();
  const currentJson = JSON.parse(decodeBase64(itemsData.content));

  item.foto = photoPath;
  item.datumToegevoegd = item.datumToegevoegd || new Date().toISOString().slice(0, 10);
  const existingIdx = currentJson.items.findIndex(i => i.id === item.id);
  if (existingIdx >= 0) currentJson.items[existingIdx] = item;
  else currentJson.items.push(item);

  const newContent = encodeBase64(JSON.stringify(currentJson, null, 2));
  const updateRes = await fetch(itemsUrl, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `✨ ${existingIdx >= 0 ? 'Update' : 'Add'} item: ${item.naam}`,
      content: newContent,
      sha: itemsData.sha,
    }),
  });
  if (!updateRes.ok) {
    throw new Error('items.json update mislukt: ' + (await updateRes.text()));
  }

  return {
    ok: true,
    itemId: item.id,
    photoPath,
    siteUrl: 'https://crochetbypleun.github.io/',
  };
}

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decodeBase64(b64) {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
