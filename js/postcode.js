// Postcode-check: lokaal (Pleun Express) of verzenden?

window.checkPostcode = function(input, resultEl) {
  const cfg = window.SHOP_CONFIG;
  const raw = (input.value || '').trim().replace(/\s/g, '').toUpperCase();
  const cijfers = raw.match(/^(\d{4})/);
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
  } else {
    resultEl.className = 'postcode-result verzending';
    resultEl.innerHTML = `📮 <strong>Verzenden via ${cfg.shippingNLLabel}</strong> — €${cfg.shippingNL.toFixed(2).replace('.', ',')} (gratis bij 2+ items).`;
  }
};
