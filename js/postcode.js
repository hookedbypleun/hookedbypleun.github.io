// Postcode-check: lokaal (Pleun Express) of verzenden?

window.checkPostcode = function(input, resultEl) {
  const cfg = window.SHOP_CONFIG;
  // Pakt de EERSTE 4 opeenvolgende cijfers — werkt voor "5074", "5074pv",
  // "5074 PV", " 5074 ", "5074-PV", etc.
  const cijfers = String(input.value || '').match(/(\d{4})/);
  if (!cijfers) {
    resultEl.className = 'postcode-result';
    resultEl.textContent = '';
    return;
  }
  const pc = cijfers[1];
  const lokaal = cfg.localPostcodes.find(p => p.range.includes(pc));
  if (lokaal) {
    resultEl.className = 'postcode-result lokaal';
    resultEl.innerHTML = `🚲 <strong>Pleun Express!</strong> Je woont in ${lokaal.dorp} — gratis bezorgd op ${cfg.expressDay}.`;
    window.Track?.postcode(pc, 'lokaal');
  } else {
    resultEl.className = 'postcode-result verzending';
    resultEl.innerHTML = `📮 <strong>Per post</strong> — vanaf €${(cfg.shipping?.brief?.prijs || 2.95).toFixed(2).replace('.', ',')} (gratis vanaf €${cfg.freeShippingThreshold || 25}).`;
    window.Track?.postcode(pc, 'extern');
  }
};
