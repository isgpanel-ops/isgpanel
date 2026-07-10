import "./utils/storageBootstrap";
import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import App from "./App";

// CSS dosyaları
import "./index.css";
import "./styles.css";

// Context
import { FirmaProvider } from "./context/FirmaContext.jsx";
import NotificationProvider from "./context/NotificationContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

// 🔥 Global Popup Sistemi
import GlobalAlertManager from "./components/GlobalAlertManager";

/* =====================================================
   🔐 LOCALSTORAGE → SESSIONSTORAGE YÖNLENDİRME
   👉 Kodları BOZMADAN, TEK NOKTADAN ÇÖZÜM
   ===================================================== */
/* Storage bootstrap already namespaces localStorage; removed sessionStorage proxy to prevent auth loops. */
/* ===================================================== */

try {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common["Authorization"];
  }
} catch (e) {
  delete axios.defaults.headers.common["Authorization"];
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <FirmaProvider>
        <NotificationProvider>
          {/* 🔥 Popup sistemi her sayfada aktif */}
          <GlobalAlertManager>
            <App />
          </GlobalAlertManager>
        </NotificationProvider>
      </FirmaProvider>
    </AuthProvider>
  </React.StrictMode>
);
/* =====================================================
   🔧 PWA SERVICE WORKER
   ===================================================== */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("ISG Panel Service Worker aktif");
      })
      .catch((err) => {
        console.log("Service Worker hata:", err);
      });
  });
}