// Crochet by Pleun — Centrale configuratie
// Wijzig hier 1 regel om gedrag op de hele site aan te passen.

window.SHOP_CONFIG = {
  // === Versie ===
  version: '2.3.8',
  versionDate: '2026-05-09',

  // === Cloudflare Worker (admin AI-publicatie) ===
  // Vul deze in nadat je de Worker hebt gedeployed (zie cloudflare-worker/README.md).
  // Leeg = AI-mode uitgeschakeld, admin werkt dan op handmatige modus.
  workerUrl: 'https://crochet-by-pleun.thegaveryahoo.workers.dev',

  // === Merk ===
  shopName: "Hooked by Pleun",
  shopNameSecondary: "crochet by Pleun",
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
  // 3 tarieven, automatisch het laagste benodigde tarief (op basis van items in cart)
  // Boven freeShippingThreshold euro -> gratis (van het tarief dat anders gerekend zou worden)
  shipping: {
    brief:      { prijs: 2.95, label: 'Brievenbuspost',  icon: '✉️' },  // klein/plat: scrunchies, sleutelhangers, onderzetters
    brievenbus: { prijs: 4.75, label: 'Brievenbuspakje', icon: '📮' },  // gemiddeld: blobs, kleine diertjes, haakpakketten
    pakket:     { prijs: 6.95, label: 'Pakketpost',      icon: '📦' },  // groot: mutsen, tassen, grote knuffels
  },
  // Categorie -> verzendklasse (kan per item worden overschreven via item.verzendklasse)
  verzendklassen: {
    scrunchies:     'brief',
    sleutelhangers: 'brief',
    onderzetters:   'brief',
    blobs:          'brievenbus',
    diertjes:       'brievenbus',
    haakpakketten:  'brievenbus',
    mutsen:         'pakket',
    tassen:         'pakket',
  },
  freeShippingThreshold: 25,  // bestelbedrag vanaf -> gratis verzending
  // Behouden voor compatibiliteit (oudere items.json verwijzingen):
  shippingNL: 4.75,
  shippingNLLabel: "Brievenbuspakje (PostNL)",

  // === Social handles (gereserveerd voor later) ===
  social: {
    instagram: "",  // @crochetbypleun
    tiktok: "",     // @crochetbypleun
    pinterest: ""   // crochetbypleun
  }
};
