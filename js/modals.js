// Hooked by Pleun — Gedeelde modals: Ideeënbus + Disclaimer
(function () {

  function createModal(id, contentHtml) {
    let m = document.getElementById(id);
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal-overlay';
      m.id = id;
      m.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true">
          <button class="modal-close" onclick="document.getElementById('${id}').classList.remove('open')" aria-label="Sluiten">×</button>
          ${contentHtml}
        </div>`;
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') m.classList.remove('open'); });
    }
    m.classList.add('open');
  }

  // ============================================================
  // Ideeënbus
  // ============================================================
  window.openIdeeenbus = function () {
    createModal('ideeenbus-modal', `
      <h2>💡 Idee of foutje?</h2>
      <p class="cd-hint">Heb je een leuk idee voor de shop, of zie je iets wat niet klopt? Laat het me weten!</p>
      <div class="cd-field">
        <textarea id="ib-bericht" rows="4" placeholder="Je bericht (verplicht)..."></textarea>
      </div>
      <div class="cd-field">
        <input id="ib-naam" type="text" placeholder="Jouw naam (optioneel)">
      </div>
      <div class="cd-field">
        <input id="ib-via" type="text" placeholder="Hoe ken je de shop? (optioneel)">
        <span class="cd-field-hint">Vind ik leuk om te weten 🌸</span>
      </div>
      <button class="btn full" onclick="window.verstuurIdee()">💬 Stuur via WhatsApp</button>
    `);
  };

  window.verstuurIdee = function () {
    const bericht = document.getElementById('ib-bericht')?.value.trim();
    if (!bericht) { alert('Vul eerst een bericht in 💝'); return; }
    const naam = document.getElementById('ib-naam')?.value.trim();
    const via  = document.getElementById('ib-via')?.value.trim();
    const cfg  = window.SHOP_CONFIG || {};
    let msg = `💡 Idee / foutje voor Hooked by Pleun\n\n${bericht}`;
    if (naam) msg += `\n\nVan: ${naam}`;
    if (via)  msg += `\nVia: ${via}`;
    const nummer = cfg.whatsappBackup || cfg.whatsappNumber || '';
    window.open(`https://wa.me/${nummer}?text=${encodeURIComponent(msg)}`, '_blank');
    document.getElementById('ideeenbus-modal')?.classList.remove('open');
  };

  // ============================================================
  // Disclaimer
  // ============================================================
  window.openDisclaimer = function () {
    createModal('disclaimer-modal', `
      <h2>📜 Goed om te weten</h2>
      <ul class="disclaimer-lijst">
        <li>Ik maak alles zelf 💪 Ik doe dit erg zelfstandig, onder lichte supervisie van mijn ouders.</li>
        <li>Alles is met de hand gemaakt — kleine variaties horen erbij en dat maakt elk item uniek 🧶</li>
        <li>Niet blij met je bestelling? Stuur me een berichtje binnen 14 dagen — samen vinden we een oplossing 💝</li>
        <li>Maatwerk items worden speciaal voor jou gemaakt en kunnen helaas niet worden teruggestuurd.</li>
        <li>Ik deel niets met derden. Jouw naam en adres gebruik ik alleen om je bestelling te bezorgen.</li>
      </ul>
    `);
  };

})();
