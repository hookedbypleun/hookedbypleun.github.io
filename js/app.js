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
        <p class="beschrijving">${escapeHtml(item.beschrijving)}</p>

        ${item.eigenPatroon ? `
          <div class="eigen-spotlight">
            ⭐ <strong>100% Pleun's eigen ontwerp</strong> — geen patroon van internet, helemaal zelf bedacht. Een stuk Pleun in haakvorm 💝
          </div>
        ` : ''}

        ${item.afmeting || (item.kleuren && item.kleuren.length) ? `
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
          </div>

          <div class="bestel-acties">
            <button class="btn full" onclick='window.openCheckout(${JSON.stringify({id: item.id, naam: item.naam, prijs: item.prijs, foto: item.foto, categorie: item.categorie, verzendklasse: item.verzendklasse})})'>
              💬 ${escapeHtml(cfg.whatsappLabel)} — ik wil deze!
            </button>
            <button class="btn secondary full" onclick='Cart.add(${JSON.stringify({id: item.id, naam: item.naam, prijs: item.prijs, foto: item.foto, categorie: item.categorie, verzendklasse: item.verzendklasse})}); document.querySelector("#cart-overlay").classList.add("open");'>
              🎁 Voeg toe aan verzameldoos
            </button>
          </div>
        ` : showcase ? `
          <div class="bestel-acties">
            <a class="btn full" href="${window.orderUrl('Hoi Pleun! Ik wil graag een ' + item.naam + ' op maat laten haken. Kunnen we de details bespreken?')}" target="_blank" rel="noopener">
              💝 Vraag een eigen versie aan
            </a>
          </div>
        ` : binnenkort ? `
          <div class="bestel-acties">
            <a class="btn mustard full" href="${cfg.channelInviteUrl}" target="_blank" rel="noopener">
              🔔 Volg het kanaal — krijg launch-bericht
            </a>
          </div>
        ` : `
          <div class="bestel-acties">
            <p style="color:var(--c-muted)">Dit item is uitverkocht. Wil je iets soortgelijks op maat?</p>
            <a class="btn secondary full" href="${window.orderUrl('Hoi Pleun! Ik zag dat ' + item.naam + ' uitverkocht is. Kun je iets soortgelijks op maat haken?')}" target="_blank" rel="noopener">
              💌 Vraag een nieuwe aan
            </a>
          </div>
        `}
      </div>
    `;
    document.title = item.naam + ' · Hooked by Pleun';
  }

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
