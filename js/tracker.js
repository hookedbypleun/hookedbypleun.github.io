// Hooked by Pleun — privacy-first event tracker (sinds v3.5.7)
// Stuurt anonieme events naar Worker /track. Geen cookies, geen IP-opslag,
// geen UA-strings — alleen mobile/desktop classificatie.
//
// Public API:
//   window.Track.pageview()    — auto bij DOMContentLoaded
//   window.Track.event(type, payload)
//   window.Track.product(id)   — productpagina view
//   window.Track.cartAdd(id, kleur)
//   window.Track.cartOpen()
//   window.Track.whatsappClick()
//   window.Track.review()
//   window.Track.postcode(pc, type)

(function () {
  const cfg = window.SHOP_CONFIG || {};
  const workerUrl = (cfg.workerUrl || '').replace(/\/$/, '');

  // Geen tracker zonder Worker URL — graceful fallback
  if (!workerUrl) {
    window.Track = new Proxy({}, { get: () => () => {} });
    return;
  }

  function classifyDevice() {
    const w = window.innerWidth || screen.width || 0;
    if (w < 600) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  function getReferrer() {
    try {
      const r = document.referrer;
      if (!r) return '';
      const u = new URL(r);
      // Strip eigen domein zodat interne links niet als referrer tellen
      if (u.host === location.host) return '';
      return u.host; // alleen host, geen path/query (privacy)
    } catch { return ''; }
  }

  let _sent = false;
  async function send(payload) {
    try {
      const body = JSON.stringify(payload);
      // fetch + keepalive werkt ook bij unload én correct met CORS-preflight
      // (sendBeacon met application/json triggert preflight die door browsers
      //  niet altijd correct wordt afgehandeld — POST volgt dan niet)
      fetch(workerUrl + '/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        mode: 'cors',
      }).catch(() => {});
    } catch { /* ignore — analytics never crashes the page */ }
  }

  // Path normaliseren: altijd leading slash, geen hash, met optioneel ?id=X bewaard
  function curPath() {
    let p = location.pathname || '/';
    if (p === '') p = '/';
    // Bewaar alleen ?id= voor product-pages — rest is ruis
    const q = location.search;
    if (q && /[?&]id=/.test(q)) {
      const m = q.match(/[?&](id=[^&]+)/);
      if (m) p += '?' + m[1];
    }
    return p;
  }

  window.Track = {
    pageview() {
      if (_sent) return;
      _sent = true;
      send({
        type: 'pageview',
        path: curPath(),
        ref: getReferrer(),
        device: classifyDevice(),
      });
    },
    event(type, payload) { send({ type, path: curPath(), ...payload }); },
    product(id) { if (id) send({ type: 'product_view', path: curPath(), productId: id }); },
    cartAdd(id, kleur) { if (id) send({ type: 'cart_add', path: curPath(), productId: id, kleur: kleur || '' }); },
    cartOpen() { send({ type: 'cart_open', path: curPath() }); },
    whatsappClick() { send({ type: 'whatsapp_click', path: curPath() }); },
    review() { send({ type: 'review_submit', path: curPath() }); },
    postcode(pc, type) { send({ type: 'postcode_check', path: curPath(), postcode: String(pc || '').slice(0, 4), postcodeType: type || '' }); },
  };

  // Auto pageview bij init (na config)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.Track.pageview());
  } else {
    window.Track.pageview();
  }
})();
