import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// ✅ GERİ EKLE: Bildirimler tüm panellerde çalışsın
import NotificationProvider from "./context/NotificationContext";

// Sayfalar
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterSuccess from "./pages/RegisterSuccess";
import Dashboard from "./pages/Dashboard";
import Firmalar from "./pages/Firmalar";
import RiskDegerlendirme from "./pages/RiskDegerlendirme/RiskDegerlendirme";
import AcilDurum from "./pages/AcilDurum/AcilDurum";
import YillikPlanlar from "./pages/YillikPlanlar/YillikPlanlar";
import Egitim from "./pages/Egitim/Egitim";
import Talimatlar from "./pages/Talimatlar/Talimatlar";
import DefterKurul from "./pages/DefterKurul/DefterKurul";
import PeriyodikIsHijyen from "./pages/PeriyodikIsHijyen/PeriyodikIsHijyen";
import Belgelerim from "./pages/Belgelerim/Belgelerim";
import RiskBelgeleri from "./pages/Belgelerim/RiskBelgeleri";
import TicariRiskBelgeleri from "./pages/Ticari/TicariRiskBelgeleri";

import KisiselBilgiler from "./pages/KisiselBilgiler";
import KurumsalKimlik from "./pages/KurumsalKimlik";
import GuvenlikGiris from "./pages/GuvenlikGiris";
import AbonelikBilgileri from "./pages/AbonelikBilgileri";

import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
// Layout (bireysel)
import PanelLayout from "./components/PanelLayout.jsx";

// Test sayfası (Shadcn)
import TestShadcn from "./pages/TestShadcn";

// Ticari admin & user sayfaları
import TicariAdminBelgeler from "./pages/Ticari/TicariAdminBelgeler";
import TicariBelgeler from "./pages/Ticari/TicariBelgeler";
import AdminFirmalar from "./pages/Ticari/AdminFirmalar";
import AdminAtamaBekleyen from "./pages/Ticari/AdminAtamaBekleyen";
import IsgKatipEntegrasyon from "./pages/Ticari/IsgKatipEntegrasyon";
import TicariUserPanel from "./pages/Ticari/TicariUserPanel";
import UserFirmalarim from "./pages/Ticari/UserFirmalarim";
import TicariKullaniciYonetimi from "./pages/Ticari/TicariKullaniciYonetimi";
import IsyeriHekimiPaneli from "./pages/Hekim/IsyeriHekimiPaneli";
// ✅ Ticari: Kurumsal Kimlik / Güvenlik / Abonelik
import TicariKurumsalKimlik from "./pages/Ticari/TicariKurumsalKimlik";
import TicariGuvenlikGiris from "./pages/Ticari/TicariGuvenlikGiris";
import TicariAbonelikBilgileri from "./pages/Ticari/TicariAbonelikBilgileri";

// Ticari admin layout & dashboard
import AdminLayout from "./components/Ticari/AdminLayout";
import TicariDashboard from "./pages/Ticari/Dashboard";

// Ödeme sayfası
import Odeme from "./pages/Odeme";
import OdemeSonuc from "./pages/OdemeSonuc";
import DemoLanding from "./pages/DemoLanding";
import DemoRegister from "./pages/DemoRegister";
import BelgeDogrula from "./pages/BelgeDogrula";

// ✅ SUPER ADMIN
import SuperLayout from "./components/SuperAdmin/SuperLayout";
import SuperDashboard from "./pages/SuperAdmin/SuperDashboard";
import SuperKullanicilar from "./pages/SuperAdmin/SuperKullanicilar";
import SuperDuyurularBildirimler from "./pages/SuperAdmin/SuperDuyurularBildirimler";
import SuperSistemDurumu from "./pages/SuperAdmin/SuperSistemDurumu";
import SuperTeklifler from "./pages/SuperAdmin/SuperTeklifler";
import PaketYonetimi from "./pages/SuperAdmin/PaketYonetimi";
import SuperFaturalar from "./pages/SuperAdmin/SuperFaturalar";
import TeklifKayit from "./pages/kayit/TeklifKayit";
import TeklifBasvuru from "./pages/kayit/TeklifBasvuru";

