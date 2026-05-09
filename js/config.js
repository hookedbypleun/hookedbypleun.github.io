// Crochet by Pleun — Centrale configuratie
// Wijzig hier 1 regel om gedrag op de hele site aan te passen.

window.SHOP_CONFIG = {
  // === Versie ===
  version: '1.5.0',
  versionDate: '2026-05-09',

  // === Cloudflare Worker (admin AI-publicatie) ===
  // Vul deze in nadat je de Worker hebt gedeployed (zie cloudflare-worker/README.md).
  // Leeg = AI-mode uitgeschakeld, admin werkt dan op handmatige modus.
  workerUrl: '',  // bv. 'https://crochet-by-pleun.jouwnaam.workers.dev'

  // === Merk ===
  shopName: "Crochet by Pleun",
  tagline: "Made small. Made with love.",
  ownerName: "Pleun",
  ownerAge: 12,
  ownerLocation: "Brabant",

  // === Contact ===
  // Pleun's WhatsApp (hoofdkanaal). Wijzig naar Dave's nummer voor publieke launch.
  whatsappNumber: "31635621715",
  whatsappLabel: "WhatsApp Pleun",
  // Optioneel tweede contact (bv. ouder)
  whatsappBackup: "",
  whatsappBackupLabel: "WhatsApp Mama / Papa",
  // Email-formulier (later in te vullen — Web3Forms / Formspree)
  emailFormUrl: "",
  // WhatsApp-kanaal voor VIP updates
  channelInviteUrl: "https://wa.me/channel/0029VbAMt8h0wIikbjZF8H22",

  // === Pleun Express — gratis lokale bezorging ===
  localPostcodes: [
    { range: ["5074"], dorp: "Biezenmortel" },
    { range: ["5071"], dorp: "Udenhout" },
    { range: ["5268"], dorp: "Helvoirt" }
  ],
  expressDay: "zaterdag",

  // === Verzending ===
  shippingNL: 4.75,        // Brievenbuspakje
  shippingNLLabel: "Brievenbuspakje (PostNL)",
  freeShippingFromBundleSize: 2,  // Bij 2+ items gratis verzending

  // === Social handles (gereserveerd voor later) ===
  social: {
    instagram: "",  // @crochetbypleun
    tiktok: "",     // @crochetbypleun
    pinterest: ""   // crochetbypleun
  }
};
