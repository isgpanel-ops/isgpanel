import React, { useEffect, useState, useContext, useRef } from "react";
import {
  FaBuilding,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaChartLine,
  FaCalendarAlt,
} from "react-icons/fa";
import { HiEye, HiX } from "react-icons/hi";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { FirmaContext } from "../context/FirmaContext.jsx";

const diffDaysFromToday = (dateISO) => {
  if (!dateISO) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(dateISO);
  if (Number.isNaN(target.getTime())) return Infinity;
  target.setHours(0, 0, 0, 0);

  return Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
};

const formatTR = (d) =>
  d && !Number.isNaN(new Date(d))
    ? new Date(d).toLocaleDateString("tr-TR")
    : "-";

const getKalanGunColor = (kalanGun) => {
  if (kalanGun <= 7) return "text-red-600";
  if (kalanGun <= 30) return "text-orange-500";
  return "text-amber-600";
};

const getEgitimGecerlilikYili = (tehlikeText) => {
  const t = String(tehlikeText || "").toLowerCase();
  if (t.includes("az")) return 3;
  if (t.includes("çok") || t.includes("cok")) return 1;
  if (t.includes("tehlikeli")) return 2;
  return 2;
};

const addYearsISO = (dateISO, yearsToAdd) => {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";

  d.setHours(0, 0, 0, 0);
  d.setFullYear(d.getFullYear() + Number(yearsToAdd || 0));

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const readIseGirisKayitlari = (firmaId) => {
  const key = `ise_giris_katilim_${firmaId}`;
  let list = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }
  } catch (e) {
    console.error("İşe giriş eğitim kayıtları okunamadı:", e);
    list = [];
  }
  return list;
};

const getFirmaSonEgitimInfo = (firma) => {
  const list = readIseGirisKayitlari(firma?.id);
  const withDate = list
    .map((k) => ({
      adSoyad: k.adSoyad || "",
      bitisTarihi: k.bitisTarihi || "",
    }))
    .filter((k) => k.bitisTarihi);

  if (withDate.length === 0) {
    return {
      sonBitis: "",
      sonGecerlilik: "",
      yillar: getEgitimGecerlilikYili(firma?.tehlike),
    };
  }

  const latest = withDate.reduce((acc, cur) => {
    const a = new Date(acc.bitisTarihi);
    const c = new Date(cur.bitisTarihi);
    if (Number.isNaN(a.getTime())) return cur;
    if (Number.isNaN(c.getTime())) return acc;
    return c.getTime() > a.getTime() ? cur : acc;
  });

  const yillar = getEgitimGecerlilikYili(firma?.tehlike);
  const sonGecerlilik = addYearsISO(latest.bitisTarihi, yillar);

  return { sonBitis: latest.bitisTarihi, sonGecerlilik, yillar };
};

