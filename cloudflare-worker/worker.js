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
//   GITHUB_TOKEN       — GitHub PAT met "Contents: write" op hookedbypleun/hookedbypleun.github.io
//   WHATSAPP_NUMBER    — Pleun's WhatsApp-nummer (bv. 31635621715, zonder + of spaties)
//
// Endpoints:
//   GET  /order      — ?text=...                                    → 302 naar wa.me/[secret]?text=... (publiek)
//   POST /auth       — { password }                                 → check ww
//   POST /generate   — { photoBase64, mediaType, naam, prijs, ... } → { website: {...}, social: {...} }
//   POST /refine     — { type, currentOutput, userComments, ... }   → herziene versie van die specifieke output
//   POST /publish    — { item, photoBase64, photoFilename }         → commit naar GitHub

const REPO = 'hookedbypleun/hookedbypleun.github.io';
const ALLOWED_ORIGINS = [
  'https://hookedbypleun.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];
const GEMINI_MODEL = 'gemini-2.5-flash';

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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

// Timing-safe string compare — voorkomt timing attacks op auth
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// In-memory rate limit per IP (per isolate; redelijke spam-rem zonder KV)
const _rateBuckets = new Map();
function checkRateLimit(ip, key, limit, windowMs) {
  if (!ip) return true;
  const now = Date.now();
  const bucketKey = `${key}:${ip}`;
  const bucket = _rateBuckets.get(bucketKey) || [];
  const fresh = bucket.filter(t => now - t < windowMs);
  if (fresh.length >= limit) {
    _rateBuckets.set(bucketKey, fresh);
    return false;
  }
  fresh.push(now);
  _rateBuckets.set(bucketKey, fresh);
  // Garbage collect ouder dan 1 uur
  if (_rateBuckets.size > 5000) {
    for (const [k, v] of _rateBuckets) {
      if (!v.length || now - v[v.length - 1] > 3600000) _rateBuckets.delete(k);
    }
  }
  return true;
}

// Magic-byte validatie voor foto's — alleen JPEG, PNG, WebP, GIF
function detectImageMime(base64) {
  const clean = String(base64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (clean.length < 16) return null;
  // Decodeer eerste 16 bytes
  const head = atob(clean.slice(0, 24));
  const b = i => head.charCodeAt(i);
  // JPEG: FF D8 FF
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) return 'image/png';
  // GIF: 47 49 46 38
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return 'image/gif';
  // WebP: RIFF....WEBP
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46
      && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return 'image/webp';
  return null;
}

// ================================================================
// Privacy-first analytics — KV-binding STATS (fallback: in-memory)
// ================================================================
const _memStats = new Map(); // fallback als KV-binding niet bestaat

async function _statsRead(env, key) {
  if (env && env.STATS) {
    const v = await env.STATS.get(key);
    return parseInt(v) || 0;
  }
  return _memStats.get(key) || 0;
}
async function _statsWrite(env, key, val) {
  if (env && env.STATS) {
    await env.STATS.put(key, String(val), { expirationTtl: 60 * 60 * 24 * 400 });
  } else {
    _memStats.set(key, val);
  }
}
async function statsIncrement(env, key, delta = 1) {
  const cur = await _statsRead(env, key);
  await _statsWrite(env, key, cur + delta);
}
async function statsListByPrefix(env, prefix) {
  if (env && env.STATS) {
    const result = [];
    let cursor;
    do {
      const page = await env.STATS.list({ prefix, cursor });
      for (const k of page.keys) {
        const v = await env.STATS.get(k.name);
        result.push([k.name, parseInt(v) || 0]);
      }
      cursor = page.cursor;
      if (page.list_complete) break;
    } while (cursor);
    return result;
  }
  return [...(_memStats.entries())].filter(([k]) => k.startsWith(prefix));
}

// SHA256 hash voor anonieme daily-visitor-id (geen IP opslaan)
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Bewaar laatste 30 dagen aan stats; oudere wordt door TTL automatisch opgeruimd
const STATS_RETENTION_DAYS = 30;

// Track-event verwerking. Eén event mag meerdere counters bumpen.
// In-memory unique-visitor set per isolate (geen KV-PUT per visitor)
const _visitorSet = new Map(); // day → Set<visitorHash>
function _markVisitor(day, hash) {
  let s = _visitorSet.get(day);
  if (!s) { s = new Set(); _visitorSet.set(day, s); }
  if (s.has(hash)) return false;
  s.add(hash);
  return true;
}
// In-memory feed (recent 20) per isolate — geen KV-PUT
const _liveFeed = [];

async function trackEvent({ type, path, productId, kleur, ref, country, device, postcode, postcodeType, visitorId }, env) {
  const day = todayUTC();
  const tasks = [];
  const safe = s => String(s || '').slice(0, 80).replace(/[\r\n\t]/g, ' ').replace(/[:|]/g, '_');

  if (type === 'pageview') {
    tasks.push(statsIncrement(env, `pv:${day}:${safe(path) || '/'}`));
    tasks.push(statsIncrement(env, `total:pv:${day}`));
    // Unique-visitor: gebruik in-memory dedup binnen isolate (gratis)
    // Bij eerste visitor in isolate → schrijf 1 PUT naar total:unique:{day}
    if (visitorId && _markVisitor(day, visitorId)) {
      tasks.push(statsIncrement(env, `total:unique:${day}`));
    }
    // OPGEMERKT: geo/dev/ref counters zijn uitgeschakeld om binnen 1000 PUT/dag
    // budget van Cloudflare KV gratis tier te blijven. Bij upgrade naar D1 of
    // Workers Paid kunnen ze terug aangezet worden.
    // if (country) tasks.push(statsIncrement(env, `geo:${day}:${safe(country)}`));
    // if (device) tasks.push(statsIncrement(env, `dev:${day}:${safe(device)}`));
    // if (ref) tasks.push(statsIncrement(env, `ref:${day}:${safe(ref)}`));
  } else if (type === 'product_view') {
    if (productId) tasks.push(statsIncrement(env, `prod:${day}:${safe(productId)}`));
  } else if (type === 'cart_add') {
    if (productId) {
      const k = kleur ? `${safe(productId)}|${safe(kleur)}` : safe(productId);
      tasks.push(statsIncrement(env, `cart:${day}:${k}`));
      tasks.push(statsIncrement(env, `total:cart:${day}`));
    }
  } else if (type === 'cart_open') {
    tasks.push(statsIncrement(env, `total:cart_open:${day}`));
  } else if (type === 'whatsapp_click') {
    tasks.push(statsIncrement(env, `total:wa:${day}`));
  } else if (type === 'review_submit') {
    tasks.push(statsIncrement(env, `total:review:${day}`));
  } else if (type === 'postcode_check') {
    tasks.push(statsIncrement(env, `pc:${day}:${safe(postcode || '?')}`));
    if (postcodeType) tasks.push(statsIncrement(env, `pc-type:${day}:${safe(postcodeType)}`));
  }
  await Promise.all(tasks);

  // Live event-feed in-memory (per Worker isolate, geen KV-PUT)
  // Beperkt zichtbaar — verschillende admin-requests kunnen andere isolate raken
  // maar gratis tier KV PUT-limit (1000/dag) maakt persistent feed onhaalbaar.
  const evRecord = {
    ts: Date.now(),
    type,
    path: path || null,
    productId: productId || null,
    kleur: kleur || null,
    device: device || null,
    country: country || null,
    ref: ref || null,
    postcode: postcode || null,
  };
  _liveFeed.unshift(evRecord);
  if (_liveFeed.length > 20) _liveFeed.length = 20;
}

// Stats query — geeft alle counters voor laatste N dagen
async function getStatsSummary(env, days = 30) {
  const today = todayUTC();
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Aggregeer per categorie
  const sumByPrefix = async (prefix) => {
    const items = await statsListByPrefix(env, prefix);
    return items.reduce((s, [, v]) => s + v, 0);
  };
  const groupByPrefix = async (prefix) => {
    const items = await statsListByPrefix(env, prefix);
    const groups = {};
    for (const [k, v] of items) {
      // k = "prefix:date:value" — pak waarde-deel
      const parts = k.split(':');
      const value = parts.slice(2).join(':');
      groups[value] = (groups[value] || 0) + v;
    }
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  };

  // Daily series
  const dailySeries = async (totalKeyPrefix) => {
    const items = await statsListByPrefix(env, totalKeyPrefix);
    const byDate = {};
    for (const [k, v] of items) {
      const date = k.replace(totalKeyPrefix, '');
      byDate[date] = v;
    }
    return dates.slice().reverse().map(d => ({ date: d, value: byDate[d] || 0 }));
  };

  const [
    pageviewsTotal, uniquesTotal, cartTotal, cartOpenTotal, waTotal, reviewTotal,
    pageviewsByDay, uniquesByDay, cartByDay, waByDay,
    topPages, topProducts, topCart, topRefs, topGeo, topDevice, topPostcode,
  ] = await Promise.all([
    sumByPrefix('total:pv:'),
    sumByPrefix('total:unique:'),
    sumByPrefix('total:cart:'),
    sumByPrefix('total:cart_open:'),
    sumByPrefix('total:wa:'),
    sumByPrefix('total:review:'),
    dailySeries('total:pv:'),
    dailySeries('total:unique:'),
    dailySeries('total:cart:'),
    dailySeries('total:wa:'),
    groupByPrefix('pv:').then(r => r.slice(0, 10)),
    groupByPrefix('prod:').then(r => r.slice(0, 10)),
    groupByPrefix('cart:').then(r => r.slice(0, 10)),
    groupByPrefix('ref:').then(r => r.slice(0, 10)),
    groupByPrefix('geo:').then(r => r.slice(0, 10)),
    groupByPrefix('dev:').then(r => r.slice(0, 5)),
    groupByPrefix('pc:').then(r => r.slice(0, 10)),
  ]);

  return {
    backed_by: env && env.STATS ? 'kv' : 'memory',
    days,
    totals: {
      pageviews: pageviewsTotal,
      unique_visitors: uniquesTotal,
      cart_adds: cartTotal,
      cart_opens: cartOpenTotal,
      whatsapp_clicks: waTotal,
      reviews: reviewTotal,
    },
    timeseries: { pageviews: pageviewsByDay, unique_visitors: uniquesByDay, cart_adds: cartByDay, whatsapp_clicks: waByDay },
    top: {
      pages: topPages,
      products: topProducts,
      cart_items: topCart,
      referrers: topRefs,
      countries: topGeo,
      devices: topDevice,
      postcodes: topPostcode,
    },
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    const url = new URL(request.url);

    // OPTIONS preflight — /track krijgt open CORS (publiek, anoniem)
    if (request.method === 'OPTIONS') {
      const isTrack = url.pathname === '/track';
      const optCors = isTrack ? { ...cors, 'Access-Control-Allow-Origin': '*' } : cors;
      return new Response(null, { headers: optCors });
    }

    try {
      // IP voor rate-limiting (Cloudflare zet deze headers)
      const clientIp = request.headers.get('CF-Connecting-IP') ||
                       request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                       'unknown';

      // === /track POST — analytics event (publiek, open CORS, MET rate limit) ===
      // Open CORS noodzakelijk: oude tab-cache, in-app browsers (WhatsApp/Instagram),
      // edge-cases met afwijkende of ontbrekende Origin-header werden eerder
      // geblokkeerd door de strikte whitelist. Track-payload is anoniem.
      if (url.pathname === '/track' && request.method === 'POST') {
        const trackCors = { ...cors, 'Access-Control-Allow-Origin': '*' };
        if (!checkRateLimit(clientIp, 'track', 60, 60 * 1000)) {
          return jsonResponse({ ok: false, error: 'rate_limit' }, 429, trackCors);
        }
        const body = await request.json().catch(() => ({}));
        const salt = (env && env.ADMIN_PASSWORD) || 'static-salt';
        const visitorId = clientIp ? (await sha256Hex(clientIp + ':' + todayUTC() + ':' + salt)).slice(0, 16) : null;
        const country = (request.cf && request.cf.country) || null;
        try {
          await trackEvent({
            type: body.type,
            path: body.path,
            productId: body.productId,
            kleur: body.kleur,
            ref: body.ref,
            country,
            device: body.device,
            postcode: body.postcode,
            postcodeType: body.postcodeType,
            visitorId,
          }, env);
        } catch { /* nooit fail tegenover client — analytics is optioneel */ }
        return jsonResponse({ ok: true }, 200, trackCors);
      }

      // === /review POST — publieke review-inzending (GEEN auth, MET rate limit) ===
      if (url.pathname === '/review' && request.method === 'POST') {
        // Max 3 reviews per 10 minuten per IP — voorkomt spam
        if (!checkRateLimit(clientIp, 'review', 3, 10 * 60 * 1000)) {
          return jsonResponse({ error: 'rate_limit', detail: 'Te veel reviews kort na elkaar. Probeer later opnieuw.' }, 429, cors);
        }
        const body = await request.json().catch(() => ({}));
        const result = await submitReview(body, env);
        return jsonResponse(result, 200, cors);
      }

      // === /order — publieke redirect naar WhatsApp (GEEN auth) ===
      if (url.pathname === '/order' && request.method === 'GET') {
        if (!env.WHATSAPP_NUMBER) {
          return new Response('WhatsApp number not configured', { status: 500, headers: cors });
        }
        const text = url.searchParams.get('text') || '';
        const target = `https://wa.me/${env.WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
        return new Response(null, { status: 302, headers: { ...cors, 'Location': target } });
      }

      // === Auth check (alle overige endpoints) — timing-safe, met brute-force rem ===
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace(/^Bearer\s+/i, '');
      const tokenOK = env.ADMIN_PASSWORD && timingSafeEqual(token, env.ADMIN_PASSWORD);
      if (!tokenOK) {
        if (url.pathname === '/auth') {
          // Rate limit /auth: max 5 pogingen per 5 min per IP
          if (!checkRateLimit(clientIp, 'auth', 5, 5 * 60 * 1000)) {
            return jsonResponse({ error: 'rate_limit', detail: 'Te veel inlogpogingen — wacht 5 min.' }, 429, cors);
          }
          const body = await request.json().catch(() => ({}));
          if (env.ADMIN_PASSWORD && timingSafeEqual(String(body.password || ''), env.ADMIN_PASSWORD)) {
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

      // === /update-item POST — sla bestaand item op zonder foto-upload ===
      // Wordt aangeroepen door admin-edit "Bewaren"-knop voor full-auto sync.
      if (url.pathname === '/update-item' && request.method === 'POST') {
        const body = await request.json();
        const result = await updateItemInGitHub(body, env);
        return jsonResponse(result, 200, cors);
      }

      // === /delete-item POST — verwijder bestaand item ===
      if (url.pathname === '/delete-item' && request.method === 'POST') {
        const body = await request.json();
        const result = await deleteItemInGitHub(body, env);
        return jsonResponse(result, 200, cors);
      }

      // === /smart-edit POST — AI past gerichte wijziging toe op item, foto's gegarandeerd intact ===
      if (url.pathname === '/smart-edit' && request.method === 'POST') {
        const body = await request.json();
        const result = await smartEditWithGemini(body, env);
        return jsonResponse(result, 200, cors);
      }

      // === /upload-photo POST — losse foto upload, geeft pad terug ===
      if (url.pathname === '/upload-photo' && request.method === 'POST') {
        const body = await request.json();
        const result = await uploadPhotoToGitHub(body, env);
        return jsonResponse(result, 200, cors);
      }

      // === /update-site-config POST — site-stats (volgers etc.) ===
      if (url.pathname === '/update-site-config' && request.method === 'POST') {
        const body = await request.json();
        const result = await updateSiteConfigInGitHub(body, env);
        return jsonResponse(result, 200, cors);
      }

      // === /stats GET — analytics summary (auth-protected) ===
      if (url.pathname === '/stats' && request.method === 'GET') {
        const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days')) || 30));
        const summary = await getStatsSummary(env, days);
        return jsonResponse(summary, 200, cors);
      }

      // === /stats/history GET — events tussen 2 datums, optionele type-filter ===
      // Persistente event-history is uitgeschakeld om binnen Cloudflare KV
      // gratis tier limiet (1000 PUTs/dag) te blijven. Pas weer beschikbaar
      // bij migratie naar D1 of upgrade naar Workers Paid plan.
      if (url.pathname === '/stats/history' && request.method === 'GET') {
        if (!env.STATS) return jsonResponse({ events: [], total: 0, reason: 'no_kv' }, 200, cors);
        const from = url.searchParams.get('from') || todayUTC();    // YYYY-MM-DD
        const to = url.searchParams.get('to') || from;
        const hour = url.searchParams.get('hour');                  // optional 'HH'
        const filterType = url.searchParams.get('type') || '';
        const limit = Math.min(2000, Math.max(1, parseInt(url.searchParams.get('limit')) || 500));

        // Bouw datum-range
        const days = [];
        const fromDate = new Date(from + 'T00:00:00Z');
        const toDate = new Date(to + 'T00:00:00Z');
        for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
          days.push(d.toISOString().slice(0, 10));
        }

        const events = [];
        for (const day of days) {
          if (events.length >= limit) break;
          const prefix = hour ? `event:${day}:${hour}` : `event:${day}`;
          let cursor;
          do {
            const page = await env.STATS.list({ prefix, cursor, limit: 1000 });
            for (const k of page.keys) {
              if (events.length >= limit) break;
              const v = await env.STATS.get(k.name);
              if (!v) continue;
              try {
                const ev = JSON.parse(v);
                if (filterType && ev.type !== filterType) continue;
                ev.key = k.name;
                events.push(ev);
              } catch {}
            }
            cursor = page.cursor;
            if (page.list_complete) break;
          } while (cursor && events.length < limit);
        }
        // Nieuwste eerst
        events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return jsonResponse({ events, total: events.length, from, to, hour, type: filterType, limit }, 200, cors);
      }

      // === /stats/feed GET — laatste 20 events in-memory (per isolate) ===
      if (url.pathname === '/stats/feed' && request.method === 'GET') {
        const feed = _liveFeed.slice(0, 20);
        const lastTs = feed[0]?.ts || 0;
        const secondsAgo = lastTs ? Math.floor((Date.now() - lastTs) / 1000) : null;
        return jsonResponse({ feed, secondsAgo, source: 'memory' }, 200, cors);
      }

      if (url.pathname === '/auth') {
        return jsonResponse({ ok: true }, 200, cors);
      }

      // === /review PUT — moderatie (auth vereist) ===
      if (url.pathname === '/review' && request.method === 'PUT') {
        const body = await request.json();
        const result = await moderateReview(body, env);
        return jsonResponse(result, 200, cors);
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
// /smart-edit — gerichte wijziging op bestaand item via NL-instructie
// Foto-paden zijn gegarandeerd intact: validatie tegen origineel.
// ================================================================
async function smartEditWithGemini({ item, instructie }, env) {
  if (!item || typeof item !== 'object') throw new Error('item ontbreekt');
  if (!instructie || !instructie.trim()) throw new Error('instructie ontbreekt');
  // Cap instructie-lengte (DOS + prompt-injection rem)
  if (String(instructie).length > 800) {
    throw new Error('Wijziging te lang — max 800 tekens.');
  }
  // Strip controle-karakters die JSON of prompt kunnen breken
  instructie = String(instructie).replace(/[\u0000-\u001F\u007F]+/g, ' ').trim();

  // Verzamel alle bestaande foto-paden — Gemini mag UITSLUITEND deze gebruiken
  const bekendePaden = new Set();
  if (item.foto) bekendePaden.add(item.foto);
  for (const v of (item.varianten || [])) {
    for (const f of (v.fotos || [])) if (f) bekendePaden.add(f);
  }

  // Onveranderlijk: id en datumToegevoegd worden later weer opgeplakt
  const wijzigbaar = { ...item };
  delete wijzigbaar.id;
  delete wijzigbaar.datumToegevoegd;

  const padenLijst = [...bekendePaden].map(p => `  - "${p}"`).join('\n') || '  (geen)';

  const prompt = `Pleun heeft een artikel in haar shop dat ze wil bijstellen — een KLEINE gerichte wijziging, niets meer.

HUIDIG ARTIKEL (JSON):
${JSON.stringify(wijzigbaar, null, 2)}

PLEUN'S WIJZIGINGSVERZOEK (in haar eigen woorden):
"${instructie.trim()}"

REGELS — STRIKT NALEVEN:
1. Pas ALLEEN toe wat Pleun letterlijk vraagt. Verzin niets bij. Laat alle andere velden ongewijzigd.

2. FOTO-PADEN — KRITIEK: ALLE onderstaande foto-paden MOETEN in het resultaat behouden blijven, ergens in een variant. Verlies of verwijder NOOIT een pad. Je mag alleen HERORDENEN of HERGROEPEREN over varianten:
${padenLijst}

3. Als Pleun varianten wil samenvoegen of duplicaten wil verwijderen: combineer hun "fotos"-arrays in de behouden variant — alle paden uit de samengevoegde varianten moeten daar terechtkomen.

4. Verzin GEEN nieuwe foto-paden. Alleen paden uit de lijst hierboven zijn toegestaan.

5. Behoud altijd minstens 1 variant met minstens 1 foto. Als het artikel geen "varianten" had en die zijn niet relevant, laat het veld weg.

6. Tekst (naam, beschrijving) aanpassen mag in Pleuns stem, maar alleen als ze daarom vraagt.

7. Als de wijziging onmogelijk is of risicovol, geef het origineel ongewijzigd terug en zet een korte uitleg in het veld "_notitie".

Geef ALLEEN dit JSON-object terug, zonder commentaar of markdown:

{
  ...alle velden van het bijgewerkte artikel...,
  "_notitie": "1 zin in NL: wat is er aangepast (of waarom niet)"
}`;

  const result = await callGemini({ prompt, env, maxTokens: 3000, temperature: 0.4 });
  if (!result || typeof result !== 'object') throw new Error('AI gaf onleesbaar antwoord');

  // Verzamel alle foto-paden uit het resultaat
  const resultPaden = new Set();
  if (result.foto) resultPaden.add(result.foto);
  for (const v of (result.varianten || [])) {
    if (!v || typeof v !== 'object') throw new Error('AI gaf ongeldige variant terug');
    for (const f of (v.fotos || [])) if (f) resultPaden.add(f);
  }

  // Validatie 1: geen verzonnen paden
  for (const p of resultPaden) {
    if (!bekendePaden.has(p)) {
      throw new Error(`AI verzon een onbekend foto-pad: "${p}". Probeer je vraag anders te formuleren.`);
    }
  }

  // Validatie 2: alle originele paden moeten behouden zijn
  const verloren = [...bekendePaden].filter(p => !resultPaden.has(p));
  if (verloren.length > 0) {
    // Auto-recover: voeg verloren foto's toe aan eerste variant zodat niets verloren gaat
    if (!Array.isArray(result.varianten) || !result.varianten.length) {
      result.varianten = [{ kleur: '', fotos: [] }];
    }
    if (!Array.isArray(result.varianten[0].fotos)) result.varianten[0].fotos = [];
    for (const p of verloren) {
      if (!result.varianten[0].fotos.includes(p)) {
        result.varianten[0].fotos.push(p);
      }
    }
    result._notitie = (result._notitie ? result._notitie + ' ' : '') +
      `⚠️ ${verloren.length} foto('s) zou(den) verloren gaan — automatisch teruggezet in eerste variant.`;
  }

  // Plak onveranderlijke velden terug
  result.id = item.id;
  if (item.datumToegevoegd) result.datumToegevoegd = item.datumToegevoegd;

  // Splits notitie eruit voor de UI
  const notitie = result._notitie || '';
  delete result._notitie;

  return { item: result, notitie };
}

// ================================================================
// /upload-photo — losse foto upload naar img/items/, geeft pad terug
// Gebruikt door admin variant-editor om losse foto's toe te voegen.
// ================================================================
async function uploadPhotoToGitHub({ photoBase64, photoFilename, mediaType }, env) {
  if (!photoBase64) throw new Error('photoBase64 ontbreekt');
  if (!photoFilename) throw new Error('photoFilename ontbreekt');
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN niet ingesteld');

  // Magic-byte validatie — bestand MOET een echt image-formaat zijn
  const realMime = detectImageMime(photoBase64);
  if (!realMime) {
    throw new Error('Bestand is geen geldige JPEG/PNG/WebP/GIF afbeelding.');
  }

  // Max 8 MB per upload (base64 inflated ~33%)
  const cleanLen = String(photoBase64).replace(/^data:image\/\w+;base64,/, '').length;
  if (cleanLen > 11 * 1024 * 1024) { // ~8 MB binary
    throw new Error('Foto is te groot — max ~8 MB.');
  }

  // Sanitize filename: alleen [a-z0-9.-] toegestaan, geen path traversal
  const safe = String(photoFilename).toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/\.\.+/g, '.')   // geen ".." sequences
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  if (!safe || safe.startsWith('.')) throw new Error('ongeldige filename');
  // Forceer juiste extensie op basis van magic byte (geen .html/.exe)
  const extByMime = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const correctExt = extByMime[realMime];
  const baseSafe = safe.replace(/\.[a-z0-9]+$/, '');
  const finalSafe = `${baseSafe}.${correctExt}`;

  const ghHeaders = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'crochet-by-pleun-worker',
    'Content-Type': 'application/json',
  };

  const cleanB64 = (photoBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  const path = `img/items/${finalSafe}`;
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;

  let sha = undefined;
  const check = await fetch(url, { headers: ghHeaders });
  if (check.ok) sha = (await check.json()).sha;

  const up = await fetch(url, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `📸 Upload foto: ${finalSafe}`,
      content: cleanB64,
      ...(sha && { sha }),
    }),
  });
  if (!up.ok) throw new Error(`Foto upload mislukt: ${await up.text()}`);

  return { path };
}

