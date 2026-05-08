// Crochet by Pleun — Cloudflare Worker
// Handelt af: AI-beschrijving genereren + publiceren naar GitHub
//
// Secrets (instellen in Cloudflare dashboard → Settings → Variables):
//   ADMIN_PASSWORD   — wachtwoord voor de admin-pagina
//   CLAUDE_API_KEY   — Anthropic API key (sk-ant-...)
//   GITHUB_TOKEN     — GitHub PAT met "Contents: write" op crochetbypleun/crochetbypleun.github.io
//
// Endpoints:
//   POST /generate   — { photoBase64, naam, prijs, categorieHint } → AI-content
//   POST /publish    — { item, photoBase64, photoFilename }        → commit naar GitHub
//   POST /auth       — { password }                                 → check ww

const REPO = 'crochetbypleun/crochetbypleun.github.io';
const ALLOWED_ORIGINS = [
  'https://crochetbypleun.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

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
      // === Auth check (alle endpoints) ===
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace(/^Bearer\s+/i, '');
      if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD) {
        // /auth endpoint geeft duidelijke feedback
        if (url.pathname === '/auth') {
          const body = await request.json().catch(() => ({}));
          if (body.password === env.ADMIN_PASSWORD) {
            return jsonResponse({ ok: true }, 200, cors);
          }
        }
        return jsonResponse({ error: 'unauthorized' }, 401, cors);
      }

      // === /generate ===
      if (url.pathname === '/generate' && request.method === 'POST') {
        const body = await request.json();
        const result = await generateWithClaude(body, env);
        return jsonResponse(result, 200, cors);
      }

      // === /publish ===
      if (url.pathname === '/publish' && request.method === 'POST') {
        const body = await request.json();
        const result = await publishToGitHub(body, env);
        return jsonResponse(result, 200, cors);
      }

      // === /auth (al hierboven afgehandeld als wachtwoord klopte) ===
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
// Claude — beschrijving + categorie + alt-text genereren
// ================================================================
async function generateWithClaude({ photoBase64, mediaType, naam, prijs, categorieHint }, env) {
  const cleanBase64 = (photoBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  const mt = mediaType || 'image/jpeg';

  const prompt = `Je bent Pleun, een 12-jarig meisje uit Brabant dat handgehaakte knuffels, scrunchies, blobs en accessoires maakt. Je schrijft in eerste persoon, vrolijk, eerlijk, soms met een grapje of emoji. Geen marketing-taal, geen "uniek-een-van-een", geen "geen filters". Gewoon zoals een tiener praat.

Kijk naar de foto en schrijf een korte productbeschrijving (max 25 woorden) voor dit item.

${naam ? `Naam (zoals Pleun het noemt): ${naam}` : 'Verzin een leuke, simpele naam.'}
${prijs ? `Prijs: €${prijs}` : ''}
${categorieHint ? `Categorie hint: ${categorieHint}` : ''}

Beschikbare categorieën: diertjes, scrunchies, blobs, sleutelhangers, mutsen, onderzetters, tassen, haakpakketten.

Geef ALLEEN dit JSON-object terug, geen andere tekst:
{
  "naam": "...",
  "beschrijving": "...",
  "categorie": "...",
  "kleuren": ["..."],
  "altText": "..."
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mt, data: cleanBase64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Geen JSON in Claude response: ' + text);

  return JSON.parse(match[0]);
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

  // 1. Upload foto naar img/items/
  const photoPath = `img/items/${photoFilename}`;
  const photoUrl = `https://api.github.com/repos/${REPO}/contents/${photoPath}`;

  // Check of foto al bestaat (sha nodig voor overschrijven)
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

  // 2. Haal huidige items.json op
  const itemsUrl = `https://api.github.com/repos/${REPO}/contents/data/items.json`;
  const itemsRes = await fetch(itemsUrl, { headers: ghHeaders });
  if (!itemsRes.ok) throw new Error('items.json ophalen mislukt');
  const itemsData = await itemsRes.json();
  const currentJson = JSON.parse(decodeBase64(itemsData.content));

  // 3. Voeg item toe (of update bestaand)
  item.foto = photoPath;
  item.datumToegevoegd = item.datumToegevoegd || new Date().toISOString().slice(0, 10);
  const existingIdx = currentJson.items.findIndex(i => i.id === item.id);
  if (existingIdx >= 0) currentJson.items[existingIdx] = item;
  else currentJson.items.push(item);

  // 4. Schrijf items.json terug
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
  // UTF-8 → bytes → base64
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
