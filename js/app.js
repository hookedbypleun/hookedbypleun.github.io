// Crochet by Pleun â€” Hoofd-applicatielogica
// Laadt items.json, vult galerij, productpagina, uitgelichte items.

(function() {
  let DATA = null;

  async function loadData() {
    if (DATA) return DATA;
    const res = await fetch('data/items.json?v=' + Date.now());
    DATA = await res.json();
    return DATA;
  }

  function fmtPrijs(p) {
    return 'â‚¬' + p.toFixed(2).replace('.', ',');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function tagHTML(item) {
    const tags = [];
    if (item.status === 'uitverkocht') tags.push('<span class="tag uitverkocht">Verkocht ðŸ’•</span>');
    else if (item.status === 'archief') tags.push('<span class="tag archief">Eerder gemaakt ðŸ’</span>');
    else if (item.status === 'binnenkort') tags.push('<span class="tag binnenkort">Binnenkort âœ¨</span>');
    else if (item.status === 'showcase') tags.push('<span class="tag showcase">Op maat</span>');
    else if (item.afgeprijsd) tags.push('<span class="tag afgeprijsd">Sale!</span>');
    else if (item.nieuw) tags.push('<span class="tag nieuw">Nieuw ðŸŒ¸</span>');
    if (item.uitgelicht && item.status !== 'uitverkocht' && item.status !== 'archief') tags.push('<span class="tag uitgelicht">Favoriet</span>');
    if (item.eigenPatroon) tags.push('<span class="tag eigen">â­ Eigen ontwerp</span>');
    return tags.join('');
  }

  // ===== Varianten helpers =====
  // Geeft alle varianten voor een item, of een dummy-variant op basis van het oude foto/kleuren-formaat
  function getVarianten(item) {
    if (item.varianten && item.varianten.length) return item.varianten;
    return [{
      kleur: item.kleuren?.[0] || '',
      fotos: [item.foto].filter(Boolean),
      voorraad: item.voorraad || 0,
    }];
  }
  function getHoofdfoto(item) {
    const v = getVarianten(item);
    return v[0]?.fotos?.[0] || item.foto || '';
  }
  function totaalVoorraad(item) {
    return getVarianten(item).reduce((s, v) => s + (v.voorraad || 0), 0);
  }
  // Kleur â†’ hex voor CSS dotjes (klein vocabulaire â€” fallback grijs)
  const KLEUR_HEX = {
    'lichtroze':'#F5C6CB','roze':'#E5959D','wit':'#F5F1EA','crÃ¨me':'#EFE3CC','creme':'#EFE3CC',
    'beige':'#D9C5A8','koraal':'#F5B79E','oranje':'#E89B6B','geel':'#E5C871','mosterd':'#C99838',
    'lichtblauw':'#C5DDED','blauw':'#8FBCD8','donkerblauw':'#5479A0',
    'mint':'#C7E6D2','groen':'#9ABF9A','olijf':'#A8A572',
    'lavendel':'#B5A1D6','paars':'#8F7DA8','lila':'#D6C5E0',
    'grijs':'#B8B0B8','zwart':'#3E3447','bruin':'#A28066',
    'multi':'linear-gradient(135deg,#F5C6CB,#C5DDED,#E5C871)',
  };
  function kleurDot(kleur) {
    const k = String(kleur || '').toLowerCase().trim();
    const hex = KLEUR_HEX[k] || '#D9C5A8';
    const isMulti = hex.startsWith('linear');
    return `<span class="kleur-dot" title="${escapeHtml(kleur)}" style="background:${hex}"></span>`;
  }

  function prijsHTML(item) {
    if (item.status === 'showcase' || item.status === 'binnenkort' || item.prijs === 0) {
      return `<p class="prijs">${item.status === 'binnenkort' ? 'âœ¨ binnenkort' : item.opMaat ? 'op maat' : 'â€”'}</p>`;
    }
    if (item.prijsOud) {
      return `<p class="prijs"><span class="prijs-oud">${fmtPrijs(item.prijsOud)}</span>${fmtPrijs(item.prijs)}${item.perStuk ? ' / stuk' : ''}</p>`;
    }
    return `<p class="prijs">${fmtPrijs(item.prijs)}${item.perStuk ? ' / stuk' : ''}</p>`;
  }

  function kaartHTML(item) {
    const sold = item.status === 'uitverkocht';
    const varianten = getVarianten(item);
    const hoofdfoto = getHoofdfoto(item);
    const kleurDots = varianten.length > 1
      ? `<div class="kleur-dots">${varianten.slice(0, 5).map(v => kleurDot(v.kleur)).join('')}${varianten.length > 5 ? `<span class="kleur-meer">+${varianten.length - 5}</span>` : ''}</div>`
      : '';
    return `
      <a href="product.html?id=${encodeURIComponent(item.id)}" class="item-kaart ${sold ? 'uitverkocht' : ''}">
        <div class="foto">
          ${tagHTML(item)}
          <img src="${hoofdfoto}" alt="${escapeHtml(item.naam)}" loading="lazy" onerror="this.style.background='#FAF6EE'">
        </div>
        <div class="info">
          <h3>${escapeHtml(item.naam)}</h3>
          ${prijsHTML(item)}
          ${item.afmeting ? `<p class="meta">${item.afmeting}</p>` : ''}
          ${kleurDots}
        </div>
      </a>`;
  }

  // ===== Home =====
  async function renderHome() {
    const grid = document.getElementById('home-uitgelicht');
    if (!grid) return;
    // Volgers-aantal injecteren vanuit site-config.json (Pleun beheert via admin)
    fetch('data/site-config.json?v=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        const el = document.getElementById('volgers-count');
        if (el && cfg && typeof cfg.volgers === 'number') el.textContent = cfg.volgers;
      })
      .catch(() => {});
    const data = await loadData();
    const uitgelicht = data.items.filter(i => i.uitgelicht && i.status !== 'uitverkocht' && i.status !== 'archief').slice(0, 4);
    grid.innerHTML = uitgelicht.map(kaartHTML).join('') ||
      '<p class="leeg">Nog geen items ðŸ§¶</p>';

    const nieuwGrid = document.getElementById('home-nieuw');
    if (nieuwGrid) {
      const sorted = [...data.items]
        .filter(i => i.status === 'beschikbaar')
        .sort((a, b) => (b.datumToegevoegd || '').localeCompare(a.datumToegevoegd || ''))
        .slice(0, 6);
      nieuwGrid.innerHTML = sorted.map(kaartHTML).join('');
    }

    // Reviews-blok op homepage â€” alle goedgekeurde reviews (shop-breed)
    const reviewsGrid = document.getElementById('home-reviews');
    if (reviewsGrid) {
      try {
        const rvRes = await fetch('data/reviews.json?v=' + Date.now());
        const rvData = await rvRes.json();
        const approved = (rvData.reviews || []).filter(r => r.status === 'approved');
        // Pleun bepaalt welke reviews op de homepage komen via â­ Homepage in admin
        // Bij meer dan 6 uitgelichte: pak de 6 NIEUWSTE. Oudere uitgelichte blijven
        // in de data gemarkeerd en springen terug als Pleun een andere uitschakelt.
        const sortDatum = (a, b) => (b.datum || '').localeCompare(a.datum || '');
        const uitgelicht = approved.filter(r => r.uitgelicht).sort(sortDatum);
        const tonen = (uitgelicht.length > 0 ? uitgelicht : approved.slice().sort(sortDatum)).slice(0, 6);
        if (tonen.length > 0) {
          reviewsGrid.innerHTML = tonen.map(r => `
            <div class="review-kaart">
              <div class="rv-sterren">${'â˜…'.repeat(r.rating || 5)}</div>
              <p class="rv-tekst">"${escapeHtml(r.tekst)}"</p>
              <p class="rv-naam">â€” ${escapeHtml(r.naam || 'Anoniem')}</p>
              ${r.productNaam ? `<p class="rv-product">${escapeHtml(r.productNaam)}</p>` : ''}
            </div>`).join('');
        } else {
          reviewsGrid.innerHTML = '<p class="cd-hint" style="text-align:center;grid-column:1/-1">Nog geen reviews â€” wees de eerste! ðŸŒ¸</p>';
        }
      } catch {}
    }
  }

  // ===== Shop review formulier (homepage) =====
  // Onafhankelijk van renderHome â€” werkt ook als items.json/reviews.json faalt.
  function initShopReviewForm() {
    const shopVerstuur = document.getElementById('shop-rv-verstuur');
    const sterrenWrap = document.getElementById('shop-rv-sterren');
    if (!shopVerstuur || !sterrenWrap) return;
    if (shopVerstuur.dataset.bound === '1') return; // dubbele binding voorkomen
    shopVerstuur.dataset.bound = '1';

    let shopRating = 5;
    sterrenWrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-star]');
      if (!btn) return;
      e.preventDefault();
      shopRating = parseInt(btn.dataset.star);
      sterrenWrap.querySelectorAll('button').forEach((b, i) => {
        b.textContent = i < shopRating ? 'â˜…' : 'â˜†';
      });
    });

    shopVerstuur.addEventListener('click', async (e) => {
      e.preventDefault();
      const tekstEl = document.getElementById('shop-rv-tekst');
      const naamEl = document.getElementById('shop-rv-naam');
      const status = document.getElementById('shop-rv-status');
      const tekst = tekstEl?.value.trim() || '';
      const naam = naamEl?.value.trim() || '';
      const showStatus = (msg) => {
        if (status) {
          status.textContent = msg;
          status.style.display = 'block';
        }
      };
      if (!tekst || tekst.length < 5) {
        showStatus('Schrijf eerst iets (minstens 5 letters) ðŸ’');
        return;
      }
      shopVerstuur.disabled = true;
      shopVerstuur.textContent = 'â³ Versturen...';
      try {
        const cfg = window.SHOP_CONFIG || {};
        const url = (cfg.workerUrl || '').replace(/\/$/, '') + '/review';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: '', productNaam: '', naam, tekst, rating: shopRating }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
        showStatus('Bedankt! Pleun keurt je review zo snel mogelijk goed ðŸŽ€');
        shopVerstuur.textContent = 'âœ… Verstuurd!';
        if (tekstEl) tekstEl.value = '';
        if (naamEl) naamEl.value = '';
      } catch (err) {
        showStatus('ðŸ˜• Niet gelukt: ' + (err.message || 'onbekende fout') + '. Probeer opnieuw.');
        shopVerstuur.disabled = false;
        shopVerstuur.textContent = 'ðŸ’ Review versturen';
      }
    });
  }

  // ===== Galerij =====
  async function renderGalerij() {
    const grid = document.getElementById('galerij-grid');
    const filterBalk = document.getElementById('filter-balk');
    if (!grid) return;
    const data = await loadData();

    // Galerij toont GEEN archief-items (die staan op eerder.html)
    const galerijItems = data.items.filter(i => i.status !== 'archief');
    const cats = data.categories.sort((a, b) => a.volgorde - b.volgorde);

    let huidig = (new URL(location.href)).searchParams.get('cat') || 'alle';
    let huidigSort = 'datum';

    function render() {
      const filtered = huidig === 'alle' ? galerijItems : galerijItems.filter(i => i.categorie === huidig);
      const statusOrder = { beschikbaar: 0, binnenkort: 1, showcase: 2, uitverkocht: 3 };
      const sorted = [...filtered].sort((a, b) => {
        const sd = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        if (sd !== 0) return sd;
        if (huidigSort === 'prijs-asc')  return (a.prijs || 0) - (b.prijs || 0);
        if (huidigSort === 'prijs-desc') return (b.prijs || 0) - (a.prijs || 0);
        return (b.datumToegevoegd || '').localeCompare(a.datumToegevoegd || '');
      });
      grid.innerHTML = sorted.length
        ? sorted.map(kaartHTML).join('')
        : '<p class="leeg">In deze categorie zitten nog geen items. Pleun haakt eraan! ðŸ§¶</p>';
    }

    if (filterBalk) {
      filterBalk.innerHTML = `
        <button data-cat="alle" class="${huidig === 'alle' ? 'actief' : ''}">Alles</button>
        ${cats.map(c => {
          const aantal = galerijItems.filter(i => i.categorie === c.id).length;
          if (aantal === 0) return '';
          return `<button data-cat="${c.id}" class="${huidig === c.id ? 'actief' : ''}">${c.emoji} ${escapeHtml(c.naam)} (${aantal})</button>`;
        }).join('')}
      `;
      filterBalk.addEventListener('click', e => {
        const b = e.target.closest('button[data-cat]');
        if (!b) return;
        huidig = b.dataset.cat;
        filterBalk.querySelectorAll('button').forEach(x => x.classList.toggle('actief', x.dataset.cat === huidig));
        history.replaceState(null, '', huidig === 'alle' ? 'galerij.html' : 'galerij.html?cat=' + huidig);
        render();
      });
    }

    const sortRij = document.getElementById('sort-rij');
    const sortSelect = document.getElementById('sort-select');
    if (sortRij && sortSelect) {
      sortRij.style.display = '';
      sortSelect.addEventListener('change', () => {
        huidigSort = sortSelect.value;
        render();
      });
    }

    render();
  }

  // ===== Eerder gemaakt (archief) =====
  async function renderArchief() {
    const grid = document.getElementById('archief-grid');
    const filterBalk = document.getElementById('filter-balk');
    if (!grid) return;
    const data = await loadData();

    const archiefItems = data.items.filter(i => i.status === 'archief');
    const cats = data.categories.sort((a, b) => a.volgorde - b.volgorde);

    let huidig = (new URL(location.href)).searchParams.get('cat') || 'alle';

    function render() {
      const filtered = huidig === 'alle' ? archiefItems : archiefItems.filter(i => i.categorie === huidig);
      const sorted = [...filtered].sort((a, b) => (b.datumToegevoegd || '').localeCompare(a.datumToegevoegd || ''));
      grid.innerHTML = sorted.length
        ? sorted.map(kaartHTML).join('')
        : '<p class="leeg">Nog geen items in mijn schatkamer ðŸ’</p>';
    }

    if (filterBalk) {
      filterBalk.innerHTML = `
        <button data-cat="alle" class="${huidig === 'alle' ? 'actief' : ''}">Alles</button>
        ${cats.map(c => {
          const aantal = archiefItems.filter(i => i.categorie === c.id).length;
          if (aantal === 0) return '';
          return `<button data-cat="${c.id}" class="${huidig === c.id ? 'actief' : ''}">${c.emoji} ${escapeHtml(c.naam)} (${aantal})</button>`;
        }).join('')}
      `;
      filterBalk.addEventListener('click', e => {
        const b = e.target.closest('button[data-cat]');
        if (!b) return;
        huidig = b.dataset.cat;
        filterBalk.querySelectorAll('button').forEach(x => x.classList.toggle('actief', x.dataset.cat === huidig));
        history.replaceState(null, '', huidig === 'alle' ? 'eerder.html' : 'eerder.html?cat=' + huidig);
        render();
      });
    }

    render();
  }

  // ===== Product =====
  async function renderProduct() {
    const wrap = document.getElementById('product-detail');
    if (!wrap) return;
    const id = (new URL(location.href)).searchParams.get('id');
    const data = await loadData();
    const item = data.items.find(i => i.id === id);
    if (!item) {
      wrap.innerHTML = '<p class="leeg">Dit haakwerk konden we niet vinden ðŸ§¶ <a href="galerij.html">Terug naar de galerij</a></p>';
      return;
    }
    window.Track?.product(id);

    const cfg = window.SHOP_CONFIG;
    const sold = item.status === 'uitverkocht';
    const showcase = item.status === 'showcase';
    const binnenkort = item.status === 'binnenkort';
    const koopbaar = item.status === 'beschikbaar';
    const archief = item.status === 'archief';
    const cat = data.categories.find(c => c.id === item.categorie);

    const bericht =
`Hoi Pleun! ðŸ’

Ik heb interesse in: ${item.naam}${item.prijs ? ' (' + fmtPrijs(item.prijs) + ')' : ''}.

Mijn naam:
Mijn postcode + adres:
Lokaal afhalen of versturen?`;

    const varianten = getVarianten(item);
    // Alle unieke foto's van ALLE varianten â€” direct zichtbaar, kleur-knop = bestel-keuze
    const alleFotos = [...new Set(varianten.flatMap(v => v.fotos || []))];
    if (!alleFotos.length && item.foto) alleFotos.push(item.foto);
    // Tel UNIEKE non-empty kleuren â€” niet alle varianten. Voorkomt "kies kleur"-popup
    // bij artikelen met 1 echte kleur die per ongeluk over meerdere varianten gespreid staat.
    const uniekeKleuren = [...new Set(
      varianten.map(v => String(v.kleur || '').trim().toLowerCase()).filter(Boolean)
    )];
    const heeftMeerKleuren = uniekeKleuren.length > 1;

    const terugLabel = cat ? `${cat.emoji || ''} ${cat.naam || 'galerij'}` : 'galerij';
    const terugHref = cat ? `galerij.html?cat=${item.categorie}` : 'galerij.html';
    wrap.innerHTML = `
      <a class="terug-knop" href="${terugHref}"
         onclick="if (document.referrer && document.referrer.indexOf(location.origin) === 0) { history.back(); return false; }">
        â† Terug naar ${escapeHtml(terugLabel)}
      </a>
      <div class="foto-galerij" id="foto-galerij">
        <div class="foto-groot">
          <img src="${alleFotos[0] || item.foto || ''}" alt="${escapeHtml(item.naam)}" id="foto-hoofd">
        </div>
        <div class="foto-thumbs" id="foto-thumbs">
          ${alleFotos.map((f, i) => `<button class="foto-thumb${i === 0 ? ' actief' : ''}" data-foto="${escapeHtml(f)}" aria-label="Foto ${i + 1} van ${escapeHtml(item.naam)}"><img src="${f}" alt="" onerror="this.parentElement.style.opacity='0.3'"></button>`).join('')}
        </div>
      </div>
      <div class="product-info">
        <p class="meta"><a href="galerij.html?cat=${item.categorie}">${cat?.emoji || ''} ${escapeHtml(cat?.naam || '')}</a></p>
        <h1>${escapeHtml(item.naam)}</h1>
        <div class="prijs-groot">
          ${item.prijsOud ? `<span class="prijs-oud-groot">${fmtPrijs(item.prijsOud)}</span>` : ''}
          ${koopbaar || item.afgeprijsd ? fmtPrijs(item.prijs) + (item.perStuk ? ' / stuk' : '') :
            sold ? '<span style="color:var(--c-sold)">Verkocht ðŸ’•</span>' :
            archief ? '<span style="color:var(--c-pink-dark)">Eerder gemaakt ðŸ’</span>' :
            binnenkort ? '<span style="color:var(--c-mustard-dark)">Binnenkort âœ¨</span>' :
            showcase ? '<span style="color:var(--c-lavender-dark)">Op maat</span>' : 'â€”'}
        </div>

        ${item.eigenPatroon ? `
          <div class="eigen-spotlight">
            â­ <strong>100% Pleun's eigen ontwerp</strong> â€” geen patroon van internet, helemaal zelf bedacht. Een stuk Pleun in haakvorm ðŸ’
          </div>
        ` : ''}

        ${heeftMeerKleuren ? `
          <div class="varianten-keuze" id="varianten-keuze">
            <div class="kleur-keuze-hint" id="kleur-hint">ðŸŽ¨ Kies hieronder eerst een kleur!</div>
            <p class="varianten-label">ðŸŽ¨ Kies je kleur:${varianten[0].kleur ? ` <strong id="huidige-kleur">${escapeHtml(varianten[0].kleur)}</strong>` : ' <strong id="huidige-kleur" style="color:var(--c-muted); font-style:italic">â€” nog niet gekozen â€”</strong>'}</p>
            <div class="kleur-knoppen">
              ${varianten.map((v, i) => `
                <button class="kleur-knop${i === 0 ? ' actief' : ''}"
                        data-variant-idx="${i}"
                        title="${escapeHtml(v.kleur)}">
                  <span class="kleur-dot-groot" style="background:${KLEUR_HEX[String(v.kleur).toLowerCase().trim()] || '#D9C5A8'}"></span>
                  <span class="kleur-naam">${escapeHtml(v.kleur)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Tab-balk -->
        <div class="product-tabs-bar">
          <button class="actief" onclick="window.showProductTab('info')">ðŸ“¦ Over dit item</button>
          <button onclick="window.showProductTab('reviews')">ðŸ’¬ Reviews <span class="rv-count-badge" id="rv-tab-badge" style="display:none">0</span></button>
        </div>

        <!-- Tab: Info -->
        <div class="product-tab-pane actief" id="prod-tab-info">
          <p class="beschrijving">${escapeHtml(item.beschrijving)}</p>
          ${item.afmeting || (item.kleuren && item.kleuren.length) ? `
          <div class="specs">
            <dl>
              ${item.afmeting ? `<dt>Afmeting</dt><dd>${escapeHtml(item.afmeting)}</dd>` : ''}
              ${item.kleuren?.length ? `<dt>Kleuren</dt><dd>${item.kleuren.map(escapeHtml).join(', ')}</dd>` : ''}
            </dl>
          </div>` : ''}
          ${koopbaar ? `
            <div class="postcode-box">
              <label for="pc">ðŸ“ Waar woon je? (postcode)</label>
              <input id="pc" type="text" maxlength="7" inputmode="numeric" placeholder="bv. 5074" oninput="checkPostcode(this, document.getElementById('pc-result'))">
              <span id="pc-result" class="postcode-result"></span>
            </div>` : ''}
        </div>

        <!-- Tab: Reviews -->
        <div class="product-tab-pane" id="prod-tab-reviews">
          <div id="reviews-sectie">
            <div id="reviews-lijst"><p class="cd-hint">Reviews laden... ðŸ§¶</p></div>
            <div class="review-form">
              <h4>Jouw ervaring ðŸ’</h4>
              <p class="cd-hint">Heb je iets besteld bij Pleun? Deel je ervaring â€” ze stuurt misschien een extra cadeautje ðŸŽ</p>
              <div class="cd-field">
                <input id="rv-naam" type="text" placeholder="Jouw naam (optioneel)">
              </div>
              <div class="rv-stars" id="rv-stars">
                <button data-star="1" aria-label="1 ster">â˜…</button>
                <button data-star="2" aria-label="2 sterren">â˜…</button>
                <button data-star="3" aria-label="3 sterren">â˜…</button>
                <button data-star="4" aria-label="4 sterren">â˜…</button>
                <button data-star="5" aria-label="5 sterren">â˜…</button>
              </div>
              <div class="cd-field">
                <textarea id="rv-tekst" rows="3" placeholder="Schrijf je review hier... (verplicht)"></textarea>
              </div>
              <button class="btn full" id="rv-verstuur">ðŸ’ Review versturen</button>
              <p id="rv-status" class="cd-hint" style="display:none;margin-top:0.5em"></p>
            </div>
          </div>
        </div>

        <!-- Bestel-acties â€” altijd zichtbaar -->
        ${koopbaar ? `
          <div class="bestel-acties" style="margin-top:var(--gap-md)">
            <button class="btn full" id="btn-bestel-direct">
              ðŸ’¬ ${escapeHtml(cfg.whatsappLabel)} â€” ik wil deze!
            </button>
            <button class="btn secondary full" id="btn-cart-add">
              ðŸŽ Voeg toe aan verzameldoos
            </button>
          </div>
        ` : showcase ? `
          <div class="offerte-form" style="margin-top:var(--gap-md)">
            <h3>ðŸ“ Vraag een eigen versie aan</h3>
            <p class="cd-hint">Vertel wat je wil â€” ik kijk wat ik voor je kan haken! ðŸ’</p>
            <div class="cd-field">
              <input id="of-afmeting" type="text" placeholder="Gewenste afmeting (optioneel, bv. 15 cm)">
            </div>
            <div class="cd-field">
              <input id="of-kleur" type="text" placeholder="Kleur of stijl (optioneel, bv. lichtroze + wit)">
            </div>
            <div class="cd-field">
              <input id="of-deadline" type="text" placeholder="Gewenste deadline (optioneel, bv. voor 20 juni)">
            </div>
            <div class="cd-field">
              <input id="of-wensen" type="text" placeholder="Andere wensen (optioneel)">
            </div>
            <button class="btn full" onclick="window.verstuurOfferte('${escapeHtml(item.naam)}')">
              ðŸ’¬ Stuur aanvraag via WhatsApp
            </button>
          </div>
        ` : binnenkort ? `
          <div class="bestel-acties" style="margin-top:var(--gap-md)">
            <a class="btn mustard full" href="${cfg.channelInviteUrl}" target="_blank" rel="noopener">
              ðŸ”” Volg het kanaal â€” krijg launch-bericht
            </a>
          </div>
        ` : archief ? `
          <div class="bestel-acties" style="margin-top:var(--gap-md)">
            <p style="color:var(--c-muted); font-size:0.95rem; line-height:1.5">
              ðŸ’ Dit item heb ik ooit gemaakt â€” niet meer te koop, maar leuk om te laten zien!
              Heb je een vraag, of wil je iets soortgelijks op maat?
            </p>
            <a class="btn full" href="${window.orderUrl('Hoi Pleun! ðŸ’ Ik zag op je website dat je ooit een ' + item.naam + ' hebt gemaakt. Ik heb daar een vraag over!')}" target="_blank" rel="noopener">
              ðŸ’¬ Stel een vraag
            </a>
            <a class="btn secondary full" href="${window.orderUrl('Hoi Pleun! ðŸ’ Ik zag de ' + item.naam + ' op je website. Zou je iets soortgelijks voor mij op maat kunnen haken?')}" target="_blank" rel="noopener">
              ðŸ’Œ Vraag een eigen versie
            </a>
          </div>
        ` : `
          <div class="bestel-acties" style="margin-top:var(--gap-md)">
            <p style="color:var(--c-muted)">Dit item is uitverkocht. Wil je iets soortgelijks op maat?</p>
            <a class="btn secondary full" href="${window.orderUrl('Hoi Pleun! Ik zag dat ' + item.naam + ' uitverkocht is. Kun je iets soortgelijks op maat haken?')}" target="_blank" rel="noopener">
              ðŸ’Œ Vraag een nieuwe aan
            </a>
          </div>
        `}
      </div>
    `;
    document.title = item.naam + ' Â· Hooked by Pleun';

    // ===== Variant-keuze + foto-gallery interactie =====
    let huidigeVariantIdx = 0;
    let kleurGekozen = !heeftMeerKleuren; // true voor items zonder varianten

    function huidigeVariant() { return varianten[huidigeVariantIdx]; }

    // Vervolg-actie nadat kleur gekozen is via de modal â€” bv. "voeg toe aan cart"
    let _pendingActionAfterColor = null;

    function toonKleurModal(vervolgActie) {
      _pendingActionAfterColor = vervolgActie || null;
      let modal = document.getElementById('kleur-keuze-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'kleur-keuze-modal';
        modal.className = 'kleur-modal-overlay';
        document.body.appendChild(modal);
      }
      const knoppen = varianten.map((v, i) => `
        <button class="kleur-modal-knop" data-vi="${i}" type="button">
          <span class="kleur-dot-groot" style="background:${KLEUR_HEX[String(v.kleur || '').toLowerCase().trim()] || '#D9C5A8'}"></span>
          <span class="kleur-naam">${escapeHtml(v.kleur || 'â€” geen naam â€”')}</span>
        </button>
      `).join('');
      modal.innerHTML = `
        <div class="kleur-modal-card" role="dialog" aria-modal="true">
          <button class="kleur-modal-close" aria-label="Sluiten" type="button">&times;</button>
          <h3>ðŸŽ¨ Welke kleur wil je?</h3>
          <p>Klik op een kleur om door te gaan met je bestelling.</p>
          <div class="kleur-modal-grid">${knoppen}</div>
        </div>
      `;
      modal.classList.add('open');
      // Listener: kleur-knop in modal
      modal.querySelectorAll('.kleur-modal-knop').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.vi);
          // Markeer ook de hoofd-kleur-knop op de pagina als actief
          document.querySelectorAll('.kleur-knop').forEach((b, i) => b.classList.toggle('actief', i === idx));
          selectVariant(idx);
          modal.classList.remove('open');
          if (typeof _pendingActionAfterColor === 'function') {
            const fn = _pendingActionAfterColor;
            _pendingActionAfterColor = null;
            fn();
          }
        });
      });
      // Sluitknop + klik op overlay
      modal.querySelector('.kleur-modal-close').addEventListener('click', () => {
        modal.classList.remove('open');
        _pendingActionAfterColor = null;
      });
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          modal.classList.remove('open');
          _pendingActionAfterColor = null;
        }
      });
    }

    // Kleur selecteren = bestel-keuze registreren + hoofdfoto springen; thumbs blijven compleet
    function selectVariant(idx) {
      huidigeVariantIdx = idx;
      kleurGekozen = true;
      document.getElementById('kleur-hint')?.classList.remove('zichtbaar');
      const v = huidigeVariant();
      const fotos = v.fotos || [];
      const hoofd = document.getElementById('foto-hoofd');
      if (hoofd && fotos[0]) hoofd.src = fotos[0];
      document.querySelectorAll('.foto-thumb').forEach(t => {
        t.classList.toggle('actief', t.dataset.foto === fotos[0]);
      });
      const kleurEl = document.getElementById('huidige-kleur');
      if (kleurEl) kleurEl.textContent = v.kleur;
    }

    // Klik op kleur-knop â†’ bestel-keuze + springt naar eerste foto van die kleur
    document.querySelectorAll('.kleur-knop').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.variantIdx);
        document.querySelectorAll('.kleur-knop').forEach(b => b.classList.remove('actief'));
        btn.classList.add('actief');
        selectVariant(idx);
      });
    });

    // Klik op thumbnail â†’ hoofdfoto wisselen (variant-keuze ongewijzigd)
    wrap.addEventListener('click', e => {
      const t = e.target.closest('.foto-thumb');
      if (!t) return;
      const foto = t.dataset.foto;
      const hoofd = document.getElementById('foto-hoofd');
      if (hoofd && foto) hoofd.src = foto;
      document.querySelectorAll('.foto-thumb').forEach(b => b.classList.remove('actief'));
      t.classList.add('actief');
    });

    // Bestel-knoppen â€” gebruik huidige variant; herinnering als kleur nog niet gekozen
    function huidigeCartItem() {
      const v = huidigeVariant();
      const variantSuffix = (varianten.length > 1 && v.kleur) ? `|${v.kleur}` : '';
      return {
        id: item.id + variantSuffix,
        baseId: item.id,
        naam: item.naam + (variantSuffix ? ` (${v.kleur})` : ''),
        kleur: v.kleur || '',
        prijs: item.prijs,
        foto: v.fotos?.[0] || item.foto,
        categorie: item.categorie,
        verzendklasse: item.verzendklasse,
      };
    }
    document.getElementById('btn-bestel-direct')?.addEventListener('click', () => {
      if (!kleurGekozen) {
        toonKleurModal(() => window.openCheckout(huidigeCartItem()));
        return;
      }
      window.openCheckout(huidigeCartItem());
    });
    document.getElementById('btn-cart-add')?.addEventListener('click', () => {
      if (!kleurGekozen) {
        toonKleurModal(() => {
          Cart.add(huidigeCartItem());
          document.querySelector("#cart-overlay")?.classList.add("open");
        });
        return;
      }
      Cart.add(huidigeCartItem());
      document.querySelector("#cart-overlay")?.classList.add("open");
    });

    // Reviews sectie laden
    loadReviewsForProduct(item.id, item.naam);
  }

  async function loadReviewsForProduct(productId, productNaam) {
    try {
      const res = await fetch('data/reviews.json?v=' + Date.now());
      const data = await res.json();
      const goedgekeurd = (data.reviews || []).filter(r => r.productId === productId && r.status === 'approved');
      const lijst = document.getElementById('reviews-lijst');
      if (!lijst) return;

      // Badge in tab-knop bijwerken
      const badge = document.getElementById('rv-tab-badge');
      if (badge && goedgekeurd.length > 0) {
        badge.textContent = goedgekeurd.length;
        badge.style.display = '';
      }

      if (goedgekeurd.length === 0) {
        lijst.innerHTML = '<p class="cd-hint">Nog geen reviews â€” wees de eerste! ðŸŒ¸</p>';
      } else {
        lijst.innerHTML = goedgekeurd.map(r => `
          <div class="review-kaart">
            <div class="rv-sterren">${'â˜…'.repeat(r.rating || 5)}${'â˜†'.repeat(5 - (r.rating || 5))}</div>
            <p class="rv-tekst">"${escapeHtml(r.tekst)}"</p>
            <p class="rv-naam">â€” ${escapeHtml(r.naam || 'Anoniem')} Â· ${r.datum || ''}</p>
          </div>`).join('');
      }
    } catch {
      const lijst = document.getElementById('reviews-lijst');
      if (lijst) lijst.innerHTML = '';
    }

    // Review submit
    const verstuurBtn = document.getElementById('rv-verstuur');
    if (verstuurBtn) {
      let rvRating = 5;
      const sterren = document.querySelectorAll('#rv-stars button');
      sterren.forEach(btn => {
        btn.addEventListener('click', () => {
          rvRating = parseInt(btn.dataset.star);
          sterren.forEach(b => b.classList.toggle('actief', parseInt(b.dataset.star) <= rvRating));
        });
      });
      // Toon standaard 5 sterren
      sterren.forEach(b => b.classList.add('actief'));

      verstuurBtn.addEventListener('click', async () => {
        const tekst = document.getElementById('rv-tekst')?.value.trim();
        const naam = document.getElementById('rv-naam')?.value.trim();
        const status = document.getElementById('rv-status');
        if (!tekst || tekst.length < 5) {
          if (status) { status.textContent = 'Schrijf eerst een reviewtekst ðŸ’'; status.style.display = ''; }
          return;
        }
        verstuurBtn.disabled = true;
        verstuurBtn.textContent = 'â³ Versturen...';
        try {
          const cfg = window.SHOP_CONFIG || {};
          const res = await fetch((cfg.workerUrl || '').replace(/\/$/, '') + '/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, productNaam, naam, tekst, rating: rvRating }),
          });
          if (!res.ok) throw new Error('Server error');
          if (status) { status.textContent = 'ðŸ’ Dankjewel! Pleun leest hem snel.'; status.style.display = ''; }
          verstuurBtn.textContent = 'âœ… Verstuurd!';
          document.getElementById('rv-tekst').value = '';
          document.getElementById('rv-naam').value = '';
        } catch {
          if (status) { status.textContent = 'ðŸ˜• Niet gelukt. Probeer opnieuw.'; status.style.display = ''; }
          verstuurBtn.disabled = false;
          verstuurBtn.textContent = 'ðŸ’ Review versturen';
        }
      });
    }
  }

  // ===== Product-tab wisselen =====
  window.showProductTab = function(name) {
    document.querySelectorAll('.product-tab-pane').forEach(p => p.classList.remove('actief'));
    document.querySelectorAll('.product-tabs-bar button').forEach(b => {
      const isActive = b.getAttribute('onclick')?.includes(`'${name}'`);
      b.classList.toggle('actief', isActive);
    });
    const pane = document.getElementById('prod-tab-' + name);
    if (pane) pane.classList.add('actief');
  };

  // ===== Offerte-aanvraag voor showcase-items =====
  window.verstuurOfferte = function(itemNaam) {
    const afmeting = document.getElementById('of-afmeting')?.value.trim();
    const kleur    = document.getElementById('of-kleur')?.value.trim();
    const deadline = document.getElementById('of-deadline')?.value.trim();
    const wensen   = document.getElementById('of-wensen')?.value.trim();
    let bericht = `ðŸ“ Offerte aanvraag â€” ${itemNaam}\n\nHoi Pleun! Ik wil graag een ${itemNaam} op maat laten haken.`;
    if (afmeting) bericht += `\n\nAfmeting: ${afmeting}`;
    if (kleur)    bericht += `\nKleur/stijl: ${kleur}`;
    if (deadline) bericht += `\nDeadline: ${deadline}`;
    if (wensen)   bericht += `\nWensen: ${wensen}`;
    bericht += '\n\nKan je dit maken? Wat zijn de kosten?';
    window.open(window.orderUrl(bericht), '_blank');
  };

  // ===== Marketing: WhatsApp-kanaal-link + Countdown =====
  function renderKanaalLink() {
    const link = document.getElementById('kanaal-link');
    const cta  = document.getElementById('countdown-cta');
    const url  = window.SHOP_CONFIG.channelInviteUrl;
    if (link) link.href = url;
    if (cta)  cta.href  = url;
  }

  function startCountdown() {
    const box = document.getElementById('launch-countdown');
    if (!box) return;
    // Doel: zondag 10 mei 2026 12:00 NL-tijd
    const target = new Date('2026-05-10T12:00:00+02:00').getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { box.style.display = 'none'; return; }
      box.style.display = 'block';
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      document.getElementById('ct-d').textContent = d;
      document.getElementById('ct-h').textContent = String(h).padStart(2, '0');
      document.getElementById('ct-m').textContent = String(m).padStart(2, '0');
      document.getElementById('ct-s').textContent = String(s).padStart(2, '0');
    };
    tick();
    setInterval(tick, 1000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHome();
    renderGalerij();
    renderArchief();
    renderProduct();
    renderKanaalLink();
    startCountdown();
    initShopReviewForm();
  });
})();

// Nav-meer dropdown verwijderd in v3.5.1 â€” Eerder gemaakt is nu directe tab.