// ================================================================
// /update-site-config — site-stats (volgers, lastUpdate)
// ================================================================
async function updateSiteConfigInGitHub({ volgers }, env) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN niet ingesteld');
  const num = parseInt(volgers, 10);
  if (isNaN(num) || num < 0 || num > 1000000) {
    throw new Error('Volgers-aantal ongeldig');
  }
  const ghHeaders = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'crochet-by-pleun-worker',
    'Content-Type': 'application/json',
  };
  const path = 'data/site-config.json';
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
  let sha = undefined;
  let existing = {};
  const check = await fetch(url, { headers: ghHeaders });
  if (check.ok) {
    const data = await check.json();
    sha = data.sha;
    try {
      const decoded = atob(data.content.replace(/\s/g, ''));
      existing = JSON.parse(decoded);
    } catch { /* nieuw bestand */ }
  }
  const updated = { ...existing, volgers: num, lastUpdate: new Date().toISOString().slice(0, 10) };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(updated, null, 2) + '\n')));
  const up = await fetch(url, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `🌸 Site-config: ${num} volgers`,
      content,
      ...(sha && { sha }),
    }),
  });
  if (!up.ok) throw new Error(`Update mislukt: ${await up.text()}`);
  return { ok: true, volgers: num };
}

// ================================================================
// GitHub — foto + items.json bijwerken
// ================================================================
async function publishToGitHub({ item, photoBase64, photoFilename, extraPhotos, hoofdKleur, kleurVarianten }, env) {
  const ghHeaders = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'crochet-by-pleun-worker',
    'Content-Type': 'application/json',
  };

  // Helper: één foto uploaden (met SHA-detect voor overschrijven)
  async function uploadOne(filename, base64, msg) {
    const cleanB64 = (base64 || '').replace(/^data:image\/\w+;base64,/, '');
    const path = `img/items/${filename}`;
    const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
    let sha = undefined;
    const check = await fetch(url, { headers: ghHeaders });
    if (check.ok) sha = (await check.json()).sha;
    const up = await fetch(url, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({ message: msg, content: cleanB64, ...(sha && { sha }) }),
    });
    if (!up.ok) throw new Error(`Foto upload mislukt (${filename}): ${await up.text()}`);
    return path;
  }

  // Hoofdfoto uploaden
  const photoPath = await uploadOne(photoFilename, photoBase64, `📦 Add photo for ${item.naam || item.id}`);

  // Extra foto's uploaden (optioneel)
  const extraPaths = [];
  if (Array.isArray(extraPhotos)) {
    for (let i = 0; i < extraPhotos.length; i++) {
      const ep = extraPhotos[i];
      if (!ep?.base64 || !ep?.filename) continue;
      const path = await uploadOne(ep.filename, ep.base64, `📸 Add extra photo ${i + 1} for ${item.naam || item.id}`);
      extraPaths.push(path);
    }
  }

  const itemsUrl = `https://api.github.com/repos/${REPO}/contents/data/items.json`;
  const itemsRes = await fetch(itemsUrl, { headers: ghHeaders });
  if (!itemsRes.ok) throw new Error('items.json ophalen mislukt');
  const itemsData = await itemsRes.json();
  const currentJson = JSON.parse(decodeBase64(itemsData.content));

  item.foto = photoPath;

  // Kleur-varianten uploaden (optioneel)
  const kvOut = [];
  if (Array.isArray(kleurVarianten)) {
    for (let vi = 0; vi < kleurVarianten.length; vi++) {
      const kv = kleurVarianten[vi];
      const kleurSlug = String(kv.kleur || `v${vi + 2}`).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fotos = [];
      const arr = Array.isArray(kv.fotos) ? kv.fotos : [];
      for (let fi = 0; fi < arr.length; fi++) {
        const f = arr[fi];
        if (!f?.base64) continue;
        const fn = `${item.id}-${kleurSlug}-${fi + 1}.${f.ext || 'jpg'}`;
        const path = await uploadOne(fn, f.base64, `🎨 Add color variant photo (${kv.kleur}) ${fi + 1} for ${item.naam || item.id}`);
        fotos.push(path);
      }
      if (fotos.length) {
        kvOut.push({
          kleur: kv.kleur || '',
          voorraad: kv.voorraad ?? 1,
          fotos,
        });
      }
    }
  }

  // Bouw varianten-array op als er kleur-varianten of extra foto's zijn
  if (kvOut.length > 0 || extraPaths.length > 0 || hoofdKleur) {
    item.varianten = [
      {
        kleur: hoofdKleur || '',
        fotos: [photoPath, ...extraPaths],
        voorraad: item.voorraad ?? 1,
      },
      ...kvOut,
    ];
  }
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
    siteUrl: 'https://hookedbypleun.github.io/',
  };
}

