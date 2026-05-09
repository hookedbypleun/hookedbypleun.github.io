// Verzameldoos — items verzamelen voor 1 bestelling.
// LocalStorage zodat hij blijft staan als je tussen pagina's klikt.

// Globale helper: bouwt de juiste WhatsApp-bestel-URL.
// Als workerUrl is ingesteld, gaat het via de Cloudflare Worker (nummer blijft verborgen).
// Anders fallback naar directe wa.me link.
window.orderUrl = function(text) {
  const cfg = window.SHOP_CONFIG || {};
  const txt = encodeURIComponent(text || '');
  if (cfg.workerUrl) {
    return cfg.workerUrl.replace(/\/$/, '') + '/order?text=' + txt;
  }
  return 'https://wa.me/' + (cfg.whatsappNumber || '') + '?text=' + txt;
};

(function() {
  const STORAGE_KEY = 'pleun_cart_v1';

  function read()  { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
  function write(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); updateCartUI(); }

  window.Cart = {
    items: () => read(),
    count: () => read().reduce((s, i) => s + (i.aantal || 1), 0),
    total: () => read().reduce((s, i) => s + (i.prijs || 0) * (i.aantal || 1), 0),
    add(item) {
      const arr = read();
      const existing = arr.find(i => i.id === item.id);
      if (existing) {
        existing.aantal = (existing.aantal || 1) + 1;
        write(arr);
        showToast(`✨ ${item.naam} × ${existing.aantal}!`);
        return;
      }
      arr.push({
        id: item.id,
        baseId: item.baseId || item.id,
        naam: item.naam,
        kleur: item.kleur || '',
        prijs: item.prijs,
        foto: item.foto,
        categorie: item.categorie,
        verzendklasse: item.verzendklasse,
        aantal: 1,
      });
      write(arr);
      showToast(`✨ ${item.naam} toegevoegd!`);
    },
    remove(id) {
      write(read().filter(i => i.id !== id));
    },
    increment(id) {
      const arr = read();
      const item = arr.find(i => i.id === id);
      if (!item) return;
      item.aantal = (item.aantal || 1) + 1;
      write(arr);
    },
    decrement(id) {
      const arr = read();
      const item = arr.find(i => i.id === id);
      if (!item) return;
      if ((item.aantal || 1) <= 1) { write(arr.filter(i => i.id !== id)); return; }
      item.aantal = item.aantal - 1;
      write(arr);
    },
    clear() { write([]); },
  };

  // ============================================================
  // Verzending berekening — slim 3-tarief systeem
  // ============================================================
  // Hierarchie: brief < brievenbus < pakket. Cart krijgt het hoogste benodigde tarief.
  const VERZEND_RANG = { brief: 1, brievenbus: 2, pakket: 3 };

  function getShippingClass(item, cfg) {
    if (item.verzendklasse && cfg.shipping?.[item.verzendklasse]) return item.verzendklasse;
    return cfg.verzendklassen?.[item.categorie] || 'brievenbus';
  }

  function calculateShipping(items, cfg) {
    if (!items.length || !cfg.shipping) return { klasse: 'brievenbus', kosten: 0, gratis: true, info: cfg.shipping?.brievenbus, gap: 0 };
    let topKlasse = 'brief';
    items.forEach(it => {
      const k = getShippingClass(it, cfg);
      if (VERZEND_RANG[k] > VERZEND_RANG[topKlasse]) topKlasse = k;
    });
    const subtotaal = items.reduce((s, i) => s + i.prijs, 0);
    const drempel = cfg.freeShippingThreshold || 0;
    const gratis = subtotaal >= drempel;
    const info = cfg.shipping[topKlasse];
    return {
      klasse: topKlasse,
      info,
      kosten: gratis ? 0 : info.prijs,
      gratis,
      gap: Math.max(0, drempel - subtotaal),
      drempel,
      subtotaal,
    };
  }
  // Expose voor andere modules
  window.calculateShipping = (items) => calculateShipping(items, window.SHOP_CONFIG || {});

  function updateCartUI() {
    const count = read().length;
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count;
      el.classList.toggle('empty', count === 0);
    });
    renderCartModal();
  }

  function renderCartModal() {
    const list = document.querySelector('#cart-list');
    const summary = document.querySelector('#cart-summary');
    if (!list || !summary) return;
    const items = read();

    if (items.length === 0) {
      list.innerHTML = '<li class="cart-empty">Je verzameldoos is nog leeg 🌸<br>Voeg lieve dingen toe en bestel ze in één keer!</li>';
      summary.style.display = 'none';
      const checkout = document.querySelector('#cart-checkout');
      if (checkout) checkout.style.display = 'none';
      return;
    }

    list.innerHTML = items.map(i => {
      const n = i.aantal || 1;
      const totaalPrijs = (i.prijs * n).toFixed(2).replace('.', ',');
      return `
      <li>
        <a class="cart-item-link" href="product.html?id=${encodeURIComponent(i.baseId || i.id)}">
          <img src="${i.foto}" alt="${escapeHtml(i.naam)}">
          <span class="name">${escapeHtml(i.naam)}</span>
        </a>
        <div class="cart-qty">
          <button class="qty-btn" onclick="Cart.decrement('${i.id}')" aria-label="Minder">−</button>
          <span class="qty-num">${n}</span>
          <button class="qty-btn" onclick="Cart.increment('${i.id}')" aria-label="Meer">+</button>
        </div>
        <span class="price">€${totaalPrijs}</span>
        <button class="remove" onclick="Cart.remove('${i.id}')" aria-label="Verwijderen">×</button>
      </li>`;
    }).join('');

    const subtotal = items.reduce((s, i) => s + i.prijs * (i.aantal || 1), 0);
    const cfg = window.SHOP_CONFIG;
    const ship = calculateShipping(items, cfg);
    const eindtotaal = subtotal + ship.kosten;

    // Spaarmeter: hoe ver van gratis verzending?
    let progressHtml = '';
    if (!ship.gratis && ship.drempel > 0) {
      const pct = Math.min(100, Math.round((ship.subtotaal / ship.drempel) * 100));
      progressHtml = `
        <div class="cart-spaarmeter">
          <div class="spaar-tekst">💡 Nog <strong>€${ship.gap.toFixed(2).replace('.', ',')}</strong> tot gratis verzending!</div>
          <div class="spaar-bar"><div class="spaar-fill" style="width:${pct}%"></div></div>
        </div>`;
    } else if (ship.gratis) {
      progressHtml = `<div class="cart-spaarmeter gratis">🎉 Yay, <strong>gratis verzending</strong> verdiend!</div>`;
    }

    const verzendLabel = ship.gratis
      ? '<strong style="color:#4F8A52">Gratis 💚</strong>'
      : `${ship.info.icon} €${ship.info.prijs.toFixed(2).replace('.', ',')} <small style="color:var(--c-muted)">(${ship.info.label.toLowerCase()})</small>`;

    summary.style.display = 'block';
    summary.innerHTML = `
      <div class="row"><span>${items.length} item${items.length > 1 ? 's' : ''}</span><span>€${subtotal.toFixed(2).replace('.', ',')}</span></div>
      <div class="row">
        <span>Verzending</span>
        <span>${verzendLabel}</span>
      </div>
      <div class="row total"><span>Totaal</span><span>€${eindtotaal.toFixed(2).replace('.', ',')}</span></div>
      ${progressHtml}
    `;

    const checkout = document.querySelector('#cart-checkout');
    if (checkout) checkout.style.display = 'grid';
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // Modal open/close
  document.addEventListener('click', e => {
    if (e.target.matches('[data-cart-open]')) {
      e.preventDefault();
      const overlay = document.querySelector('#cart-overlay');
      if (overlay) { overlay.classList.add('open'); renderCartModal(); }
    }
    if (e.target.matches('.cart-overlay') || e.target.matches('.cart-close')) {
      document.querySelector('#cart-overlay')?.classList.remove('open');
      window.hideCheckoutDetails?.();
    }
  });

  // ================================================================
  // Checkout details — stap 2: verzendgegevens invullen
  // ================================================================

  let _checkout = null;

  function showCheckoutDetails(items, target) {
    const modal = document.querySelector('.cart-modal');
    if (!modal) return;

    const cfg = window.SHOP_CONFIG;
    const total = items.reduce((s, i) => s + i.prijs * (i.aantal || 1), 0);
    const ship = calculateShipping(items, cfg);
    const verzending = ship.kosten;
    const eindTotaal = total + verzending;
    const gratisVerzending = ship.gratis;
    const verzendInfo = ship.info;
    const lijn = items.map((i, n) => {
      const cnt = i.aantal || 1;
      const prefix = cnt > 1 ? `${cnt}× ` : '';
      return `${n + 1}. ${prefix}${i.naam} — €${(i.prijs * cnt).toFixed(2).replace('.', ',')}`;
    }).join('\n');

    _checkout = { target, cfg, lijn, total, gratisVerzending, verzending, eindTotaal, verzendInfo };

    // Verberg bestaande cart-inhoud
    ['cart-list', 'cart-summary', 'cart-checkout'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const desc = modal.querySelector(':scope > p');
    if (desc) desc.style.display = 'none';

    // Maak of hergebruik het details-paneel
    let panel = document.getElementById('checkout-details');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'checkout-details';
      modal.appendChild(panel);
    }

    panel.innerHTML = `
      <button class="checkout-back-btn" onclick="window.hideCheckoutDetails()">← Terug naar verzameldoos</button>
      <div class="checkout-fields">
        <h3>📦 Jouw gegevens <span class="cd-optional">optioneel</span></h3>
        <p class="cd-hint">Vul in voor een kant-en-klaar bericht — of stuur het leeg en typ je adres zelf in WhatsApp.</p>
        <div class="cd-field">
          <input id="cd-naam" type="text" placeholder="Jouw naam" autocomplete="name" oninput="window.updatePreview()">
        </div>
        <div class="cd-field">
          <input id="cd-adres" type="text" placeholder="Straat + huisnummer" autocomplete="street-address" oninput="window.updatePreview()">
        </div>
        <div class="cd-field cd-two-col">
          <input id="cd-postcode" type="text" placeholder="Postcode" maxlength="7" autocomplete="postal-code" oninput="window.updatePreview()">
          <input id="cd-woonplaats" type="text" placeholder="Woonplaats" autocomplete="address-level2" oninput="window.updatePreview()">
        </div>
        <div class="cd-field">
          <input id="cd-notitie" type="text" placeholder="Wensen? (kleur, naam erop, cadeau...)" oninput="window.updatePreview()">
        </div>
        <div class="cd-field">
          <input id="cd-bron" type="text" placeholder="Hoe ken je Hooked by Pleun? (optioneel)" oninput="window.updatePreview()">
          <span class="cd-field-hint">Vind ik leuk om te weten 🌸</span>
        </div>
      </div>
      <div class="checkout-preview">
        <h3>💬 Voorbeeldbericht</h3>
        <p class="cd-hint">Je kunt het bericht hieronder nog aanpassen voordat je het verstuurt.</p>
        <textarea id="cd-message" rows="14" spellcheck="false"></textarea>
      </div>
      <button class="btn full" id="cd-send">💬 Stuur naar WhatsApp</button>
    `;

    panel.style.display = 'block';

    document.getElementById('cd-send').addEventListener('click', function() {
      const msg = document.getElementById('cd-message').value;
      if (target === 'backup' && cfg.whatsappBackup) {
        window.open(`https://wa.me/${cfg.whatsappBackup}?text=${encodeURIComponent(msg)}`, '_blank');
      } else {
        window.open(window.orderUrl(msg), '_blank');
      }
    });

    window.updatePreview();
  }

  window.updatePreview = function() {
    if (!_checkout) return;
    const { lijn, total, gratisVerzending, verzending, eindTotaal } = _checkout;

    const naam      = document.getElementById('cd-naam')?.value.trim() || '';
    const adres     = document.getElementById('cd-adres')?.value.trim() || '';
    const postcode  = document.getElementById('cd-postcode')?.value.trim() || '';
    const woonplaats= document.getElementById('cd-woonplaats')?.value.trim() || '';
    const notitie   = document.getElementById('cd-notitie')?.value.trim() || '';
    const bron      = document.getElementById('cd-bron')?.value.trim() || '';

    const pcWoonplaats = [postcode, woonplaats].filter(Boolean).join(' ');

    const adresBlok = [
      naam       ? `Naam: ${naam}`                          : 'Naam:',
      adres      ? `Adres: ${adres}`                        : 'Adres:',
      pcWoonplaats ? `Postcode: ${pcWoonplaats}`            : 'Postcode + woonplaats:',
    ].join('\n') + (notitie ? `\nWensen: ${notitie}` : '') + (bron ? `\nVia: ${bron}` : '');

    const bericht =
`Hoi Pleun! 💝

Ik wil graag bestellen:

${lijn}

Subtotaal: €${total.toFixed(2).replace('.', ',')}
Verzending: ${gratisVerzending ? 'gratis 💚' : '€' + verzending.toFixed(2).replace('.', ',') + (_checkout?.verzendInfo ? ' (' + _checkout.verzendInfo.label.toLowerCase() + ')' : '')}
Totaal: €${eindTotaal.toFixed(2).replace('.', ',')}

---
${adresBlok}`;

    const ta = document.getElementById('cd-message');
    if (ta) ta.value = bericht;
  };

  window.hideCheckoutDetails = function() {
    const panel = document.getElementById('checkout-details');
    if (panel) panel.style.display = 'none';
    _checkout = null;

    const modal = document.querySelector('.cart-modal');
    if (!modal) return;
    const desc = modal.querySelector(':scope > p');
    if (desc) desc.style.display = '';

    renderCartModal();
  };

  // Checkout: toont verzendgegevens-stap in plaats van direct WhatsApp te openen.
  window.checkoutCart = function(target = 'pleun') {
    const items = read();
    if (items.length === 0) return;
    showCheckoutDetails(items, target);
  };

  // Enkelvoudige bestelling (direct vanuit productkaart, zonder verzameldoos).
  window.openCheckout = function(itemData) {
    const overlay = document.querySelector('#cart-overlay');
    if (overlay) overlay.classList.add('open');
    showCheckoutDetails([itemData], 'pleun');
  };

  // Init
  document.addEventListener('DOMContentLoaded', updateCartUI);
})();