// -------------------------------------------------------------
// 🛡️ TOKEN KONTROLÜ — Tek noktadan token oku
// (NotificationContext ile aynı mantığa yaklaşır)
// -------------------------------------------------------------
function getAuthToken() {
  const direct =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  if (direct) return direct;

  // ✅ active email scoped token varsa onu da yakala
  const activeEmail = localStorage.getItem("__isg_active_email_global") || "";
  if (activeEmail) {
    const scoped =
      localStorage.getItem(`isgpanel:${activeEmail}:token`) ||
      sessionStorage.getItem(`isgpanel:${activeEmail}:token`) ||
      "";
    if (scoped) return scoped;
  }

  return "";
}

function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function RequireAuth({ children }) {
  const token = getAuthToken();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/giris" state={{ from: location }} replace />;
  }

  const payload = decodeJwtPayload(token) || {};
  const status = String(payload?.status || "").toLowerCase();
  const isBlockedLike = ["blokeli", "pasif", "askida"].includes(status);

  // 🔒 BLOKE/PASİF/ASKIDA → sadece /panel
  if (isBlockedLike && location.pathname.startsWith("/panel") && location.pathname !== "/panel") {
    return <Navigate to="/panel" replace />;
  }

  return children;
}

// -------------------------------------------------------------
// 🔐 ROLE KONTROLÜ — Super Admin için
// -------------------------------------------------------------
function RequireRole({ allow = [], children }) {
  const token = getAuthToken();
  const location = useLocation();

  if (!token) return <Navigate to="/giris" state={{ from: location }} replace />;

  let user = null;
  try {
    user = JSON.parse(
      localStorage.getItem("user") ||
        sessionStorage.getItem("user") ||
        "null"
    );
  } catch {
    user = null;
  }

  const role = user?.role;
  if (!role || !allow.includes(role)) return <Navigate to="/panel" replace />;

  return children;
}

// -------------------------------------------------------------
// 📌 Belgelerim: Role göre component seç
// -------------------------------------------------------------
const getActiveUser = () => {
  try {
    const activeEmail = localStorage.getItem("__isg_active_email_global");
    const u1 = activeEmail ? localStorage.getItem(`isgpanel:${activeEmail}:user`) : null;
    const u2 = localStorage.getItem("user") || sessionStorage.getItem("user");
    return JSON.parse(u1 || u2 || "null");
  } catch {
    return null;
  }
};

const BelgelerimRoleGate = () => {
  const user = getActiveUser();
  const role = user?.role;

  if (role === "ticari_user") return <TicariRiskBelgeleri />;
  return <RiskBelgeleri />;
};

