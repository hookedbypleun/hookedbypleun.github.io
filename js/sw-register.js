// Crochet by Pleun — Service Worker registratie + Pull-to-Refresh + Update-banner

(function () {
  'use strict';

  const APP_VERSION = window.SHOP_CONFIG?.version || '1.0.0';

  // ===== Versie tonen in footer =====
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.version-tag').forEach(el => {
      el.textContent = 'v' + APP_VERSION;
    });
  });

  // ===== Service Worker registratie =====
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').then(reg => {
    // Periodiek checken bij focus (bv. na 30min weg)
    let lastCheck = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - lastCheck > 30 * 60 * 1000) {
        lastCheck = Date.now();
        reg.update();
      }
    });

    // Nieuwe SW gevonden → automatisch activeren (geen banner-knop meer)
    // Listener MOET vóór reg.update() worden gehangen!
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Niet onderbreken als checkout bezig is
          const cartOverlay = document.getElementById('cart-overlay');
          const cartItems = JSON.parse(localStorage.getItem('pleun_cart_v1') || '[]');
          const inCheckout = cartOverlay?.classList.contains('open') && cartItems.length > 0;
          if (inCheckout) {
            // Toon banner zodat klant zelf kan kiezen
            showUpdateBanner();
          } else {
            // Auto-skip + reload via controllerchange
            reg.waiting?.postMessage('SKIP_WAITING');
          }
        }
      });
    });

    // NU pas update aanroepen — listener staat
    reg.update().catch(() => {});
  }).catch(err => console.warn('[SW] Registratie mislukt:', err));

  // Nieuwe controller = update al toegepast → auto-reload
  // Uitzondering: niet herladen als iemand midden in een checkout zit
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const cartItems = JSON.parse(localStorage.getItem('pleun_cart_v1') || '[]');
    const inCheckout = document.getElementById('cart-overlay')?.classList.contains('open') && cartItems.length > 0;
    if (!inCheckout) window.location.reload();
  });

  // Berichten van SW
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'NEW_VERSION') {
      showUpdateBanner(event.data.version);
    }
    if (event.data?.type === 'VERSION') {
      document.querySelectorAll('.version-tag').forEach(el => {
        el.textContent = 'v' + event.data.version;
      });
    }
  });

  // Vraag SW om versie
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage('GET_VERSION');
  });

  // ===== Update banner =====
  let pendingReload = false;

  function showUpdateBanner(version) {
    const banner = document.getElementById('update-banner');
    if (!banner || banner.classList.contains('zichtbaar')) return;

    banner.innerHTML = `
      <span>🌸 Nieuwe versie beschikbaar${version ? ' (v' + version + ')' : ''}!</span>
      <button onclick="window.__applyUpdate()">Bijwerken</button>
      <button class="sluiten" onclick="document.getElementById('update-banner').classList.remove('zichtbaar')" aria-label="Sluiten">×</button>
    `;
    banner.classList.add('zichtbaar');
  }

  window.__applyUpdate = function () {
    // Niet onderbreken als checkout bezig is
    const cartOverlay = document.getElementById('cart-overlay');
    const cartItems = JSON.parse(localStorage.getItem('pleun_cart_v1') || '[]');
    const inCheckout = cartOverlay?.classList.contains('open') && cartItems.length > 0;

    if (inCheckout) {
      const ok = confirm('Je hebt items in je verzameldoos. Wil je toch bijwerken? Je bestelling gaat niet verloren.');
      if (!ok) return;
    }

    pendingReload = true;
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) {
        reg.waiting.postMessage('SKIP_WAITING');
      } else {
        window.location.reload();
      }
    });
  };

  // ===== Pull-to-Refresh =====
  let ptr = { startY: 0, pulling: false, threshold: 72, active: false };

  function getPtrEl() {
    return document.getElementById('ptr-indicator');
  }

  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) {
      ptr.startY = e.touches[0].clientY;
      ptr.active = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!ptr.active || !ptr.startY) return;
    const dy = e.touches[0].clientY - ptr.startY;
    if (dy <= 0 || window.scrollY > 0) { ptr.active = false; return; }

    ptr.pulling = true;
    const progress = Math.min(dy / ptr.threshold, 1);
    const el = getPtrEl();
    if (el) {
      el.style.height = Math.round(progress * 48) + 'px';
      el.style.opacity = progress;
      el.classList.toggle('klaar', progress >= 1);
    }
  }, { passive: true });

  document.addEventListener('touchend', async () => {
    if (!ptr.pulling) { ptr.startY = 0; ptr.active = false; return; }

    const el = getPtrEl();
    const wasFullPull = el && el.classList.contains('klaar');
    if (el) {
      el.style.transition = 'height 0.3s ease, opacity 0.3s ease';
      el.style.height = '0';
      el.style.opacity = '0';
      el.classList.remove('klaar');
      setTimeout(() => { el.style.transition = ''; }, 350);
    }

    ptr.startY = 0;
    ptr.pulling = false;
    ptr.active = false;

    // Bij volledige pull: forceer SW-update + nieuwe versie activeren + hard reload
    if (wasFullPull) {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
          await reg.update();
          // Wacht maximaal 1.5s op nieuwe SW
          for (let i = 0; i < 15; i++) {
            if (reg.waiting) { reg.waiting.postMessage('SKIP_WAITING'); break; }
            if (!reg.installing) break;
            await new Promise(r => setTimeout(r, 100));
          }
        }
      } catch {}
      // Cache-bust hard reload
      location.href = location.pathname + '?v=' + Date.now() + (location.hash || '');
    } else {
      // Korte pull: alleen update-check op achtergrond
      navigator.serviceWorker?.getRegistration().then(reg => reg?.update());
    }
  });

})();
