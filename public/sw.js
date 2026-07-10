self.addEventListener("install", (event) => {
  console.log("İSG Panel service worker yüklendi");

  // Yeni versiyon direkt aktif olsun
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("İSG Panel service worker aktif");

  // Tüm açık sayfalarda hemen kontrolü al
  event.waitUntil(self.clients.claim());
});

// ❌ fetch YOK → cache YOK → offline YOK