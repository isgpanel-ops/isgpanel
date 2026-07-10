// src/utils/storageBootstrap.js
(() => {
  const APP = "isgpanel";
  const ss = window.sessionStorage;

  // ✅ Gerçek (proxy olmayan) localStorage referansını sakla
  const realLS = window.localStorage;
  window.__REAL_LS = realLS;

  const getUser = () =>
    (ss.getItem("activeUserEmail") || "guest").toLowerCase().trim();

  const nsKey = (key) => `${APP}:${getUser()}:${key}`;

  // Kullanıcı değişince çağırmak için global yardımcı
  window.__setActiveUserEmail = (email) => {
    ss.setItem("activeUserEmail", (email || "guest").toLowerCase().trim());
    window.dispatchEvent(
      new CustomEvent("isgpanel:userChanged", {
        detail: ss.getItem("activeUserEmail"),
      })
    );
  };

  // localStorage'ı kullanıcıya göre namespace’li hale getir (proxy)
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    enumerable: true,
    value: {
      getItem: (key) => realLS.getItem(nsKey(key)),
      setItem: (key, value) => realLS.setItem(nsKey(key), String(value)),
      removeItem: (key) => realLS.removeItem(nsKey(key)),
      clear: () => {
        // SADECE aktif kullanıcı namespace'ini temizle
        const prefix = `${APP}:${getUser()}:`;
        Object.keys(realLS).forEach((k) => {
          if (k.startsWith(prefix)) realLS.removeItem(k);
        });
      },
      key: (i) => realLS.key(i),
      get length() {
        const prefix = `${APP}:${getUser()}:`;
        return Object.keys(realLS).filter((k) => k.startsWith(prefix)).length;
      },
    },
  });
})();
