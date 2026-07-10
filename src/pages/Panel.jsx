// src/pages/Panel.jsx
import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import PanelLayout from "../components/PanelLayout";

// Sayfa bileşenleri
import Dashboard from "./Dashboard";
import Firmalar from "./Firmalar";
import RiskDegerlendirme from "./RiskDegerlendirme";
import AcilDurum from "./AcilDurum";

// ✅ YENİ: Ayarlar sekmeleri (Güvenlik&Giriş + Paket&Abonelik)
import AyarlarSekmeleri from "./AyarlarSekmeleri";

const Panel = () => {
  const location = useLocation();
  const token = localStorage.getItem("token");

  // Eğer token yoksa login sayfasına yönlendir
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <Routes>
      {/* Tüm panel sayfaları PanelLayout içinde açılır */}
      <Route path="/" element={<PanelLayout />}>
        {/* Ana sayfa */}
        <Route index element={<Dashboard />} />

        {/* Firmalar */}
        <Route path="firmalar" element={<Firmalar />} />

        {/* Risk Değerlendirme */}
        <Route path="risk-degerlendirme" element={<RiskDegerlendirme />} />

        {/* Acil Durum Planı */}
        <Route path="acil-durum" element={<AcilDurum />} />

        {/* ✅ Ayarlar (Güvenlik&Giriş + Paket&Abonelik) */}
        <Route path="ayarlar" element={<AyarlarSekmeleri />} />
      </Route>
    </Routes>
  );
};

export default Panel;