// ================================================================
// Item update zonder foto-upload — voor admin-edit "Bewaren"-flow
// ================================================================
async function updateItemInGitHub({ item }, env) {
  if (!item || !item.id) throw new Error('item + item.id verplicht');

  const ghHeaders = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'crochet-by-pleun-worker',
    'Content-Type': 'application/json',
  };

  const itemsUrl = `https://api.github.com/repos/${REPO}/contents/data/items.json`;
  const itemsRes = await fetch(itemsUrl, { headers: ghHeaders });
  if (!itemsRes.ok) throw new Error('items.json ophalen mislukt');
  const itemsData = await itemsRes.json();
  const currentJson = JSON.parse(decodeBase64(itemsData.content));

  const idx = currentJson.items.findIndex(i => i.id === item.id);
  if (idx < 0) {
    // Bestaat nog niet → toevoegen (defensief, maar primair update-flow)
    currentJson.items.push(item);
  } else {
    // Behoud bestaande foto's/varianten als ze niet meegestuurd zijn
    const existing = currentJson.items[idx];
    const merged = { ...existing, ...item };
    if (!item.foto && existing.foto) merged.foto = existing.foto;
    if (!item.varianten && existing.varianten) merged.varianten = existing.varianten;
    currentJson.items[idx] = merged;
  }

  const newContent = encodeBase64(JSON.stringify(currentJson, null, 2));
  const updateRes = await fetch(itemsUrl, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `✏️ Bewerk item: ${item.naam || item.id}`,
      content: newContent,
      sha: itemsData.sha,
    }),
  });
  if (!updateRes.ok) {
    throw new Error('items.json update mislukt: ' + (await updateRes.text()));
  }

  return { ok: true, itemId: item.id, siteUrl: 'https://hookedbypleun.github.io/' };
}

