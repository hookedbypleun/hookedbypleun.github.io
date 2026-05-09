// Crochet by Pleun — Hoofd-applicatielogica
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
    return '€' + p.toFixed(2).replace('.', ',');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function tagHTML(item) {
    const tags = [];
    if (item.status === 'uitverkocht') tags.push('<span class="tag uitverkocht">Verkocht 💕</span>');
    else if (item.status === 'binnenkort') tags.push('<span class="tag binnenkort">Binnenkort ✨</span>');
    else if (item.status === 'showcase') tags.push('<span class="tag showcase">Op maat</span>');
    else if (item.afgeprijsd) tags.push('<span class="tag afgeprijsd">Sale!</span>');
    else if (item.nieuw) tags.push('<span class="tag nieuw">Nieuw 🌸</span>');
    if (item.uitgelicht && item.status !== 'uitverkocht') tags.push('<span class="tag uitgelicht">Favoriet</span>');
    if (item.eigenPatroon) tags.push('<span class="tag eigen">⭐ Eigen ontwerp</span>');
    return tags.join('');
  }

  function prijsHTML(item) {
    if (item.status === 'showcase' || item.status === 'binnenkort' || item.prijs === 0) {
      return `<p class="prijs">${item.status === 'binnenkort' ? '✨ binnenkort' : item.opMaat ? 'op maat' : '—'}</p>`;
    }
    if (item.prijsOud) {
      return `<p class="prijs"><span class="prijs-oud">${fmtPrijs(item.prijsOud)}</span>${fmtPrijs(item.prijs)}${item.perStuk ? ' / stuk' : ''}</p>`;
    }
    return `<p class="prijs">${fmtPrijs(item.prijs)}${item.perStuk ? ' / stuk' : ''}</p>`;
  }

  function kaartHTML(item) {
    const sold = item.status === 'uitverkocht';
    return `
      <a href="product.html?id=${encodeURIComponent(item.id)}" class="item-kaart ${sold ? 'uitverkocht' : ''}">
        <div class="foto">
          ${tagHTML(item)}
          <img src="${item.foto}" alt="${escapeHtml(item.naam)}" loading="lazy" onerror="this.style.background='#FAF6EE'">
        </div>
        <div class="info">
          <h3>${escapeHtml(item.naam)}</h3>
          ${prijsHTML(item)}
          ${item.afmeting ? `<p class="meta">${item.afmeting}</p>` : ''}
        </div>
      </a>`;
  }

  // ===== Home =====
  async function renderHome() {
    const grid = document.getElementById('home-uitgelicht');
    if (!grid) return;
    const data = await loadData();
    const uitgelicht = data.items.filter(i => i.uitgelicht && i.status !== 'uitverkocht').slice(0, 4);
    grid.innerHTML = uitgelicht.map(kaartHTML).join('') ||
      '<p class="leeg">Nog geen items 🧶</p>';

    const nieuwGrid = document.getElementById('home-nieuw');
    if (nieuwGrid) {
      const sorted = [...data.items]
        .filter(i => i.status === 'beschikbaar')
        .sort((a, b) => (b.datumToegevoegd || '').localeCompare(a.datumToegevoegd || ''))
        .slice(0, 6);
      nieuwGrid.innerHTML = sorted.map(kaartHTML).join('');
    }

    // Reviews-blok op homepage
    const reviewsGrid = document.getElementById('home-reviews');
    const reviewsSectie = document.getElementById('home-reviews-section');
    if (reviewsGrid && reviewsSectie) {
      try {
        const rvRes = await fetch('data/reviews.json?v=' + Date.now());
        const rvData = await rvRes.json();
        const uitgelicht = (rvData.reviews || []).filter(r => r.status === 'approved' && r.uitgelicht).slice(0, 3);
        if (uitgelicht.length > 0) {
          reviewsGrid.innerHTML = uitgelicht.map(r => `
            <div class="review-kaart">
              <div class="rv-sterren">${'★'.repeat(r.rating || 5)}</div>
              <p class="rv-tekst">"${escapeHtml(r.tekst)}"</p>
              <p class="rv-naam">— ${escapeHtml(r.naam || 'Anoniem')}</p>
              ${r.productNaam ? `<p class="rv-product"><a href="product.html?id=${encodeURIComponent(r.productId)}">${escapeHtml(r.productNaam)}</a></p>` : ''}
            </div>`).join('');
          reviewsSectie.style.display = '';
        }
      } catch {}
    }
  }

  // ===== Galerij =====
  async function renderGalerij() {
    const grid = document.getElementById('galerij-grid');
    const filterBalk = document.getElementById('filter-balk');
    if (!grid) return;
    const data = await loadData();

    const cats = data.categories.sort((a, b) => a.volgorde - b.volgorde);

    let huidig = (new URL(location.href)).searchParams.get('cat') || 'alle';
    let huidigSort = 'datum';

    function render() {
      const filtered = huidig === 'alle' ? data.items : data.items.filter(i => i.categorie === huidig);
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
        : '<p class="leeg">In deze categorie zitten nog geen items. Pleun haakt eraan! 🧶</p>';
    }

    if (filterBalk) {
      filterBalk.innerHTML = `
        <button data-cat="alle" class="${huidig === 'alle' ? 'actief' : ''}">Alles</button>
        ${cats.map(c => {
          const aantal = data.items.filter(i => i.categorie === c.id).length;
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

    const sortBalk = document.getElementById('sort-balk');
    if (sortBalk) {
      sortBalk.style.display = '';
      sortBalk.addEventListener('click', e => {
        const b = e.target.closest('button[data-sort]');
        if (!b) return;
        huidigSort = b.dataset.sort;
        sortBalk.querySelectorAll('button').forEach(x => x.classList.toggle('actief', x.dataset.sort === huidigSort));
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
      wrap.innerHTML = '<p class="leeg">Dit haakwerk konden we niet vinden 🧶 <a href="galerij.html">Terug naar de galerij</a></p>';
      return;
    }

    const cfg = window.SHOP_CONFIG;
    const sold = item.status === 'uitverkocht';
    const showcase = item.status === 'showcase';
    const binnenkort = item.status === 'binnenkort';
    const koopbaar = item.status === 'beschikbaar';
    const cat = data.categories.find(c => c.id === item.categorie);

    const bericht =
`Hoi Pleun! 💝

Ik heb interesse in: ${item.naam}${item.prijs ? ' (' + fmtPrijs(item.prijs) + ')' : ''}.

Mijn naam:
Mijn postcode + adres:
Lokaal afhalen of versturen?`;

    wrap.innerHTML = `
      <div class="foto-groot">
        <img src="${item.foto}" alt="${escapeHtml(item.naam)}">
      </div>
      <div class="product-info">
        <p class="meta"><a href="galerij.html?cat=${item.categorie}">${cat?.emoji || ''} ${escapeHtml(cat?.naam || '')}</a></p>
        <h1>${escapeHtml(item.naam)}</h1>
        <div class="prijs-groot">
          ${item.prijsOud ? `<span class="prijs-oud-groot">${fmtPrijs(item.prijsOud)}</span>` : ''}
          ${koopbaar || item.afgeprijsd ? fmtPrijs(item.prijs) + (item.perStuk ? ' / stuk' : '') :
            sold ? '<span style="color:var(--c-sold)">Verkocht 💕</span>' :
            binnenkort ? '<span style="color:var(--c-mustard-dark)">Binnenkort ✨</span>' :
            showcase ? '<span style="color:var(--c-lavender-dark)">Op maat</span>' : '—'}
        </div>

        ${item.eigenPatroon ? `
          <div class="eigen-spotlight">
            ⭐ <strong>100% Pleun's eigen ontwerp</strong> — geen patroon van internet, helemaal zelf bedacht. Een stuk Pleun in haakvorm 💝
          </div>
        ` : ''}

        <!-- Tab-balk -->
        <div class="product-tabs-bar">
          <button class="actief" onclick="window.showProductTab('info')">📦 Over dit item</button>
          <button onclick="window.showProductTab('reviews')">💬 Reviews <span class="rv-count-badge" id="rv-tab-badge" style="display:none">0</span></button>
        </div>

        <!-- Tab: Info -->
        <div class="product-tab-pane actief" id="prod-tab-info">
          <p class="beschrijving">${escapeHtml(item.beschrijving)}</p>
          ${item.afmeting || (item.kleuren && item.kleuren.length) || item.voorraad > 0 ? `
          <div class="specs">
            <dl>
              ${item.afmeting ? `<dt>Afmeting</dt><dd>${escapeHtml(item.afmeting)}</dd>` : ''}
              ${item.kleuren?.length ? `<dt>Kleuren</dt><dd>${item.kleuren.map(escapeHtml).join(', ')}</dd>` : ''}
              ${item.voorraad > 0 ? `<dt>Voorraad</dt><dd>${item.voorraad} stuk${item.voorraad > 1 ? 's' : ''}</dd>` : ''}
            </dl>
          </div>` : ''}
          ${koopbaar ? `
            <div class="postcode-box">
              <label for="pc">📍 Waar woon je? (postcode)</label>
              <input id="pc" type="text" maxlength="7" inputmode="numeric" placeholder="bv. 5074" oninput="checkPostcode(this, document.getElementById('pc-result'))">
              <span id="pc-result" class="postcode-result"></span>
            </div>` : ''}
        </div>

        <!-- Tab: Reviews -->
        <div class="product-tab-pane" id="prod-tab-reviews">
          <div id="reviews-sectie">
            <div id="reviews-lijst"><p class="cd-hint">Reviews laden... 🧶</p></div>
            <div class="review-form">
              <h4>Jouw ervaring 💝</h4>
              <p class="cd-hint">Heb je iets besteld bij Pleun? Deel je ervaring — ze stuurt misschien een extra cadeautje 🎁</p>
              <div class="cd-field">
                <input id="rv-naam" type="text" placeholder="Jouw naam (optioneel)">
              </div>
              <div class="rv-stars" id="rv-stars">
                <button data-star="1" aria-label="1 ster">★</button>
                <button data-star="2" aria-label="2 sterren">★</button>
                <button data-star="3" aria-label="3 sterren">★</button>
                <button data-star="4" aria-label="4 sterren">★</button>
                <button data-star="5" aria-label="5 sterren">★</button>
              </div>
              <div class="cd-field">
                <textarea id="rv-tekst" rows="3" placeholder="Schrijf je review hier... (verplicht)"></textarea>
              </div>
              <button class="btn full" id="rv-verstuur">💝 Review versturen</button>
              <p id="rv-status" class="cd-hint" style="display:none;margin-top:0.5em"></p>
            </div>
          </div>
        </div>

        <!-- Bestel-acties — altijd zichtbaar -->
        ${koopbaar ? `
          <div class="bestel-acties" style="margin-top:var(--gap-md)">
            <button class="btn full" onclick='window.openCheckout(${JSON.stringify({id: item.id, naam: item.naam, prijs: item.prijs, foto: item.foto, categorie: item.categorie, verzendklasse: item.verzendklasse})})'>
              💬 ${escapeHtml(cfg.whatsappLabel)} — ik wil deze!
            </button>
            <button class="btn secondary full" onclick='Cart.add(${JSON.stringify({id: item.id, naam: item.naam, prijs: item.prijs, foto: item.foto, categorie: item.categorie, verzendklasse: item.verzendklasse, voorraad: item.voorraad || 0})}); document.querySelector("#cart-overlay").classList.add("open");'>
              🎁 Voeg toe aan verzameldoos
            </button>
          </div>
        ` : showcase ? `
          <div class="offerte-form" style="margin-top:var(--gap-md)">
            <h3>📐 Vraag een eigen versie aan</h3>
            <p class="cd-hint">Vertel wat je wil — ik kijk wat ik voor je kan haken! 💝</p>
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
              💬 Stuur aanvraag via WhatsApp
            </button>
          </div>
        ` : binnenkort ? `
          <div class="bestel-acties" style="margin-top:var(--gap-md)">
            <a class="btn mustard full" href="${cfg.channelInviteUrl}" target="_blank" rel="noopener">
              🔔 Volg het kanaal — krijg launch-bericht
            </a>
          </div>
        ` : `
          <div class="bestel-acties" style="margin-top:var(--gap-md)">
            <p style="color:var(--c-muted)">Dit item is uitverkocht. Wil je iets soortgelijks op maat?</p>
            <a class="btn secondary full" href="${window.orderUrl('Hoi Pleun! Ik zag dat ' + item.naam + ' uitverkocht is. Kun je iets soortgelijks op maat haken?')}" target="_blank" rel="noopener">
              💌 Vraag een nieuwe aan
            </a>
          </div>
        `}
      </div>
    `;
    document.title = item.naam + ' · Hooked by Pleun';

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
        lijst.innerHTML = '<p class="cd-hint">Nog geen reviews — wees de eerste! 🌸</p>';
      } else {
        lijst.innerHTML = goedgekeurd.map(r => `
          <div class="review-kaart">
            <div class="rv-sterren">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</div>
            <p class="rv-tekst">"${escapeHtml(r.tekst)}"</p>
            <p class="rv-naam">— ${escapeHtml(r.naam || 'Anoniem')} · ${r.datum || ''}</p>
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
          if (status) { status.textContent = 'Schrijf eerst een reviewtekst 💝'; status.style.display = ''; }
          return;
        }
        verstuurBtn.disabled = true;
        verstuurBtn.textContent = '⏳ Versturen...';
        try {
          const cfg = window.SHOP_CONFIG || {};
          const res = await fetch((cfg.workerUrl || '').replace(/\/$/, '') + '/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, productNaam, naam, tekst, rating: rvRating }),
          });
          if (!res.ok) throw new Error('Server error');
          if (status) { status.textContent = '💝 Dankjewel! Pleun leest hem snel.'; status.style.display = ''; }
          verstuurBtn.textContent = '✅ Verstuurd!';
          document.getElementById('rv-tekst').value = '';
          document.getElementById('rv-naam').value = '';
        } catch {
          if (status) { status.textContent = '😕 Niet gelukt. Probeer opnieuw.'; status.style.display = ''; }
          verstuurBtn.disabled = false;
          verstuurBtn.textContent = '💝 Review versturen';
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
    let bericht = `📐 Offerte aanvraag — ${itemNaam}\n\nHoi Pleun! Ik wil graag een ${itemNaam} op maat laten haken.`;
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
    renderProduct();
    renderKanaalLink();
    startCountdown();
  });
})();
