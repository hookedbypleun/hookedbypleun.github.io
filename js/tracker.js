// Hooked by Pleun — privacy-first event tracker (sinds v3.2.2)
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
      // sendBeacon werkt ook bij page-unload, fire-and-forget
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(workerUrl + '/track', blob);
      } else {
        fetch(workerUrl + '/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch { /* ignore — analytics never crashes the page */ }
  }

  window.Track = {
    pageview() {
      if (_sent) return;
      _sent = true;
      const path = location.pathname || '/';
      send({
        type: 'pageview',
        path: path === '' ? '/' : path,
        ref: getReferrer(),
        device: classifyDevice(),
      });
    },
    event(type, payload) { send({ type, ...payload }); },
    product(id) { if (id) send({ type: 'product_view', productId: id }); },
    cartAdd(id, kleur) { if (id) send({ type: 'cart_add', productId: id, kleur: kleur || '' }); },
    cartOpen() { send({ type: 'cart_open' }); },
    whatsappClick() { send({ type: 'whatsapp_click' }); },
    review() { send({ type: 'review_submit' }); },
    postcode(pc, type) { send({ type: 'postcode_check', postcode: String(pc || '').slice(0, 4), postcodeType: type || '' }); },
  };

  // Auto pageview bij init (na config)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.Track.pageview());
  } else {
    window.Track.pageview();
  }
})();