// -------------------------------------------------------------
// APP
// -------------------------------------------------------------
function App() {
  return (
    <NotificationProvider>
      <Router>
        <Routes>
          {/* ✅ GİRİŞ SEÇİM EKRANI */}
          <Route path="/giris" element={<Home />} />
          <Route path="/" element={<Home />} />

          {/* Login */}
          <Route path="/login/:role" element={<Login />} />

          {/* ✅ DEMO REGISTER (public) */}
          <Route path="/demo" element={<DemoRegister />} />

          {/* ✅ DEMO LANDING (public) */}
          <Route path="/demo-landing" element={<DemoLanding />} />

          {/* Register */}
          <Route path="/register/:role" element={<Register />} />
          <Route path="/kayit/register/:role" element={<Register />} />

          {/* Kayıt sonrası */}
          <Route path="/register-success/:role" element={<RegisterSuccess />} />

          {/* Şifremi Unuttum */}
          <Route path="/forgot-password/:role" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          {/* ÖDEME */}
          <Route path="/odeme" element={<Odeme />} />
          <Route path="/odeme-sonuc" element={<OdemeSonuc />} />

          <Route path="/kayit/teklif/:token/basvuru" element={<TeklifBasvuru />} />
          <Route path="/kayit/teklif/:token" element={<TeklifKayit />} />

          {/* 🟢 BİREYSEL PANEL */}
          <Route
            path="/panel"
            element={
              <RequireAuth>
                <PanelLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="firmalar" element={<Firmalar />} />
            <Route path="risk-degerlendirme" element={<RiskDegerlendirme />} />
            <Route path="acil-durum" element={<AcilDurum />} />
            <Route path="yillik-planlar" element={<YillikPlanlar />} />
            <Route path="egitim" element={<Egitim />} />
<Route path="talimatlar" element={<Talimatlar />} />
<Route path="defter-kurul" element={<DefterKurul />} />
<Route path="periyodik-is-hijyen" element={<PeriyodikIsHijyen />} />
<Route path="belgelerim" element={<Belgelerim />} />
            <Route path="kisisel-bilgiler" element={<KisiselBilgiler />} />
            <Route path="kurumsal-kimlik" element={<KurumsalKimlik />} />
            <Route path="guvenlik-giris" element={<GuvenlikGiris />} />
            <Route
              path="paket-abonelik"
              element={
                (() => {
                  const activeEmail = localStorage.getItem("__isg_active_email_global");
                  const user = JSON.parse(localStorage.getItem(`isgpanel:${activeEmail}:user`));
                  return user?.role === "ticari_user" ? (
                    <Navigate to="/panel" replace />
                  ) : (
                    <AbonelikBilgileri />
                  );
                })()
              }
            />
          </Route>

          {/* 🟡 TİCARİ ADMIN */}
          <Route
            path="/ticari/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<TicariDashboard />} />
            <Route path="belgeler" element={<TicariAdminBelgeler />} />
            <Route path="firmalar" element={<AdminFirmalar />} />
            <Route path="atama-bekleyen" element={<AdminAtamaBekleyen />} />
            <Route path="atama-yonetimi" element={<IsgKatipEntegrasyon />} />
            <Route path="kullanicilar" element={<TicariKullaniciYonetimi />} />
            <Route path="kurumsal-kimlik" element={<TicariKurumsalKimlik />} />
            <Route path="guvenlik" element={<TicariGuvenlikGiris />} />
            <Route path="abonelik" element={<TicariAbonelikBilgileri />} />
          </Route>

          {/* 🟠 TİCARİ BELGELER (KISA YOL) */}
          <Route
            path="/ticari/belgeler"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<TicariBelgeler />} />
          </Route>

          {/* 🔵 TİCARİ USER */}
          <Route
            path="/ticari/user"
            element={
              <RequireAuth>
                <TicariUserPanel />
              </RequireAuth>
            }
          >
            <Route index element={<UserFirmalarim />} />
            <Route path="firmalarim" element={<UserFirmalarim />} />
            <Route path="belgelerim" element={<Belgelerim />} />
          </Route>

{/* 🩺 İŞYERİ HEKİMİ PANELİ */}
<Route
  path="/isyeri-hekimi"
  element={
    <RequireAuth>
      <IsyeriHekimiPaneli />
    </RequireAuth>
  }
/>

          {/* 🔴 SUPER ADMIN */}
          <Route
            path="/super"
            element={
              <RequireRole allow={["super_admin"]}>
                <SuperLayout />
              </RequireRole>
            }
          >
  <Route index element={<SuperDashboard />} />
  <Route path="kullanicilar" element={<SuperKullanicilar />} />
  <Route path="duyurular-bildirimler" element={<SuperDuyurularBildirimler />} />
  <Route path="sistem-durumu" element={<SuperSistemDurumu />} />
  <Route path="teklifler" element={<SuperTeklifler />} />
  <Route path="paket-yonetimi" element={<PaketYonetimi />} />
  <Route path="faturalar" element={<SuperFaturalar />} />
</Route>

          {/* Test */}
          <Route path="/test" element={<TestShadcn />} />

          {/* Alias */}
          <Route path="/super-kullanicilar" element={<Navigate to="/super/kullanicilar" replace />} />

          <Route path="/dogrula/:code" element={<BelgeDogrula />} />

          <Route path="*" element={<Navigate to="/giris" replace />} />
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;
