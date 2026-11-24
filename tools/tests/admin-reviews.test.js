// Test: review-velden in de admin-reviewlijst worden als tekst getoond.
// Draai: node tools/tests/admin-reviews.test.js   (exit 0 = groen)
//
// Haalt escapeHtmlAdmin() en loadAdminReviews() letterlijk uit admin/index.html,
// draait ze in een vm met een nep-document en een fixture-reviews.json, en
// controleert de HTML die in de lijst terechtkomt.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'admin', 'index.html'), 'utf8');

function extractFunction(src, name) {
  const re = new RegExp('(async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) throw new Error('functie niet gevonden: ' + name);
  let i = src.indexOf('{', m.index);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(m.index, j + 1); }
  }
  throw new Error('geen sluitende accolade voor ' + name);
}

const FIX = '<b>x</b>';
const fixture = {
  reviews: [
    { id: 'r1', productId: 'p-' + FIX, productNaam: FIX, naam: FIX, tekst: FIX, rating: 5, datum: '2026-11-24', status: 'pending', cadeau: false, uitgelicht: false },
    { id: 'r2', productId: '"><img src=x onerror=alert(1)>', productNaam: '', naam: '', tekst: "it's \"ok\" & fine", rating: 4, datum: '2026-11-23', status: 'approved', cadeau: true, uitgelicht: true },
  ],
};

async function run() {
  const container = { innerHTML: '' };
  const ctx = {
    document: { getElementById: id => (id === 'reviews-admin-list' ? container : null) },
    fetch: async () => ({ json: async () => JSON.parse(JSON.stringify(fixture)) }),
    encodeURIComponent, Date, String, JSON,
  };
  vm.createContext(ctx);
  vm.runInContext(extractFunction(html, 'escapeHtmlAdmin') + '\n' + extractFunction(html, 'loadAdminReviews'), ctx);
  await ctx.loadAdminReviews();
  const out = container.innerHTML;

  let fouten = 0;
  const check = (naam, fn) => {
    try { fn(); console.log('  ok   ' + naam); }
    catch (e) { fouten++; console.log('  FOUT ' + naam + ' — ' + e.message); }
  };

  check('lijst is gevuld', () => assert.ok(out.includes('rv-admin-kaart'), 'geen kaarten'));
  check('geen rauwe <b>x</b> in de HTML', () => assert.ok(!out.includes(FIX), 'rauwe tag gevonden'));
  check('naam letterlijk zichtbaar', () => assert.ok(out.includes('<strong>&lt;b&gt;x&lt;/b&gt;</strong>'), 'naam niet geëscaped'));
  check('productNaam letterlijk zichtbaar', () => assert.ok(/target="_blank">&lt;b&gt;x&lt;\/b&gt;<\/a>/.test(out), 'productNaam niet geëscaped'));
  check('tekst letterlijk zichtbaar', () => assert.ok(out.includes('"&lt;b&gt;x&lt;/b&gt;"'), 'tekst niet geëscaped'));
  check('productId als linktekst geëscaped', () => assert.ok(out.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</a>'), 'productId-linktekst niet geëscaped'));
  check('geen <img in de HTML', () => assert.ok(!/<img/i.test(out), '<img gevonden'));
  check('aanhalingstekens en & netjes', () => assert.ok(out.includes('it&#39;s &quot;ok&quot; &amp; fine'), 'tekens niet geëscaped'));
  check('lege naam → Anoniem', () => assert.ok(out.includes('<strong>Anoniem</strong>'), 'Anoniem ontbreekt'));
  check('knoppen blijven werken (id in onclick)', () => assert.ok(out.includes("modereerReview('r1','approve')"), 'approve-knop kapot'));
  check('sterren kloppen', () => assert.ok(out.includes('★★★★☆'), 'sterren kapot'));

  if (fouten) { console.log(`\n${fouten} fout(en)`); process.exit(1); }
  console.log('\nalles groen');
}

run().catch(e => { console.error(e); process.exit(1); });
