// Verzameldoos — items verzamelen voor 1 bestelling.
// LocalStorage zodat hij blijft staan als je tussen pagina's klikt.

(function() {
  const STORAGE_KEY = 'pleun_cart_v1';

  function read()  { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
  function write(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); updateCartUI(); }

  window.Cart = {
    items: () => read(),
    count: () => read().length,
    total: () => read().reduce((s, i) => s + (i.prijs || 0), 0),
    add(item) {
      const arr = read();
      if (arr.find(i => i.id === item.id)) {
        showToast('Zit al in je verzameldoos 💝');
        return;
      }
      arr.push({ id: item.id, naam: item.naam, prijs: item.prijs, foto: item.foto });
      write(arr);
      showToast(`✨ ${item.naam} toegevoegd!`);
    },
    remove(id) {
      write(read().filter(i => i.id !== id));
    },
    clear() { write([]); },
  };

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

    list.innerHTML = items.map(i => `
      <li>
        <img src="${i.foto}" alt="${escapeHtml(i.naam)}">
        <span class="name">${escapeHtml(i.naam)}</span>
        <span class="price">€${i.prijs.toFixed(2).replace('.', ',')}</span>
        <button class="remove" onclick="Cart.remove('${i.id}')" aria-label="Verwijderen">×</button>
      </li>
    `).join('');

    const subtotal = items.reduce((s, i) => s + i.prijs, 0);
    const cfg = window.SHOP_CONFIG;
    const gratisVerzending = items.length >= cfg.freeShippingFromBundleSize;

    summary.style.display = 'block';
    summary.innerHTML = `
      <div class="row"><span>${items.length} item${items.length > 1 ? 's' : ''}</span><span>€${subtotal.toFixed(2).replace('.', ',')}</span></div>
      <div class="row">
        <span>Verzending</span>
        <span>${gratisVerzending ? '<strong style="color:#2E7D32">Gratis 💚</strong>' : '€' + cfg.shippingNL.toFixed(2).replace('.', ',') + ' (of gratis lokaal)'}</span>
      </div>
      <div class="row total"><span>Totaal</span><span>€${(subtotal + (gratisVerzending ? 0 : cfg.shippingNL)).toFixed(2).replace('.', ',')}</span></div>
      ${!gratisVerzending && items.length === 1
        ? '<div class="cart-bonus">💡 Voeg er nog 1 toe voor <strong>gratis verzending</strong>!</div>'
        : '' }
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
    }
  });

  // Checkout: maak 1 WhatsApp-bericht van alle items.
  window.checkoutCart = function(target = 'pleun') {
    const items = read();
    if (items.length === 0) return;
    const cfg = window.SHOP_CONFIG;
    const total = items.reduce((s, i) => s + i.prijs, 0);
    const gratisVerzending = items.length >= cfg.freeShippingFromBundleSize;
    const verzending = gratisVerzending ? 0 : cfg.shippingNL;
    const eindTotaal = total + verzending;

    const lijn = items.map((i, n) => `${n + 1}. ${i.naam} — €${i.prijs.toFixed(2).replace('.', ',')}`).join('\n');
    const bericht =
`Hoi Pleun! 💝

Ik wil graag deze items uit je Haak-shop bestellen:

${lijn}

Subtotaal: €${total.toFixed(2).replace('.', ',')}
Verzending: ${gratisVerzending ? 'gratis (2+ items!)' : '€' + verzending.toFixed(2).replace('.', ',')}
Totaal: €${eindTotaal.toFixed(2).replace('.', ',')}

Mijn naam:
Mijn postcode + adres:
Lokaal afhalen of versturen?`;

    const nummer = target === 'backup' && cfg.whatsappBackup ? cfg.whatsappBackup : cfg.whatsappNumber;
    window.open(`https://wa.me/${nummer}?text=${encodeURIComponent(bericht)}`, '_blank');
  };

  // Init
  document.addEventListener('DOMContentLoaded', updateCartUI);
})();