// ================================================================
// Item verwijderen — voor admin-delete "Verwijderen"-knop
// ================================================================
async function deleteItemInGitHub({ id }, env) {
  if (!id) throw new Error('id verplicht');

  const ghHeaders = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'crochet-by-pleun-worker',
    'Content-Type': 'application/json',
  };

  const itemsUrl = `https://api.github.com/repos/${REPO}/contents/data/items.json`;
  const itemsRes = await fetch(itemsUrl, { headers: ghHeaders });
  if (!itemsRes.ok) throw new Error('items.json ophalen mislukt');
  const itemsData = await itemsRes.json();
  const currentJson = JSON.parse(decodeBase64(itemsData.content));

  const idx = currentJson.items.findIndex(i => i.id === id);
  if (idx < 0) return { ok: true, itemId: id, deleted: false };

  const removed = currentJson.items.splice(idx, 1)[0];
  const newContent = encodeBase64(JSON.stringify(currentJson, null, 2));
  const updateRes = await fetch(itemsUrl, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `🗑️ Verwijder item: ${removed?.naam || id}`,
      content: newContent,
      sha: itemsData.sha,
    }),
  });
  if (!updateRes.ok) {
    throw new Error('items.json delete mislukt: ' + (await updateRes.text()));
  }

  return { ok: true, itemId: id, deleted: true };
}