const Dashboard = () => {
  const { user, firmalar: ctxFirmalar } = useContext(FirmaContext);

  const [firmalar, setFirmalar] = useState([]);
  const [detail, setDetail] = useState(null);
  const [userName, setUserName] = useState("");
  const [installReady, setInstallReady] = useState(false);
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    const arr = Array.isArray(ctxFirmalar) ? ctxFirmalar : [];
    const normalized = arr.map((f) => ({
      ...f,
      id: f?.id || f?._id,
    }));
    setFirmalar(normalized);
  }, [ctxFirmalar]);

  useEffect(() => {
    const computeName = () => {
      const ctxName =
        (user?.ad && String(user.ad).trim()) ||
        (user?.adSoyad && String(user.adSoyad).trim()) ||
        (user?.name && String(user.name).trim());

      if (ctxName) {
        setUserName(ctxName);
        return;
      }

      const storedName =
        localStorage.getItem("kullaniciAdSoyad") ||
        localStorage.getItem("user_name") ||
        localStorage.getItem("userName");

      if (storedName && String(storedName).trim()) {
        setUserName(String(storedName).trim());
        return;
      }

      setUserName("");
    };

    computeName();

    const onStorage = () => computeName();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user]);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setInstallReady(true);
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setInstallReady(false);
      localStorage.setItem("pwa_installed", "1");
    };

    const alreadyInstalled =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true ||
      localStorage.getItem("pwa_installed") === "1";

    if (alreadyInstalled) {
      setInstallReady(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    try {
      if (!deferredPromptRef.current) return;

      deferredPromptRef.current.prompt();
      const choiceResult = await deferredPromptRef.current.userChoice;

      if (choiceResult?.outcome === "accepted") {
        setInstallReady(false);
      }

      deferredPromptRef.current = null;
    } catch (err) {
      console.error("PWA yükleme hatası:", err);
    }
  };

  const today = new Date();
  const toplam = firmalar.length;
  let guncel = 0;
  let yaklasiyor = 0;
  let kritik = 0;

  firmalar.forEach((f) => {
    if (!f.gecerlilik) return;
    const diff =
      (new Date(f.gecerlilik).getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24);

    if (diff >= 180) guncel++;
    else if (diff >= 30) yaklasiyor++;
    else if (diff >= 0) kritik++;
  });

  const yaklasanRaporlar = firmalar
    .map((f) => ({
      ...f,
      kalanGun: diffDaysFromToday(f.gecerlilik),
    }))
    .filter((f) => f.kalanGun >= 0 && f.kalanGun <= 60)
    .sort((a, b) => a.kalanGun - b.kalanGun)
    .slice(0, 6);

  const yaklasanEgitimler = firmalar
    .flatMap((f) => {
      const list = readIseGirisKayitlari(f.id);
      const yillar = getEgitimGecerlilikYili(f.tehlike);

      return list.map((k) => {
        const bitis = k.bitisTarihi || "";
        const gecerlilik = bitis ? addYearsISO(bitis, yillar) : "";
        const kalanGun = diffDaysFromToday(gecerlilik);

        return {
          firmaId: f.id,
          firmaAdi: f.firmaAdi,
          tehlike: f.tehlike,
          yillar,
          adSoyad: k.adSoyad || "",
          bitisTarihi: bitis,
          gecerlilik,
          kalanGun,
        };
      });
    })
    .filter((e) => e.gecerlilik && e.kalanGun >= 0 && e.kalanGun <= 60)
    .sort((a, b) => a.kalanGun - b.kalanGun)
    .slice(0, 6);

  const detailEgitimInfo = detail ? getFirmaSonEgitimInfo(detail) : null;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Üst Banner */}
      <motion.div
        className="bg-gradient-to-r from-emerald-600 to-emerald-400 text-white rounded-xl p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-md"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight">
            Bireysel Kullanıcı Paneline Hoşgeldiniz, {userName} 👋
          </h1>
          <p className="text-xs sm:text-sm opacity-90 mt-1">
            Tüm İSG süreçleriniz, firma yönetimi tek panelde.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {installReady && (
            <button
              type="button"
              onClick={handleInstallApp}
              className="bg-white text-emerald-700 hover:bg-slate-100 px-3 md:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold"
            >
              Uygulamayı İndir
            </button>
          )}
          <FaChartLine className="text-white text-3xl md:text-5xl opacity-90 shrink-0" />
        </div>
      </motion.div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6">
        {[
          {
            title: "Toplam Firma",
            value: toplam,
            desc: "Sisteme kayıtlı firma",
            icon: <FaBuilding className="text-blue-600 text-xl" />,
            color: "text-blue-600",
          },
          {
            title: "Güncel",
            value: guncel,
            desc: "≥ 180 gün",
            icon: <FaCheckCircle className="text-green-600 text-xl" />,
            color: "text-green-600",
          },
          {
            title: "Yaklaşan Rapor",
            value: yaklasiyor,
            desc: "30–180 gün",
            icon: <FaExclamationTriangle className="text-yellow-500 text-xl" />,
            color: "text-yellow-500",
          },
          {
            title: "Kritik",
            value: kritik,
            desc: "< 30 gün",
            icon: <FaTimesCircle className="text-red-600 text-xl" />,
            color: "text-red-600",
          },
        ].map((item, idx) => (
          <Card key={idx} className="shadow-md hover:shadow-lg">
            <CardHeader
              className={`flex items-center gap-2 ${item.color} px-3 py-3 md:px-6 md:py-6`}
            >
              {item.icon}
              <span className="font-semibold text-sm md:text-base">
                {item.title}
              </span>
            </CardHeader>
            <CardContent className="px-3 pb-4 md:px-6 md:pb-6">
              <h3 className="text-xl md:text-3xl font-bold">{item.value}</h3>
              <p className="text-xs md:text-sm text-gray-500">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alt Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Son Faaliyetler */}
        <Card className="shadow-md">
          <CardHeader className="flex items-center gap-2 text-emerald-600">
            <FaChartLine className="text-emerald-600" />
            <span className="font-semibold">Son Faaliyetler</span>
          </CardHeader>
          <CardContent>
            {firmalar.length === 0 ? (
              <p className="text-gray-500 text-sm">Henüz firma eklenmedi.</p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-700">
                {firmalar.slice(0, 5).map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 border-b pb-2"
                  >
                    <span className="truncate flex-1 min-w-0">{f.firmaAdi}</span>
                    <button
                      onClick={() => setDetail(f)}
                      className="p-1 border rounded hover:bg-gray-100 shrink-0"
                      title="Detay"
                    >
                      <HiEye />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Yaklaşan Raporlar ve Eğitimler */}
        <Card className="shadow-md">
          <CardHeader className="flex items-center gap-2 text-amber-600">
            <FaCalendarAlt className="text-amber-600" />
            <span className="font-semibold">Yaklaşan Raporlar ve Eğitimler</span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:block">
              {/* Raporlar */}
              <div className="mb-0 md:mb-4 min-w-0">
                <h4 className="font-semibold text-xs md:text-sm text-gray-700 mb-2">
                  Raporlar (0–60 gün)
                </h4>
                {yaklasanRaporlar.length === 0 ? (
                  <p className="text-gray-500 text-xs md:text-sm">
                    Yaklaşan rapor bulunmuyor.
                  </p>
                ) : (
                  <ul className="space-y-3 text-xs md:text-sm text-gray-700">
                    {yaklasanRaporlar.map((f) => (
                      <li
                        key={`rapor-${f.id}`}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3"
                      >
                        <span className="truncate min-w-0">{f.firmaAdi}</span>
                        <span
                          className={
                            "text-[11px] md:text-xs font-medium " +
                            getKalanGunColor(f.kalanGun)
                          }
                        >
                          Geçerlilik: {formatTR(f.gecerlilik)} ({f.kalanGun} gün)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Eğitimler */}
              <div className="min-w-0">
                <h4 className="font-semibold text-xs md:text-sm text-gray-700 mb-2">
                  Eğitimler (0–60 gün)
                </h4>
                {yaklasanEgitimler.length === 0 ? (
                  <p className="text-gray-500 text-xs md:text-sm">
                    Yaklaşan eğitim bulunmuyor.
                  </p>
                ) : (
                  <ul className="space-y-3 text-xs md:text-sm text-gray-700">
                    {yaklasanEgitimler.map((e, idx) => (
                      <li
                        key={`egitim-${e.firmaId}-${idx}`}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3"
                      >
                        <span className="truncate min-w-0">
                          {e.firmaAdi}
                          {e.adSoyad ? ` – ${e.adSoyad}` : ""}
                        </span>
                        <span
                          className={
                            "text-[11px] md:text-xs font-medium " +
                            getKalanGunColor(e.kalanGun)
                          }
                          title={`Bitiş: ${formatTR(e.bitisTarihi)} | Sınıf: ${
                            e.tehlike
                          } | +${e.yillar} yıl`}
                        >
                          Geçerlilik: {formatTR(e.gecerlilik)} ({e.kalanGun} gün)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detay Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white w-full max-w-2xl rounded shadow max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b px-4 py-3">
              <h3 className="font-semibold text-sm sm:text-base pr-3">
                {`Firma Detayları${
                  detail?.firmaAdi ? " - " + detail.firmaAdi : ""
                }`}
              </h3>
              <button onClick={() => setDetail(null)} className="p-2 shrink-0">
                <HiX />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Firma Adı:</strong> {detail.firmaAdi}
              </div>
              <div>
                <strong>SGK Sicil No:</strong> {detail.sgkSicilNo}
              </div>
              <div>
                <strong>Adres:</strong> {detail.adres}
              </div>
              <div>
                <strong>NACE:</strong> {detail.nace}
              </div>
              <div>
                <strong>Faaliyet:</strong> {detail.faaliyet}
              </div>
              <div>
                <strong>Tehlike:</strong> {detail.tehlike}
              </div>
              <div>
                <strong>Hazırlama:</strong> {formatTR(detail.hazirlama)}
              </div>
              <div>
                <strong>Geçerlilik:</strong> {formatTR(detail.gecerlilik)}
              </div>
              <div>
                <strong>Son Eğitim Bitiş:</strong>{" "}
                {formatTR(detailEgitimInfo?.sonBitis)}
              </div>
              <div>
                <strong>Eğitim Geçerlilik Sonu:</strong>{" "}
                {formatTR(detailEgitimInfo?.sonGecerlilik)}
                {detailEgitimInfo?.sonGecerlilik
                  ? ` (${diffDaysFromToday(
                      detailEgitimInfo.sonGecerlilik
                    )} gün)`
                  : ""}
              </div>
            </div>

            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setDetail(null)}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-md text-xs transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;