// ================================================================
// Reviews — opslaan + modereren
// ================================================================
async function getReviewsFile(env) {
  const ghHeaders = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'crochet-by-pleun-worker',
  };
  const url = `https://api.github.com/repos/${REPO}/contents/data/reviews.json`;
  const res = await fetch(url, { headers: ghHeaders });
  if (!res.ok) return { reviews: [], sha: null, ghHeaders, url };
  const data = await res.json();
  const content = JSON.parse(decodeBase64(data.content));
  return { reviews: content.reviews || [], sha: data.sha, ghHeaders, url };
}

async function saveReviewsFile({ reviews, sha, ghHeaders, url }, message) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeBase64(JSON.stringify({ reviews }, null, 2)),
      ...(sha && { sha }),
    }),
  });
  if (!res.ok) throw new Error('reviews.json opslaan mislukt: ' + await res.text());
}

async function submitReview({ productId, productNaam, naam, tekst, rating }, env) {
  if (!tekst || String(tekst).trim().length < 5) throw new Error('Review tekst te kort');
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN niet ingesteld');
  const file = await getReviewsFile(env);
  const review = {
    id: crypto.randomUUID(),
    productId:   String(productId  || '').slice(0, 100),
    productNaam: String(productNaam || '').slice(0, 100),
    naam:        String(naam        || '').slice(0, 80),
    tekst:       String(tekst       || '').trim().slice(0, 600),
    rating:      Math.max(1, Math.min(5, parseInt(rating) || 5)),
    datum:       new Date().toISOString().slice(0, 10),
    status:      'pending',
    cadeau:      false,
    uitgelicht:  false,
  };
  file.reviews.push(review);
  await saveReviewsFile(file, `💬 Nieuwe review voor ${review.productNaam}`);
  return { ok: true };
}

async function moderateReview({ id, actie }, env) {
  if (!id || !actie) throw new Error('id en actie zijn verplicht');
  const file = await getReviewsFile(env);
  const idx = file.reviews.findIndex(r => r.id === id);
  if (idx < 0) throw new Error('Review niet gevonden');
  const r = file.reviews[idx];
  if (actie === 'approve')    { r.status = 'approved'; }
  else if (actie === 'reject')    { r.status = 'rejected'; }
  else if (actie === 'cadeau')    { r.cadeau = !r.cadeau; }
  else if (actie === 'uitgelicht') { r.uitgelicht = !r.uitgelicht; }
  else throw new Error('Onbekende actie: ' + actie);
  await saveReviewsFile(file, `🔧 Review ${actie}: ${r.productNaam}`);
  return { ok: true, review: r };
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
