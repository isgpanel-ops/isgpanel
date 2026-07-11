import React, { useMemo, useRef, useState, useEffect } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useFirmalar } from "../../context/FirmaContext";
import faaliyetList from "../../data/faaliyetList.json";
import { PrimaryButton } from "../../components/ui";
import ConfirmModal from "../../components/ui/ConfirmModal";

// ✅ DEMO KONTROL (tüm olası user key’lerini tarar)
function isDemoUser() {
  const parse = (k) => {
    try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; }
  };

  // 1) localStorage user objeleri
  const user =
    parse("user") ||
    parse("ticari_user") ||
    parse("bireysel_user") ||
    parse("auth_user") ||
    parse("currentUser");

  if (user?.isDemo === true || user?.demo === true || user?.role === "demo" || user?.planCode === "demo") return true;

  // 2) JWT payload tarama (token hangi key’deyse)
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("jwt");

  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return !!(payload?.isDemo || payload?.role === "demo" || payload?.planCode === "demo");
  } catch {
    return false;
  }
}




/* ==================== SABİTLER ==================== */
const SCALE = 0.7;
const STICKY_MAX_HEIGHT = "520px";
const A4_LANDSCAPE_CSS_PX = 1122; // yaklaşık A4 yatay CSS px
const USE_A4_PAGE_MODE = true;

const HEADERS_LEFT = [
  "NO",
  "BÖLÜM",
  "FAALİYET",
  "TEHLİKE",
  "RİSK",
  "SONUÇ",
  "ETKİ ALANI",
  "OLASILIK",
  "ŞİDDET",
  "RDS",
  "RİSK TANIMI",
];
const HEADERS_RIGHT = [
  "ALINACAK ÖNLEMLER",
  "MEVCUT DURUM",
  "SORUMLU",
  "TERMİN",
  "OLASILIK",
  "ŞİDDET",
  "RDS",
];

/* SON DEĞERLENDİRMEYİ OTOMATİK ÜRETME BAYRAĞI */
const AUTO_SON_FROM_RDS = false;
/* İlk RDS → Son RDS dönüşümü (A→B=15, B→C=9, C→D=5, D→D=4) */
function mapRdsToSon(rds) {
  if (rds >= 20) return { ol: 3, sd: 5, rds: 15 };
  if (rds >= 12) return { ol: 3, sd: 3, rds: 9 };
  if (rds >= 6) return { ol: 1, sd: 5, rds: 5 };
  return { ol: 1, sd: 4, rds: 4 };
}

/* Sorumlu seçenekleri */
const SORUMLU_SECENEKLERI = [
  "İşveren / İşveren Vekili",
  "İSG Profesyonelleri",
  "Birim / Bölüm Amirleri",
  "Çalışan Temsilcisi",
  "Ekip Liderleri",
  "Bakım Onarım Sorumluları",
  "Kalite / Teknik Sorumlular",
  "Çalışanlar",
  "İdari İşler / İnsan Kaynakları",
];

/* Etki Alanı seçenekleri */
const ETKI_SECENEKLERI = [
  "Çalışanlar",
  "Ziyaretçiler",
  "Müşteriler",
  "Tedarikçiler",
  "Stajyerler ve Çıraklar",
  "Yönetici ve Ofis Personeli",
  "Engelli Çalışanlar",
  "Alt İşveren Çalışanları",
];

/* Mevcut Durum seçenekleri (çoklu seçim) */
const MD_SECENEKLERI = [
  "Çalışma alanı düzenli olarak denetlenmekte ve uygunluk sağlanmaktadır.",
  "Riskleri azaltmaya yönelik mevcut önlemler etkin şekilde uygulanmaktadır.",
  "Çalışma alanı düzeni (5S vb.) uygulanmakta ve devamlılığı sağlanmaktadır.",
  "Denetim ve gözlemler sonucunda tespit edilen uygunsuzluklar giderilmektedir.",
  "Çalışanlar tehlike bildirim süreçleri hakkında bilgilendirilmiştir.",
  "Mevzuat gerekliliklerine uyum düzenli olarak takip edilmektedir.",
];
const MD_KNOWN = new Set(MD_SECENEKLERI);

const TERMIN_SECENEKLERI = [...Array.from({ length: 12 }, (_, i) => `${i + 1} Ay`), "Sürekli"];

const riskEtiketi = (p) =>
  p >= 16 ? "Çok Yüksek Risk" : p >= 12 ? "Yüksek Risk" : p >= 6 ? "Orta Seviye Risk" : "Toler edilebilir Risk";

/* ==================== LOGO ==================== */
const DUMMY_LOGO = "https://dummyimage.com/180x80/eeeeee/999999.png&text=LOGO";
const LOGO_OVERRIDE_KEY = "RD:logoOverride";

function getLogoFromKurumsal() {
  try {
    const saved = localStorage.getItem("kurumsalBilgiler");
    if (!saved) return null;
    const obj = JSON.parse(saved);
    return obj?.logo || obj?.logoUrl || obj?.logoSrc || null;
  } catch {
    return null;
  }
}
function normalizeLogoSource(v) {
  if (!v) return null;
  if (typeof v === "object") {
    if (v.url) return v.url;
    if (v.src) return v.src;
    if (v.path) return v.path;
    if (v.href) return v.href;
  }
  if (typeof v === "string") return v;
  return null;
}
function resolveLogoUrl(firm, apiBase, kurumsal = null) {
  try {
    const ov = localStorage.getItem(LOGO_OVERRIDE_KEY);
    if (ov) return ov;
  } catch {}

  const kLogo = getLogoFromKurumsal();

  const kc = firm?.kurumsalKimlik || firm?.kurumsal || {};

 const candidates = [
  kurumsal?.logo,
  kurumsal?.logoUrl,
  kurumsal?.logoSrc,
  kurumsal?.logoPath,
  kurumsal?.logoBase64,
  kurumsal?.logoDataUrl,

  kLogo,

  kc.logoUrl,
  kc.logo,
  kc.logoSrc,
  kc.logoPath,
  kc.logoBase64,
  kc.logoDataUrl,

  firm?.logoUrl,
  firm?.logo,
  firm?.logoSrc,
  firm?.logoPath,
  firm?.logoBase64,
  firm?.logoDataUrl,
];

  for (const c of candidates) {
    const u = normalizeLogoSource(c);
    if (!u) continue;

    if (/^(https?:|data:|blob:)/i.test(u)) return u;

    // uploads kesin API domainine gitsin
    if (String(u).startsWith("/uploads")) {
      return `https://api.isgpanel.tr${u}`;
    }

    return `${apiBase}${String(u).startsWith("/") ? "" : "/"}${u}`;
  }

  return DUMMY_LOGO;
}

/* ========= Kolon genişlikleri: sabit ========= */
const COLW = {
  no: 50,
  bolum: 120,
  faaliyet: 165,
  tehlike: 175,
  risk: 175,
  sonuc: 155,
  etki: 165,
  ol: 60,
  sd: 60,
  rds: 60,
  riskTnm: 155,
  onlem: 205,
  md: 185,
  sorumlu: 185,
  term: 120,
  sol: 60,
  ssd: 60,
  srds: 60,
};
const TABLE_BASE_WIDTH = Object.values(COLW).reduce((a, b) => a + b, 0);

/* ==================== Resize Hook ==================== */
function useContainerWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ==================== Ölçekli Wrapper (A4 + auto-fit) ==================== */
function ScaledWrapper({ children, maxHeight }) {
  const [ref, outer] = useContainerWidth();

 const targetW = outer || window.innerWidth || A4_LANDSCAPE_CSS_PX;

const fitScale = targetW / TABLE_BASE_WIDTH;
const scaleEff = Math.max(0.5, Math.min(SCALE, fitScale));
const innerW = TABLE_BASE_WIDTH;

  const supportsZoom = typeof CSS !== "undefined" && (CSS.supports?.("zoom", 1) ?? false);

  return (
    <div
  ref={ref}
  className="bg-white w-full"
  style={{
    maxHeight,
    overflowY: "auto",
    overflowX: "auto",
    paddingLeft: 16,
    paddingRight: 16,
    scrollbarGutter: "stable",
  }}
>
  <div style={{ width: "100%", margin: "0 auto" }}>
        <div
          style={
            supportsZoom
              ? { width: innerW, zoom: scaleEff }
              : {
                  width: innerW,
                  transform: `scale(${scaleEff})`,
                  transformOrigin: "top left",
                }
          }
        >
          {children(innerW)}
        </div>
      </div>
    </div>
  );
}

/* ==================== PDF/PRINT WRAPPER (SCALE YOK!) ==================== */
/* 🔥 Güncellendi: Önizleme/PDF için A4 yatay tuval + istenen kenar boşlukları + sağ üst sayfa no */
const A4_LANDSCAPE_HEIGHT_CSS_PX = 793; // yaklaşık A4 yatay CSS px (1122x793)

// Kullanıcı isteği: sağ/sol 0.5cm, üst/alt 1cm
const CM_TO_PX = 37.7952755906; // 96dpi varsayımı
const PRINT_MARGIN_X_PX = Math.round(0.5 * CM_TO_PX); // ~19px
const PRINT_MARGIN_Y_PX = Math.round(1.0 * CM_TO_PX); // ~38px

function PrintWrapper({ children, pageText }) {
  const demo = isDemoUser();
// DEBUG (geçici): demo true mu?
// console.log("DEMO?", demo, localStorage.getItem("user"), localStorage.getItem("ticari_user"), localStorage.getItem("bireysel_user"));

  return (
    <div style={{ width: "100%", margin: 0, padding: 0, background: "#fff" }}>
      <div
        className="rd-print-canvas"
        style={{
          position: "relative",
          width: "100%",
          minHeight: A4_LANDSCAPE_HEIGHT_CSS_PX,
          padding: `${PRINT_MARGIN_Y_PX}px ${PRINT_MARGIN_X_PX}px`,
          margin: 0,
          background: "#fff",
        }}
      >
        {demo && (
          <>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) rotate(-30deg)",
                fontSize: 96,
                color: "rgba(0,0,0,0.06)",
                fontWeight: 700,
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 10,
                whiteSpace: "nowrap",
              }}
            >
              İSG PANEL – DEMO
            </div>

            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 10,
                color: "#666",
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 10,
              }}
            >
              Demo sürüm – ticari kullanım için geçerli değildir
            </div>
          </>
        )}

        {!!pageText && (
          <div
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              fontSize: 11,
              fontWeight: 700,
              background: "rgba(255,255,255,0.85)",
              padding: "2px 6px",
              borderRadius: 6,
              zIndex: 11,
            }}
          >
            {pageText}
          </div>
        )}

        <div
          className="rd-print-flex"
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: A4_LANDSCAPE_HEIGHT_CSS_PX,
          }}
        >
          {children}
        </div>

        <style>{`
          .rd-print-flex > table { flex: 0 0 auto; }
          .rd-print-flex > table + div { margin-top: auto !important; }
          .rd-print-canvas table { font-family: Arial, Helvetica, sans-serif; }
          .rd-print-canvas th, .rd-print-canvas td { line-height: 1.15; vertical-align: middle; }
          .rd-print-canvas img { display: block; margin: 0 auto; }
        `}</style>
      </div>
    </div>
  );
}



/* ==================== Risk Renk Skalası ==================== */
function riskLabelClass(label) {
  const t = String(label || "").toLocaleLowerCase("tr-TR");

  if (t.includes("çok yüksek")) return "bg-red-600 text-white";
  if (t.includes("yüksek")) return "bg-yellow-500 text-black";
  if (t.includes("orta")) return "bg-green-600 text-white";
  if (t.includes("tolere") || t.includes("toler")) return "bg-blue-600 text-white";

  return "";
}

function buildUzmanKase(kisilerProsedur = {}, selectedFirm = {}) {
  const raw = kisilerProsedur?.uzman || "";

  const parts = String(raw)
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  const adSoyad = (parts[0] || "").toLocaleUpperCase("tr-TR");

  const kisiselBilgiler = (() => {
    try {
      return JSON.parse(localStorage.getItem("kisiselBilgiler") || "{}");
    } catch {
      return {};
    }
  })();

  const hamSertifikaNo =
    selectedFirm?.uzmanSertifikaNo ||
    selectedFirm?.kisisel?.sertifikaNo ||
    kisiselBilgiler?.sertifikaNo ||
    kisiselBilgiler?.uzmanSertifikaNo ||
    parts[1] ||
    "";

  const sertifikaNo = hamSertifikaNo
    ? String(hamSertifikaNo).toLocaleUpperCase("tr-TR").startsWith("İGU-")
      ? String(hamSertifikaNo).toLocaleUpperCase("tr-TR")
      : `İGU-${String(hamSertifikaNo).toLocaleUpperCase("tr-TR").replace(/^İGU-/i, "").trim()}`
    : "";

  const sertifikaSinifi =
    selectedFirm?.sertifikaSinifi ||
    selectedFirm?.kisisel?.sertifikaSinifi ||
    kisiselBilgiler?.sertifikaSinifi ||
    kisiselBilgiler?.uzmanlikSinifi ||
    "";

  const unvan = sertifikaSinifi
    ? `${String(sertifikaSinifi).toLocaleUpperCase("tr-TR")} SINIFI İŞ GÜVENLİĞİ UZMANI`
    : "İŞ GÜVENLİĞİ UZMANI";

  return {
    adSoyad,
    sertifikaNo,
    unvan,
  };
}

function buildHekimKase(kisilerProsedur = {}) {
  const raw = kisilerProsedur?.hekim || "";

  const parts = String(raw)
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  const adSoyad = (parts[0] || "").toLocaleUpperCase("tr-TR");
  const hamSertifikaNo = parts[1] || "";

  const sertifikaNo = hamSertifikaNo
    ? String(hamSertifikaNo).toLocaleUpperCase("tr-TR").startsWith("İH-")
      ? String(hamSertifikaNo).toLocaleUpperCase("tr-TR")
      : `İH-${String(hamSertifikaNo).toLocaleUpperCase("tr-TR").replace(/^İH-/i, "").trim()}`
    : "";

  return {
    adSoyad,
    sertifikaNo,
    unvan: "İŞYERİ HEKİMİ",
  };
}

/* ==================== TABLO ==================== */
function RiskTable({
  rows,
  firmaAdi,
  tehlikeSinifi,
  hazirlamaTarihi,
  gecerlilikTarihi,
  revNo,
  revDate,
  logoUrl,
  sgkSicilNo,
  tableWidth,
  kisilerProsedur,
  imzalarProsedur,
  selectedFirm,
  onEditMD,
  onEditSR,
  onEditTM,
  onEditEA,
  onEditSD,
  onMoveUp,
  onMoveDown,
  onDelete,
  selectedRows = new Set(),
  onToggleRow,
  preview = false,
  stickyHeader = true,
}) {
  const WRAP = "px-2 py-[6px] whitespace-pre-wrap break-words align-top";
  const revDateStr = revDate ? new Date(revDate).toLocaleDateString("tr-TR") : "-";

  const theadClass = stickyHeader ? "bg-white sticky top-0 z-20" : "bg-white";

  const theadStyle = {
    lineHeight: "1.1",
    whiteSpace: "normal",
  };

  return (
    <>
      <table className="table-fixed text-[11px] leading-[1.15]" style={{ width: tableWidth }}>
        <colgroup>
          <col style={{ width: COLW.no }} />
          <col style={{ width: COLW.bolum }} />
          <col style={{ width: COLW.faaliyet }} />
          <col style={{ width: COLW.tehlike }} />
          <col style={{ width: COLW.risk }} />
          <col style={{ width: COLW.sonuc }} />
          <col style={{ width: COLW.etki }} />
          <col style={{ width: COLW.ol }} />
          <col style={{ width: COLW.sd }} />
          <col style={{ width: COLW.rds }} />
          <col style={{ width: COLW.riskTnm }} />
          <col style={{ width: COLW.onlem }} />
          <col style={{ width: COLW.md }} />
          <col style={{ width: COLW.sorumlu }} />
          <col style={{ width: COLW.term }} />
          <col style={{ width: COLW.sol }} />
          <col style={{ width: COLW.ssd }} />
          <col style={{ width: COLW.srds }} />
        </colgroup>

        <thead className={theadClass} style={theadStyle}>
          <tr>
            <th className="border p-1" colSpan={3} rowSpan={2}>
              <img
                src={logoUrl}
                alt="Logo"
                // PDF/Önizleme birebir olsun: logoyu sabit ölçüde tut
                className="mx-auto w-[180px] h-[80px] object-contain"
                onError={(e) => {
                  e.currentTarget.src = DUMMY_LOGO;
                }}
              />
            </th>
            <th className="border text-center align-middle font-bold text-lg p-1" colSpan={10}>
              {firmaAdi}
            </th>
            <th className="border text-right align-middle text-[10px] p-1 leading-tight" colSpan={2}>
              DÜZENLENDİĞİ
              <br />
              TARİH
            </th>
            <th className="border text-center align-middle font-semibold p-1" colSpan={3}>
              {hazirlamaTarihi}
            </th>
          </tr>
          <tr>
            <th className="border text-center align-middle font-bold text-xl p-1" colSpan={10}>
              RİSK DEĞERLENDİRMESİ
            </th>
            <th className="border text-right align-middle text-[10px] p-1 leading-tight" colSpan={2}>
              GEÇERLİLİK
              <br />
              SÜRESİ
            </th>
            <th className="border text-center align-middle font-semibold p-1" colSpan={3}>
              {gecerlilikTarihi}
            </th>
          </tr>

          <tr>
            <th className="border p-1 text-right align-middle" colSpan={2}>
              REVİZYON TARİHİ
            </th>
            <th className="border p-1 text-center align-middle" colSpan={2}>
              {revDateStr}
            </th>
            <th className="border p-1 text-right align-middle" colSpan={2}>
              REVİZYON NO
            </th>
            <th className="border p-1 text-center align-middle" colSpan={2}>
              {revNo || "-"}
            </th>
            <th className="border p-1 text-right align-middle" colSpan={2}>
              TEHLİKE SINIFI
            </th>
            <th className="border p-1 text-center align-middle" colSpan={2}>
              {tehlikeSinifi}
            </th>
           <th className="border p-1 text-right align-middle" colSpan={2}>
  SGK SİCİL NO
</th>

<th className="border p-1 text-center whitespace-nowrap" colSpan={4}>
  {sgkSicilNo}
</th>
</tr>

<tr>
  <th className="border p-1 text-right align-middle" colSpan={2}>
    FİRMA ADRESİ
  </th>

  <th
    className="border p-1 text-center align-middle break-words"
    colSpan={16}
  >
    {selectedFirm?.adres || "-"}
  </th>
</tr>
          

          <tr className="font-semibold bg-white">
            <th className="border p-1" colSpan={7}>
              DEĞERLENDİRME TABLOSU
            </th>
            <th className="border p-1" colSpan={4}>
              DERECELENDİRME TABLOSU
            </th>
            <th className="border p-1" colSpan={4}>
              ÖNLEM TABLOSU
            </th>
            <th className="border p-1" colSpan={3}>
              SON DEĞERLENDİRME
            </th>
          </tr>
          <tr className="bg-gray-200">
            {HEADERS_LEFT.map((h, i) => (
              <th key={i} className="border text-[11px] leading-tight whitespace-normal text-center px-2 py-1">
                {h}
              </th>
            ))}
            {HEADERS_RIGHT.map((h, i) => (
              <th key={i} className="border text-[11px] leading-tight whitespace-normal text-center px-2 py-1">
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-gray-50">
              <td className="border text-center px-1 py-[6px]">
                <div className="flex items-center justify-center gap-1">
                  {!preview && (
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-blue-600"
                      checked={selectedRows.has(i)}
                      onChange={() => onToggleRow?.(i)}
                      title="Satırı seç"
                    />
                  )}
                  <span className="min-w-[22px] text-center">{r.no}</span>
                  {!preview && (
                    <div className="flex flex-col gap-[2px] ml-1">
                      <button className="border rounded px-[4px] leading-none" title="Yukarı Taşı" onClick={() => onMoveUp?.(i)}>
                        ▲
                      </button>
                      <button className="border rounded px-[4px] leading-none" title="Aşağı Taşı" onClick={() => onMoveDown?.(i)}>
                        ▼
                      </button>
                    </div>
                  )}
                  {!preview && (
                    <button className="ml-1 border rounded px-[6px] h-[22px] leading-none" title="Satırı Sil" onClick={() => onDelete?.(i)}>
                      🗑️
                    </button>
                  )}
                </div>
              </td>

              <td className={`border ${WRAP}`}>{r.bolum}</td>
              <td className={`border ${WRAP}`}>{r.faaliyet}</td>
              <td className={`border ${WRAP}`}>{r.tehlike}</td>
              <td className={`border ${WRAP}`}>{r.risk}</td>
              <td className={`border ${WRAP}`}>{r.sonuc}</td>

              <td className={`border ${WRAP}`}>
                <div className="flex items-start justify-between gap-2">
                  <span>{Array.isArray(r.etkiAlani) ? r.etkiAlani.join(", ") : r.etkiAlani}</span>
                  {!preview && (
                    <button className="text-[12px] shrink-0" title="Düzenle" onClick={() => onEditEA(i)}>
                      🏷️
                    </button>
                  )}
                </div>
              </td>

              {/* İlk değerlendirme */}
              <td className="border text-center px-2 py-[6px]">{r.olasilik}</td>
              <td className="border text-center px-2 py-[6px]">{r.siddet}</td>
              <td className={`border text-center px-2 py-[6px] font-medium ${riskLabelClass(r.riskTanimi)}`}>{r.rds}</td>

              <td className={`border ${WRAP}`}>{r.riskTanimi}</td>
              <td className={`border ${WRAP}`}>{r.onlemler}</td>

              <td className={`border ${WRAP}`}>
                <div className="flex items-start justify-between gap-2">
                  <span>{Array.isArray(r.mevcutDurum) ? r.mevcutDurum.join(", ") : r.mevcutDurum}</span>
                  {!preview && (
                    <button className="text-[12px] shrink-0" title="Düzenle" onClick={() => onEditMD(i)}>
                      ✎
                    </button>
                  )}
                </div>
              </td>

              <td className={`border ${WRAP}`}>
                <div className="flex items-start justify-between gap-2">
                  <span>{Array.isArray(r.sorumlu) ? r.sorumlu.join(", ") : r.sorumlu}</span>
                  {!preview && (
                    <button className="text-[12px] shrink-0" title="Düzenle" onClick={() => onEditSR(i)}>
                      👤
                    </button>
                  )}
                </div>
              </td>

              <td className={`border ${WRAP}`}>
                <div className="flex items-start justify-between gap-2">
                  <span>{r.termin}</span>
                  {!preview && (
                    <button className="text-[12px] shrink-0" title="Düzenle" onClick={() => onEditTM(i)}>
                      ⏱
                    </button>
                  )}
                </div>
              </td>

              {/* Son değerlendirme */}
              <td className="border text-center px-2 py-[6px]">{r.olasilikSon}</td>
              <td className="border text-center px-2 py-[6px]">{r.siddetSon}</td>
             <td className={`border text-center px-2 py-[6px] font-bold ${riskLabelClass(r.riskTanimiSon)}`}>
  <div>{r.rdsSon === 0 ? 0 : r.rdsSon ?? ""}</div>
  {!preview && (
    <button className="ml-2 text-[12px]" title="Son Değerlendirme Düzenle" onClick={() => onEditSD(i)}>
      ✎
    </button>
  )}
</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* === İMZA BLOĞU (PROSEDÜR KİŞİLERİNDEN OTOMATİK) === */}
            <div style={{ width: tableWidth }} className="mt-4 flex gap-2 flex-nowrap">
        {[
          { label: "İşveren / İşveren Vekili", key: "isveren" },
          { label: "İş Güvenliği Uzmanı", key: "uzman" },
          { label: "İşyeri Hekimi", key: "hekim" },
          { label: "Çalışan Temsilcisi", key: "temsilci" },
          { label: "Destek Elemanı", key: "destek" },
          { label: "Bilgi Sahibi Kişi", key: "bilgi" },
        ].map(({ label, key }) => {
         const rawName =
  kisilerProsedur && typeof kisilerProsedur === "object"
    ? kisilerProsedur[key]
    : "";

const uzmanKase = key === "uzman"
  ? buildUzmanKase(kisilerProsedur, selectedFirm)
  : null;

const hekimKase = key === "hekim"
  ? buildHekimKase(kisilerProsedur)
  : null;

const aktifKase = uzmanKase || hekimKase;

const name =
  key === "uzman"
    ? uzmanKase?.adSoyad
    : (rawName ? String(rawName).split("/")[0].toUpperCase() : "");

          const signObj =
            imzalarProsedur && typeof imzalarProsedur === "object"
              ? imzalarProsedur[key]
              : null;

          const signUrl = preview
            ? signObj?.paraf?.dataUrl || signObj?.imza?.dataUrl || ""
            : signObj?.imza?.dataUrl || signObj?.paraf?.dataUrl || "";

          return (
            <div key={label} className="flex-1 text-center text-[10px]">
  <div className="font-semibold mb-1 leading-tight">
    {key === "uzman" ? (uzmanKase?.unvan || label) : label}
  </div>

  <div className="h-[56px] border border-gray-300 flex items-center justify-center bg-white overflow-hidden relative">
  {aktifKase ? (
    <div className="absolute left-0 right-0 bottom-[14px] text-center leading-[1.05] text-blue-700/60 font-bold pointer-events-none">
      <div className="text-[9px]">{aktifKase.adSoyad}</div>
      <div className="text-[7px]">{aktifKase.unvan}</div>
      {aktifKase.sertifikaNo ? (
        <div className="text-[7px]">{aktifKase.sertifikaNo}</div>
      ) : null}
    </div>
  ) : null}

  {signUrl ? (
    <img
      src={signUrl}
      alt={label}
      className="max-h-[44px] max-w-full object-contain relative z-10"
    />
  ) : null}
</div>

  <div className="border-t mt-1 pt-1 leading-tight">
  {aktifKase ? (
    <div>{aktifKase.adSoyad || "AD - SOYAD"}</div>
  ) : (
    name && String(name).trim()
      ? String(name).toUpperCase()
      : "AD - SOYAD"
  )}
</div>
</div>
          );
        })}
      </div>
      {/* === İMZA BLOĞU SONU === */}
    </>
  );
}

/* ==================== SAYFA ==================== */
export default function RiskDegerlendirmesi() {
  const { selectedFirm } = useFirmalar();

  const API_BASE =
    (import.meta.env.VITE_API_URL || "https://api.isgpanel.tr/api")
      .trim()
      .replace(/\/$/, "");

  const firmaAdi = selectedFirm?.firmaAdi || "-";
  const tehlikeSinifi = selectedFirm?.tehlike || "-";
  const hazirlamaTarihi = selectedFirm?.hazirlama ? new Date(selectedFirm.hazirlama).toLocaleDateString("tr-TR") : "-";
  const gecerlilikTarihi = selectedFirm?.gecerlilik ? new Date(selectedFirm.gecerlilik).toLocaleDateString("tr-TR") : "-";
  const sgkSicilNo = selectedFirm?.sgkSicilNo || "-";

const [kurumsal, setKurumsal] = useState(null);

useEffect(() => {
  const loadKurumsal = () => {
    try {
      const raw = localStorage.getItem("kurumsalBilgiler");
      if (raw) setKurumsal(JSON.parse(raw));
      else setKurumsal(null);
    } catch {
      setKurumsal(null);
    }
  };

  loadKurumsal();

  window.addEventListener("storage", loadKurumsal);
  window.addEventListener("kurumsalBilgilerUpdated", loadKurumsal);

  return () => {
    window.removeEventListener("storage", loadKurumsal);
    window.removeEventListener("kurumsalBilgilerUpdated", loadKurumsal);
  };
}, []);

  const [logoSrc, setLogoSrc] = useState(DUMMY_LOGO);
  useEffect(() => {
  let cancelled = false;

  const loadLogo = async () => {
    const nextLogo = resolveLogoUrl(selectedFirm, API_BASE, kurumsal);

    console.log("RD LOGO DEBUG:", {
      selectedFirmLogo: selectedFirm?.logo,
      selectedFirmLogoUrl: selectedFirm?.logoUrl,
      kurumsalLogo: selectedFirm?.kurumsalKimlik?.logo,
      kurumsalLogoUrl: selectedFirm?.kurumsalKimlik?.logoUrl,
      resolvedLogo: nextLogo,
    });

    if (!nextLogo) {
      if (!cancelled) setLogoSrc(DUMMY_LOGO);
      return;
    }

    if (String(nextLogo).startsWith("data:image")) {
      if (!cancelled) setLogoSrc(nextLogo);
      return;
    }

    try {
      const token = getAuthTokenSafe?.();

      const res = await fetch(nextLogo, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Logo alınamadı");

      const blob = await res.blob();

      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(blob);
      });

      if (!cancelled) setLogoSrc(dataUrl || DUMMY_LOGO);
    } catch (e) {
      console.error("Risk logo base64 çevrilemedi:", e);
      if (!cancelled) setLogoSrc(DUMMY_LOGO);
    }
  };

  loadLogo();

  return () => {
    cancelled = true;
  };
}, [selectedFirm, kurumsal, API_BASE]);

  /* 🔹 Prosedür kişi bilgilerini: önce API'den çek, yoksa localStorage fallback */


function getAuthTokenSafe() {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken")
    );
  } catch {
    return null;
  }
}

const firmId = selectedFirm?.id || selectedFirm?._id || null;
const firmKey = useMemo(() => `risk_prosedur_kisiler_${firmId ?? "default"}`, [firmId]);

const [prosedurKisiler, setProsedurKisiler] = useState({
  isveren: "",
  uzman: "",
  hekim: "",
  temsilci: "",
  destek: "",
  bilgi: "",
});

const [prosedurImzalar, setProsedurImzalar] = useState({
  isveren: { imza: null, paraf: null },
  uzman: { imza: null, paraf: null },
  hekim: { imza: null, paraf: null },
  temsilci: { imza: null, paraf: null },
  destek: { imza: null, paraf: null },
  bilgi: { imza: null, paraf: null },
});

useEffect(() => {
  if (!firmId) return;

  const token = getAuthTokenSafe();

  const pick = (p) => ({
    isveren: (p?.isveren || p?.isverenVekiliAdSoyad || "").toString(),
    uzman: (p?.uzman || p?.isgUzmaniAdSoyad || "").toString(),
    hekim: (p?.hekim || p?.isyeriHekimiAdSoyad || "").toString(),
    temsilci: (p?.temsilci || p?.calisanTemsilcisiAdSoyad || "").toString(),
    destek: (p?.destek || p?.destekElemaniAdSoyad || "").toString(),
    bilgi: (p?.bilgi || p?.bilgiSahibiKisiAdSoyad || "").toString(),
  });

    const load = async () => {
    // 1) API varsa onu dene
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/firma/${firmId}/kisiler`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const mapped = pick(data || {});
          setProsedurKisiler((prev) => ({ ...prev, ...mapped }));

          try {
            const signRes = await fetch(`${API_BASE}/firma/${firmId}/imzalar`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (signRes.ok) {
              const signData = await signRes.json();
              setProsedurImzalar({
                isveren: signData?.isveren || { imza: null, paraf: null },
                uzman: signData?.uzman || { imza: null, paraf: null },
                hekim: signData?.hekim || { imza: null, paraf: null },
                temsilci: signData?.temsilci || { imza: null, paraf: null },
                destek: signData?.destek || { imza: null, paraf: null },
                bilgi: signData?.bilgi || { imza: null, paraf: null },
              });
            } else {
              setProsedurImzalar({
                isveren: { imza: null, paraf: null },
                uzman: { imza: null, paraf: null },
                hekim: { imza: null, paraf: null },
                temsilci: { imza: null, paraf: null },
                destek: { imza: null, paraf: null },
                bilgi: { imza: null, paraf: null },
              });
            }
          } catch (e) {
            console.error("Risk: imza bilgileri API'den alınamadı:", e);
          }

          return;
        }
      } catch (e) {
        console.error("Risk: kişi bilgileri API'den alınamadı:", e);
      }
    }

    // 2) Fallback: localStorage
    try {
      const raw = localStorage.getItem(firmKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          setProsedurKisiler((prev) => ({ ...prev, ...saved }));
        }
      }
    } catch (e) {
      console.error("Risk: kişi bilgileri localStorage okunamadı:", e);
    }
  };

  load();
}, [API_BASE, firmId, firmKey]);

  /* Arama + Faaliyet Seç (custom dropdown) */
  const [query, setQuery] = useState("");
  const faaliyetAZ = useMemo(() => {
    const arr = Array.isArray(faaliyetList) ? faaliyetList : [];
    return [...arr].sort((a, b) => (a.faaliyet || "").localeCompare(b.faaliyet || "", "tr"));
  }, []);
  const searchResults = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return [];
    return faaliyetAZ
      .filter((f) => (f.faaliyet || "").toLocaleLowerCase("tr-TR").includes(q))
      .map((f) => ({ data: f }));
  }, [query, faaliyetAZ]);

  const [rows, setRows] = useState([]);

/* ========== Server Tabanlı Taslak ========== */
const [draftExists, setDraftExists] = useState(false);
const [draftSavedAt, setDraftSavedAt] = useState(null);
const [savingDraft, setSavingDraft] = useState(false);
const [loadingDraft, setLoadingDraft] = useState(false);
const [savingDoc, setSavingDoc] = useState(false);
const saveLockRef = useRef(false);
const DOCS_SYNC_KEY = "docs:lastChangeAt";

function getFirmIdSafe(firm) {
  return firm?._id || firm?.id || null;
}

function buildDraftPayload({
  rows,
  revNo,
  revDate,
  pageNo,
  rowStart,
  pageNoLocked,
}) {
  return {
    rows: Array.isArray(rows) ? rows : [],
    revNo: revNo || "",
    revDate: revDate || "",
    pageNo: pageNo || "",
    rowStart: rowStart || "",
    pageNoLocked: !!pageNoLocked,
    savedAt: new Date().toISOString(),
  };
}

  const kullanilanFaaliyetler = useMemo(() => new Set(rows.map((r) => r.faaliyet)), [rows]);

  const tumFaaliyetAdlari = useMemo(() => faaliyetAZ.map((x) => x.faaliyet).filter(Boolean), [faaliyetAZ]);

  const addFaaliyet = (srcFaaliyet) => {
    if (!srcFaaliyet) return;
    const src = typeof srcFaaliyet === "string" ? faaliyetAZ.find((x) => x.faaliyet === srcFaaliyet) : srcFaaliyet.data;
    if (!src) return;
    if (kullanilanFaaliyetler.has(src.faaliyet)) return;

    const tehlikeler = Array.isArray(src.tehlikeler) ? src.tehlikeler : [];
    const start = rows.length;

   const yeni = tehlikeler.length
  ? tehlikeler.map((t, i) => {
      const oIlk = Number(t.olasilik_ilk ?? t.olasilik) || 1;
      const sIlk = Number(t.siddet_ilk ?? t.siddet) || 1;
      const rIlk = Number(t.risk_ilk ?? (oIlk * sIlk)) || (oIlk * sIlk);

      const oSon = Number(t.olasilik_son ?? "") || "";
      const sSon = Number(t.siddet_son ?? "") || "";
      const rSon =
        t.risk_son !== undefined && t.risk_son !== null && t.risk_son !== ""
          ? Number(t.risk_son)
          : oSon !== "" && sSon !== ""
          ? Number(oSon) * Number(sSon)
          : "";

      return {
        no: start + i + 1,
        bolum: src.bolum || "Genel Saha",
        faaliyet: src.faaliyet || "-",
        tehlike: t.tehlike || "-",
        risk: t.risk || "-",
        sonuc: t.sonuc || "-",
        etkiAlani: [],
        olasilik: oIlk,
        siddet: sIlk,
        rds: rIlk,
        riskTanimi: t.risk_seviyesi_ilk || riskEtiketi(rIlk),
        onlemler: t.onlem || "",
        mevcutDurum: [],
        sorumlu: [],
        termin: "-",
        olasilikSon: oSon,
        siddetSon: sSon,
        rdsSon: rSon,
        riskTanimiSon: t.risk_seviyesi_son || (rSon !== "" ? riskEtiketi(rSon) : ""),
      };
    })
     : [
    {
      no: start + 1,
      bolum: src.bolum || "Genel Saha",
      faaliyet: src.faaliyet || "-",
      tehlike: "-",
      risk: "-",
      sonuc: "-",
      etkiAlani: [],
      olasilik: 1,
      siddet: 1,
      rds: 1,
      riskTanimi: "Toler edilebilir Risk",
      onlemler: "",
      mevcutDurum: [],
      sorumlu: [],
      termin: "-",
      olasilikSon: "",
      siddetSon: "",
      rdsSon: "",
      riskTanimiSon: "",
    },
  ];

    setRows((prev) => [...prev, ...yeni]);
  };

  /* Sayfa No & numaralandırma */
  const [pageNo, setPageNo] = useState("");
  const [pageNoLocked, setPageNoLocked] = useState(false);
  const [rowStart, setRowStart] = useState("");
  const getStartNo = () => (String(rowStart || "").trim() === "" ? 1 : Number(rowStart));
  const renumberRows = (start = 1) => setRows((prev) => prev.map((r, idx) => ({ ...r, no: Number(start) + idx })));
  const renumberFromCurrentStart = (list) => list.map((r, idx) => ({ ...r, no: getStartNo() + idx }));

  /* Modallar */
  const [preview, setPreview] = useState(false);
  const [revModal, setRevModal] = useState(false);
  const [hazirlaModal, setHazirlaModal] = useState(false);
  const [revNo, setRevNo] = useState("");
  const [revDate, setRevDate] = useState("");
  const [sayfaNoInput, setSayfaNoInput] = useState("");
  const [satirStartInput, setSatirStartInput] = useState("");

  // 🔔 Profesyonel Popup (ConfirmModal) state’leri
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: "",
    message: "",
    variant: "info", // info | warning | danger
    confirmText: "Yine de Kaydet",
    cancelText: "İptal",
    onConfirm: () => setConfirmOpen(false),
    onCancel: null,
  });

  const showInfo = (message, title = "Bilgilendirme") => {
    setConfirmData({
      title,
      message,
      variant: "info",
      confirmText: "Tamam",
      cancelText: "İptal",
      onConfirm: () => setConfirmOpen(false),
      onCancel: null,
    });
    setConfirmOpen(true);
  };

  const showError = (message, title = "Hata") => {
    setConfirmData({
      title,
      message,
      variant: "danger",
      confirmText: "Tamam",
      cancelText: "İptal",
      onConfirm: () => setConfirmOpen(false),
      onCancel: null,
    });
    setConfirmOpen(true);
  };

  const showConfirm = ({ title = "Uyarı", message, onConfirm, confirmText = "Yine de Kaydet", cancelText = "İptal" }) => {
    setConfirmData({
      title,
      message,
      variant: "warning",
      confirmText,
      cancelText,
      onConfirm: () => {
        setConfirmOpen(false);
        onConfirm?.();
      },
      onCancel: () => setConfirmOpen(false),
    });
    setConfirmOpen(true);
  };

useEffect(() => {
  const syncDocs = (e) => {
    if (e?.type === "storage" && e.key && e.key !== DOCS_SYNC_KEY) return;

    

    setPreview(false);
  };

  window.addEventListener("storage", syncDocs);
  window.addEventListener("documentsUpdated", syncDocs);

  return () => {
    window.removeEventListener("storage", syncDocs);
    window.removeEventListener("documentsUpdated", syncDocs);
  };
}, []);

 /* ✅ Firma değişince taslağı server'dan yükle */
useEffect(() => {
  const firmIdSafe = getFirmIdSafe(selectedFirm);

  if (!firmIdSafe) {
    setRows([]);
    setDraftExists(false);
    setDraftSavedAt(null);
    setRevNo("");
    setRevDate("");
    setPageNo("");
    setRowStart("");
    setPageNoLocked(false);
    return;
  }

  const token = getAuthTokenSafe();
  if (!token) {
    setRows([]);
    setDraftExists(false);
    setDraftSavedAt(null);
    setRevNo("");
    setRevDate("");
    setPageNo("");
    setRowStart("");
    setPageNoLocked(false);
    return;
  }

  let cancelled = false;

  const loadDraft = async () => {
    setLoadingDraft(true);

    try {
      const res = await fetch(`${API_BASE}/risk-assessments/draft/${firmIdSafe}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (cancelled) return;

      if (res.status === 404) {
        setRows([]);
        setDraftExists(false);
        setDraftSavedAt(null);
        setRevNo("");
        setRevDate("");
        setPageNo("");
        setRowStart("");
        setPageNoLocked(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error("Risk taslağı alınamadı:", res.status, text);
        showError("Risk değerlendirmesi taslağı server'dan alınamadı.");
        return;
      }

      const saved = await res.json();
      const payload = saved?.payload || saved;

      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      setRevNo(payload?.revNo || "");
      setRevDate(payload?.revDate || "");
      setPageNo(payload?.pageNo || "");
      setRowStart(payload?.rowStart || "");
      setPageNoLocked(!!payload?.pageNoLocked);
      setDraftExists(true);
      setDraftSavedAt(payload?.savedAt || saved?.updatedAt || null);
    } catch (e) {
      if (!cancelled) {
        console.error("Risk taslağı okunamadı:", e);
        showError("Taslak okunurken hata oluştu.");
      }
    } finally {
      if (!cancelled) setLoadingDraft(false);
    }
  };

  loadDraft();

  return () => {
    cancelled = true;
  };
}, [selectedFirm, API_BASE]);

  const saveDraft = async () => {
  const firmIdSafe = getFirmIdSafe(selectedFirm);

  if (!firmIdSafe) {
    showInfo("Lütfen üst bardan bir firma seçiniz.");
    return;
  }

  const token = getAuthTokenSafe();
  if (!token) {
    showError("Oturum bilgisi bulunamadı.");
    return;
  }

  if (savingDraft) return;
  setSavingDraft(true);

  try {
    const payload = buildDraftPayload({
      rows,
      revNo,
      revDate,
      pageNo,
      rowStart,
      pageNoLocked,
    });

    const res = await fetch(`${API_BASE}/risk-assessments/draft/${firmIdSafe}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firmaId: String(firmIdSafe),
        firmaAdi: selectedFirm?.firmaAdi || "",
        payload,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Risk taslağı kaydedilemedi:", res.status, text);
      showError(`Kaydetme sırasında hata oluştu.\n\nHata Kodu: ${res.status}`);
      return;
    }

    let saved = null;
    try {
      saved = await res.json();
    } catch {
      saved = null;
    }

    setDraftExists(true);
    setDraftSavedAt(saved?.payload?.savedAt || payload.savedAt);

    try {
      localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));
      window.dispatchEvent(new Event("documentsUpdated"));
      window.dispatchEvent(new Event("riskDraftUpdated"));
    } catch {}

    showInfo("Risk değerlendirmesi kaydedildi ✅");
  } catch (e) {
    console.error("Taslak kaydedilemedi:", e);
    showError("Kaydetme sırasında hata oluştu.");
  } finally {
    setSavingDraft(false);
  }
};

useEffect(() => {
  const firmIdSafe = getFirmIdSafe(selectedFirm);
  const token = getAuthTokenSafe();

  if (!firmIdSafe || !token) return;

  const reloadDraft = async () => {
    try {
      const res = await fetch(`${API_BASE}/risk-assessments/draft/${firmIdSafe}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) return;

      const saved = await res.json();
      const payload = saved?.payload || saved;

      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      setRevNo(payload?.revNo || "");
      setRevDate(payload?.revDate || "");
      setPageNo(payload?.pageNo || "");
      setRowStart(payload?.rowStart || "");
      setPageNoLocked(!!payload?.pageNoLocked);
      setDraftExists(true);
      setDraftSavedAt(payload?.savedAt || saved?.updatedAt || null);
    } catch (e) {
      console.error("Risk taslağı yeniden yüklenemedi:", e);
    }
  };

  const onFocus = () => reloadDraft();
  const onVisibility = () => {
    if (document.visibilityState === "visible") reloadDraft();
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("riskDraftUpdated", onFocus);

  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("riskDraftUpdated", onFocus);
  };
}, [selectedFirm, API_BASE]);

  /* Pop-up state’leri */
  const [mdOpen, setMdOpen] = useState(false);
  const [srOpen, setSrOpen] = useState(false);
  const [tmOpen, setTmOpen] = useState(false);
  const [eaOpen, setEaOpen] = useState(false);
  const [sdOpen, setSdOpen] = useState(false);
  const [aktifIndex, setAktifIndex] = useState(-1);

  const [mdSelected, setMdSelected] = useState([]);
  const [mdManual, setMdManual] = useState("");
  const [mdApplyAll, setMdApplyAll] = useState(false);

  const [srList, setSrList] = useState([]);
  const [srApplyAll, setSrApplyAll] = useState(false);

  const [tmDeger, setTmDeger] = useState("");
  const [tmApplyAll, setTmApplyAll] = useState(false);

  const [eaList, setEaList] = useState([]);
  const [eaNew, setEaNew] = useState("");
  const [eaApplyAll, setEaApplyAll] = useState(false);

  const [sdOl, setSdOl] = useState("");
  const [sdSd, setSdSd] = useState("");
  const [sdApplyAll, setSdApplyAll] = useState(false);

  /* Açılır/Kapanır 'Faaliyet Seç' Dropdown */
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!dropRef.current) return;
      if (!dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const notUsedFaaliyetler = useMemo(() => tumFaaliyetAdlari.filter((adi) => !kullanilanFaaliyetler.has(adi)), [tumFaaliyetAdlari, kullanilanFaaliyetler]);

  /* Sayfa No artışı (önizlemede) */
  const asNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const pageNoFor = (base, activePage) => {
    const n = asNumber(base);
    if (n !== null) return String(n + (activePage - 1));
    return base || "";
  };

  /* Açıcılar */
  const onEditMD = (i) => {
    setAktifIndex(i);
    const r = rows[i];
    const list = Array.isArray(r?.mevcutDurum)
      ? r.mevcutDurum
      : r?.mevcutDurum && r?.mevcutDurum !== "-"
      ? String(r.mevcutDurum)
          .split(/\s*;\s*|\s*,\s*/)
          .filter(Boolean)
      : [];
    const known = list.filter((x) => MD_KNOWN.has(x));
    const other = list.filter((x) => !MD_KNOWN.has(x)).join("; ");
    setMdSelected(known);
    setMdManual(other);
    setMdOpen(true);
  };
  const onEditSR = (i) => {
    setAktifIndex(i);
    const r = rows[i];
    setSrList(Array.isArray(r?.sorumlu) ? r.sorumlu : r?.sorumlu ? [r.sorumlu] : []);
    setSrApplyAll(false);
    setSrOpen(true);
  };
  const onEditTM = (i) => {
    setAktifIndex(i);
    const r = rows[i];
    setTmDeger(r?.termin || "");
    setTmApplyAll(false);
    setTmOpen(true);
  };
  const onEditEA = (i) => {
    setAktifIndex(i);
    const r = rows[i];
    const cur = r?.etkiAlani;
    setEaList(Array.isArray(cur) ? cur : cur && cur !== "-" ? [cur] : []);
    setEaApplyAll(false);
    setEaNew("");
    setEaOpen(true);
  };
  const onEditSD = (i) => {
    setAktifIndex(i);
    const r = rows[i] || {};
    setSdOl(r.olasilikSon === 0 ? 0 : r.olasilikSon ?? "");
    setSdSd(r.siddetSon === 0 ? 0 : r.siddetSon ?? "");
    setSdApplyAll(false);
    setSdOpen(true);
  };

  /* Kaydet – Mevcut Durum */
  const saveMD = () => {
    const combined = [...mdSelected, ...(mdManual.trim() ? [mdManual.trim()] : [])];
    if (combined.length === 0) return;

    setRows((prev) => {
      const clone = prev.map((x) => ({ ...x }));
      const apply = (r) => {
        r.mevcutDurum = combined;
      };
      if (mdApplyAll) clone.forEach(apply);
      else if (clone[aktifIndex]) apply(clone[aktifIndex]);
      return clone;
    });
    setMdOpen(false);
  };

  /* Kaydet – Sorumlu */
  const toggleSR = (name, checked) => {
    setSrList((prev) => {
      const s = new Set(prev);
      if (checked) s.add(name);
      else s.delete(name);
      return [...s];
    });
  };
  const saveSR = () => {
    setRows((prev) => {
      const clone = prev.map((x) => ({ ...x }));
      if (srApplyAll) clone.forEach((r) => (r.sorumlu = [...srList]));
      else if (clone[aktifIndex]) clone[aktifIndex].sorumlu = [...srList];
      return clone;
    });
    setSrOpen(false);
  };

  /* Kaydet – Termin */
  const saveTM = () => {
    if (!tmDeger) return;
    setRows((prev) => {
      const clone = prev.map((x) => ({ ...x }));
      if (tmApplyAll) clone.forEach((r) => (r.termin = tmDeger));
      else if (clone[aktifIndex]) clone[aktifIndex].termin = tmDeger;
      return clone;
    });
    setTmOpen(false);
  };

  /* Kaydet – Etki Alanı */
  const toggleEA = (name, checked) => {
    setEaList((prev) => {
      const s = new Set(prev);
      if (checked) s.add(name);
      else s.delete(name);
      return [...s];
    });
  };
  const addEAOther = () => {
    const v = (eaNew || "").trim();
    if (!v) return;
    setEaList((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setEaNew("");
  };
  const saveEA = () => {
    setRows((prev) => {
      const clone = prev.map((x) => ({ ...x }));
      if (eaApplyAll) clone.forEach((r) => (r.etkiAlani = [...eaList]));
      else if (clone[aktifIndex]) clone[aktifIndex].etkiAlani = [...eaList];
      return clone;
    });
    setEaOpen(false);
  };

  /* Kaydet – Son Değerlendirme */
  const saveSD = () => {
    setRows((prev) => {
      const clone = prev.map((x) => ({ ...x }));
      const apply = (r) => {
        const vOl = sdOl === "" || sdOl === null ? "" : Number(sdOl);
        const vSd = sdSd === "" || sdSd === null ? "" : Number(sdSd);
        r.olasilikSon = vOl === "" || Number.isNaN(vOl) ? "" : vOl;
        r.siddetSon = vSd === "" || Number.isNaN(vSd) ? "" : vSd;
        if (r.olasilikSon === "" || r.siddetSon === "" || Number.isNaN(r.olasilikSon) || Number.isNaN(r.siddetSon)) {
          r.rdsSon = "";
        } else {
          r.rdsSon = Number(r.olasilikSon) * Number(r.siddetSon);
        }
      };
      if (sdApplyAll) clone.forEach(apply);
      else if (clone[aktifIndex]) apply(clone[aktifIndex]);
      return clone;
    });
    setSdOpen(false);
  };

  /* Satır Taşı / Sil */
  const moveRow = (i, dir) => {
    setRows((prev) => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return renumberFromCurrentStart(arr);
    });
    setSelectedRows(new Set());
  };
  const onMoveUp = (i) => moveRow(i, -1);
  const onMoveDown = (i) => moveRow(i, +1);
  const onDelete = (i) => {
    setRows((prev) => {
      const arr = prev.slice(0, i).concat(prev.slice(i + 1));
      return renumberFromCurrentStart(arr);
    });
    setSelectedRows(new Set());
  };

  /* Önizleme sayfalama */
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");
  const selectedRowCount = selectedRows.size;
  const hasSelectedRows = selectedRowCount > 0;

  useEffect(() => {
    setSelectedRows((prev) => {
      const next = new Set([...prev].filter((i) => i >= 0 && i < rows.length));
      return next.size === prev.size ? prev : next;
    });
  }, [rows.length]);

  const toggleRowSelection = (i) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const clearSelectedRows = () => setSelectedRows(new Set());

  const moveSelectedRowsTo = () => {
    if (!hasSelectedRows) return;
    const targetNo = Math.max(1, Math.min(rows.length, Number(bulkMoveTarget) || 1));

    setRows((prev) => {
      const selected = [...selectedRows].sort((a, b) => a - b);
      const selectedSet = new Set(selected);
      const picked = selected.map((i) => prev[i]).filter(Boolean);
      const rest = prev.filter((_, i) => !selectedSet.has(i));
      const beforeTarget = selected.filter((i) => i < targetNo - 1).length;
      const insertAt = Math.max(0, Math.min(rest.length, targetNo - 1 - beforeTarget));
      const next = [...rest.slice(0, insertAt), ...picked, ...rest.slice(insertAt)];
      return renumberFromCurrentStart(next);
    });

    setBulkMoveTarget("");
    clearSelectedRows();
  };

  const deleteSelectedRows = () => {
    if (!hasSelectedRows) return;

    showConfirm({
      title: "Seçili satırları sil",
      message: `${selectedRowCount} satır silinecek. Onaylıyor musunuz?`,
      confirmText: "Sil",
      cancelText: "Vazgeç",
      onConfirm: () => {
        setRows((prev) => {
          const selectedSet = new Set(selectedRows);
          return renumberFromCurrentStart(prev.filter((_, i) => !selectedSet.has(i)));
        });
        clearSelectedRows();
      },
    });
  };

  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  /* PDF */
  const printRef = useRef(null);
  const pdfCacheRef = useRef({ key: "", blob: null, blobUrl: "", fileName: "" });
  const pdfCacheKey = useMemo(
    () =>
      JSON.stringify({
        rows,
        firmaAdi,
        tehlikeSinifi,
        hazirlamaTarihi,
        gecerlilikTarihi,
        revNo,
        revDate,
        pageNo,
        rowStart,
        logoSrc,
        sgkSicilNo,
      }),
    [rows, firmaAdi, tehlikeSinifi, hazirlamaTarihi, gecerlilikTarihi, revNo, revDate, pageNo, rowStart, logoSrc, sgkSicilNo]
  );

  useEffect(() => {
    if (pdfCacheRef.current.blobUrl) URL.revokeObjectURL(pdfCacheRef.current.blobUrl);
    pdfCacheRef.current = { key: "", blob: null, blobUrl: "", fileName: "" };
  }, [pdfCacheKey]);

  const getCachedPdfUrl = (blob) => {
    if (pdfCacheRef.current.blobUrl) return pdfCacheRef.current.blobUrl;
    const blobUrl = URL.createObjectURL(blob);
    pdfCacheRef.current.blobUrl = blobUrl;
    return blobUrl;
  };

  const downloadPdfBlob = (blob, fileName) => {
    const blobUrl = getCachedPdfUrl(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportPdf = async (mode = "save") => {
    if (!printRef.current) return null;

    const cached = pdfCacheRef.current;
    if (cached.key === pdfCacheKey && cached.blob) {
      if (mode === "open") {
        window.open(getCachedPdfUrl(cached.blob), "_blank", "noopener");
        return { blob: cached.blob, blobUrl: getCachedPdfUrl(cached.blob), fileName: cached.fileName };
      }
      if (mode === "bloburl") {
        return { blob: cached.blob, blobUrl: getCachedPdfUrl(cached.blob), fileName: cached.fileName };
      }
      downloadPdfBlob(cached.blob, cached.fileName);
      return { fileName: cached.fileName };
    }

    const { default: html2canvas } = await import("html2canvas");

    // unit: pt kullanıyorsun, aynen bırakıyorum.
    const doc = new jsPDF({
      format: "a4",
      unit: "pt",
      orientation: "landscape",
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const renderOnePage = async () => {
      const node = printRef.current;

      const prevOverflow = node.style.overflow;
      node.style.overflow = "visible";

      // Fontların oturmasını bekle (varsa)
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (e) {}
      }

      const canvas = await html2canvas(node, {
        // Netlik: Önizleme ile birebir keskinlik için yüksek ölçek
        scale: 1.12,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        removeContainer: true,
        scrollX: 0,
        scrollY: 0,
        width: node.scrollWidth,
        height: node.scrollHeight,
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
      });

      node.style.overflow = prevOverflow;

      const imgData = canvas.toDataURL("image/jpeg", 0.72);

      return { imgData };
    };

    const wasPreview = preview;
    if (!preview) setPreview(true);
    const oldPage = page;

    try {
      for (let p = 1; p <= totalPages; p++) {
        setPage(p);
        await new Promise((r) => setTimeout(r, 35));

        const { imgData } = await renderOnePage();

        if (p !== 1) doc.addPage();

        const marginX = 14.173; // 0.5 cm
        const marginY = 28.346; // 1 cm
        doc.addImage(
          imgData,
          "JPEG",
          marginX,
          marginY,
          pageW - 2 * marginX,
          pageH - 2 * marginY
        );
      }
    } finally {
      setPage(oldPage);
      setPreview(wasPreview);
    }

    const belgeTarihTr =
      selectedFirm?.hazirlama
        ? new Date(selectedFirm.hazirlama).toLocaleDateString("tr-TR")
        : new Date().toLocaleDateString("tr-TR");

    const safeFirma = (firmaAdi || "Firma").trim() || "Firma";
    const fileName = `${safeFirma} - Risk Değerlendirmesi - ${belgeTarihTr}.pdf`;

    const blob = doc.output("blob");
    pdfCacheRef.current = { key: pdfCacheKey, blob, blobUrl: "", fileName };

    if (mode === "open") {
      const blobUrl = getCachedPdfUrl(blob);
      window.open(blobUrl, "_blank", "noopener");
      return { blob, blobUrl, fileName };
    }

    if (mode === "bloburl") {
      const blobUrl = getCachedPdfUrl(blob);
      return { blob, blobUrl, fileName };
    }

    downloadPdfBlob(blob, fileName);
    return { fileName };
  };

  /* ==================== Belgelerime Kaydet – Risk Değerlendirmesi (aynı tarih uyarılı) */
/* Belgelerime Kaydet – Risk Değerlendirmesi (aynı tarih uyarılı) */
  /* Belgelerime Kaydet – Risk Değerlendirmesi (aynı tarih uyarılı) */
   
const saveToDocs = async () => {
  if (savingDoc || saveLockRef.current) return;

  const firmIdSafe = selectedFirm?._id || selectedFirm?.id || null;

  if (!firmIdSafe) {
    showInfo("Lütfen üst bardan bir firma seçiniz.");
    return;
  }

  if (!rows.length) {
    showInfo("Kaydedilecek satır bulunamadı. Önce risk satırları ekleyin.");
    return;
  }

  const sanitizeName = (s) =>
    (s || "Firma")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Firma";

  const parseJsonSafe = (v) => {
    try {
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  };

  const getUserObj = () =>
    parseJsonSafe(localStorage.getItem("user")) ||
    parseJsonSafe(localStorage.getItem("ticari_user")) ||
    parseJsonSafe(localStorage.getItem("bireysel_user")) ||
    parseJsonSafe(localStorage.getItem("auth_user")) ||
    parseJsonSafe(localStorage.getItem("currentUser")) ||
    null;

  const getCreatedBy = () => {
  const kisisel =
    parseJsonSafe(localStorage.getItem("kisiselBilgiler")) ||
    parseJsonSafe(localStorage.getItem("kisisel_bilgiler")) ||
    parseJsonSafe(localStorage.getItem("kisisel")) ||
    null;

  const user = getUserObj();

  const userName =
    kisisel?.adSoyad ||
    user?.name ||
    user?.adSoyad ||
    user?.fullName ||
    [user?.ad, user?.soyad || user?.surname].filter(Boolean).join(" ");

  if (userName && String(userName).trim()) {
    return String(userName).trim();
  }

  if (prosedurKisiler?.uzman) return String(prosedurKisiler.uzman).trim();

  return "İSG Uzmanı";
};

  const isBireyselUser = () => {
    const u = getUserObj();
    const role = String(u?.role || "").toLowerCase();

    if (role === "bireysel") return true;
    if (parseJsonSafe(localStorage.getItem("ticari_user"))) return false;

    return false;
  };

  const doSave = async ({ force = false } = {}) => {
    if (savingDoc || saveLockRef.current) return;

    saveLockRef.current = true;
    setSavingDoc(true);

    try {
      const KEY = "belgelerim_risk_listesi";
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];

      const belgeTarihTr =
        selectedFirm?.hazirlama
          ? new Date(selectedFirm.hazirlama).toLocaleDateString("tr-TR")
          : new Date().toLocaleDateString("tr-TR");

      const year =
        typeof belgeTarihTr === "string" && belgeTarihTr.includes(".")
          ? Number(belgeTarihTr.split(".")[2]) || new Date().getFullYear()
          : new Date().getFullYear();

      const safeFirma = sanitizeName(firmaAdi);
      const fileName = `${safeFirma} - Risk Değerlendirmesi - ${belgeTarihTr}.pdf`;

      const sameExists =
        Array.isArray(list) &&
        list.some(
          (x) =>
            String(x?.firmaId) === String(firmIdSafe) &&
            String(x?.tarih) === String(belgeTarihTr) &&
            String(x?.kategori) === "Risk Değerlendirmesi"
        );

      if (sameExists && !force) {
        setSavingDoc(false);
        saveLockRef.current = false;

        showConfirm({
          title: "Uyarı",
          message: `${firmaAdi} için ${belgeTarihTr} tarihli "Risk Değerlendirmesi" zaten kayıtlı.\n\nYine de kaydetmek ister misiniz?`,
          onConfirm: () => doSave({ force: true }),
          confirmText: "Yine de Kaydet",
          cancelText: "İptal",
        });
        return;
      }

      const createdBy = getCreatedBy();
      const userObj = getUserObj();
      const token = getAuthTokenSafe?.() || null;

      if (isBireyselUser()) {
  const pdfRes = await exportPdf("bloburl");
  const pdfBlob = pdfRes?.blob;

  if (!pdfBlob) {
    showError("PDF oluşturulamadı.");
    return;
  }

  const token = getAuthTokenSafe?.() || null;

  if (!token) {
    showError("Oturum bilgisi bulunamadı.");
    return;
  }

  const formData = new FormData();
  formData.append("file", pdfBlob, fileName);

  const uploadRes = await fetch(`${API_BASE}/documents/upload-pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.error("Bireysel PDF upload hata:", uploadRes.status, text);
    showError(`PDF yüklenemedi.\n\nHata Kodu: ${uploadRes.status}`);
    return;
  }

  const uploadJson = await uploadRes.json();
  const pdfUrl = uploadJson?.fileUrl || uploadJson?.absoluteUrl || "";
  const documentId = uploadJson?.document?._id || uploadJson?._id || null;

  if (!pdfUrl) {
    showError("PDF URL alınamadı. Lütfen tekrar deneyin.");
    return;
  }

  const serverPayload = {
    firmaId: String(firmIdSafe),
    firmaAdi: firmaAdi || "",
    category: "risk",
    subCategory: "degerlendirme",
    title: "Risk Değerlendirmesi",
    type: "Risk DeÄŸerlendirmesi",
    belgeTuru: "Risk DeÄŸerlendirmesi",
    year,
    createdBy,
createdByName: createdBy,
hazirlayan: createdBy,
hazirlayanAdSoyad: createdBy,
olusturan: createdBy,
preparedBy: createdBy,
createdByUserId: userObj?._id || userObj?.id,
    fileUrl: pdfUrl,
    fileName,
  };

  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(serverPayload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Bireysel server belge kaydı başarısız:", res.status, text);
    showError(
      `Belge server'a kaydedilemedi.\n\nHata Kodu: ${res.status}\n${text.slice(0, 300)}`
    );
    return;
  }

  let createdDoc = null;
  try {
    createdDoc = await res.json();
  } catch {
    createdDoc = null;
  }

  const yeniBelge = {
    id: createdDoc?._id || documentId || Date.now(),
    _id: createdDoc?._id || documentId || undefined,
    firmaId: String(firmIdSafe),
    firmaAdi,
    kategori: "Risk Değerlendirmesi",
    baslik: `${firmaAdi} - Risk Değerlendirmesi`,
    category: "risk",
    subCategory: "degerlendirme",
    title: "Risk DeÄŸerlendirmesi",
    type: "Risk DeÄŸerlendirmesi",
    belgeTuru: "Risk DeÄŸerlendirmesi",
    yil: year,
    durum: "Hazır",
    olusturan: createdBy,
    tarih: belgeTarihTr,
    dosyaTuru: "PDF",
    fileType: "PDF",
    fileUrl: pdfUrl,
    fileName,
    createdAt: createdDoc?.createdAt || new Date().toISOString(),
  };

  const next = Array.isArray(list) ? [yeniBelge, ...list] : [yeniBelge];
  localStorage.setItem(KEY, JSON.stringify(next));
  localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));

  try {
    window.dispatchEvent(new Event("documentsUpdated"));
    window.dispatchEvent(new Event("ticari_docs_refresh"));
    window.dispatchEvent(new Event("belgelerimUpdated"));
  } catch {}

  showInfo("Belgelerim, Risk Değerlendirme sekmesine kaydedildi ✅");
  return;
}

      const pdfRes = await exportPdf("bloburl");
      const pdfBlob = pdfRes?.blob;

      if (!pdfBlob) {
        showError("PDF oluşturulamadı.");
        return;
      }

      if (!token) {
        showError("Oturum bilgisi bulunamadı.");
        return;
      }

      const formData = new FormData();
      formData.append("file", pdfBlob, fileName);

      const uploadRes = await fetch(`${API_BASE}/documents/upload-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        console.error("PDF upload hata:", uploadRes.status, text);
        showError(`PDF yüklenemedi.\n\nHata Kodu: ${uploadRes.status}`);
        return;
      }

      const uploadJson = await uploadRes.json();
      const pdfUrl = uploadJson?.fileUrl || uploadJson?.absoluteUrl || "";
      const documentId = uploadJson?.document?._id || uploadJson?._id || null;

      if (!pdfUrl) {
        showError("PDF URL alınamadı. Lütfen tekrar deneyin.");
        return;
      }

      const serverPayload = {
        firmaId: String(firmIdSafe),
        firmaAdi: firmaAdi || "",
        category: "risk",
        subCategory: "degerlendirme",
        title: "Risk Değerlendirmesi",
        type: "Risk DeÄŸerlendirmesi",
        belgeTuru: "Risk DeÄŸerlendirmesi",
        year,
       createdBy,
createdByName: createdBy,
hazirlayan: createdBy,
hazirlayanAdSoyad: createdBy,
olusturan: createdBy,
preparedBy: createdBy,
createdByUserId: userObj?._id || userObj?.id,
        fileUrl: pdfUrl,
        fileName,
      };

      const res = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(serverPayload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Server belge kaydı başarısız:", res.status, text);
        showError(
          `Belge server'a kaydedilemedi (admin panelde görünmeyebilir).\n\nHata Kodu: ${res.status}\n${text.slice(0, 300)}`
        );
        return;
      }

      let createdDoc = null;
      try {
        createdDoc = await res.json();
      } catch {
        createdDoc = null;
      }

      const yeniBelge = {
        id: createdDoc?._id || documentId || Date.now(),
        _id: createdDoc?._id || documentId || undefined,
        firmaId: String(firmIdSafe),
        firmaAdi,
        kategori: "Risk Değerlendirmesi",
        baslik: `${firmaAdi} - Risk Değerlendirmesi`,
        category: "risk",
        subCategory: "degerlendirme",
        title: "Risk DeÄŸerlendirmesi",
        type: "Risk DeÄŸerlendirmesi",
        belgeTuru: "Risk DeÄŸerlendirmesi",
        yil: year,
        durum: "Hazır",
        olusturan: createdBy,
        tarih: belgeTarihTr,
        dosyaTuru: "PDF",
        fileType: "PDF",
        fileUrl: pdfUrl,
        fileName,
        createdAt: createdDoc?.createdAt || new Date().toISOString(),
      };

      const next = Array.isArray(list) ? [yeniBelge, ...list] : [yeniBelge];
      localStorage.setItem(KEY, JSON.stringify(next));
      localStorage.setItem(DOCS_SYNC_KEY, String(Date.now()));

     try {
  window.dispatchEvent(new Event("documentsUpdated"));
  window.dispatchEvent(new Event("ticari_docs_refresh"));
  window.dispatchEvent(new Event("belgelerimUpdated"));
} catch {}

      showInfo("Belgelerim, Risk Değerlendirme sekmesine kaydedildi ✅");
    } catch (e) {
      console.error("Belgelerime kaydedilemedi:", e);
      showError("Belge kaydedilirken bir hata oluştu.");
    } finally {
      setSavingDoc(false);
      saveLockRef.current = false;
    }
  };

  await doSave();
};

/* =============== RENDER =============== */
  return (
    <div className="w-full">
      <h2 className="font-bold text-lg mb-4">Risk Değerlendirmesi</h2>

      {/* Ara + Faaliyet Seç */}
      <div className="grid grid-cols-12 gap-3 mb-3">
        {/* ARAMA */}
        <div className="col-span-12 lg:col-span-6">
          <label className="text-xs">Faaliyet Ara</label>
          <input className="border rounded w-full px-2 h-8 text-[12px]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="örn. acil durum, kompresör..." />
          {!!query && (
            <div className="border bg-white mt-1 rounded max-h-[320px] overflow-auto text-[12px]">
              {searchResults.map((m, i) => (
                <div key={i} className="flex justify-between px-2 py-1 hover:bg-gray-50">
                  <span className="truncate">{m.data.faaliyet}</span>
                  <button className="text-[11px] border px-2 py-0.5 rounded" onClick={() => addFaaliyet(m)}>
                    {kullanilanFaaliyetler.has(m.data.faaliyet) ? "✓ Eklendi" : "Ekle"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CUSTOM DROPDOWN: FAALİYET SEÇ */}
        <div className="col-span-12 lg:col-span-6">
          <label className="text-xs">Faaliyet Seç</label>
          <div className="relative" ref={dropRef}>
            <button
              type="button"
              className="border rounded px-2 h-8 w-full text-left text-[12px] flex items-center justify-between"
              onClick={() => setDropOpen((o) => !o)}
              aria-expanded={dropOpen}
            >
              <span className="truncate">— Seç —</span>
              <span className="ml-2">▾</span>
            </button>

            {dropOpen && (
              <div className="absolute left-0 right-0 z-30 border bg-white mt-1 rounded shadow" style={{ maxHeight: 10 * 32, overflowY: "auto" }}>
                {notUsedFaaliyetler.map((adi) => (
                  <button
                    key={adi}
                    className="w-full text-left px-2 py-2 text-[12px] hover:bg-gray-50 flex justify-between"
                    onClick={() => {
  addFaaliyet(adi);
  setDropOpen(true);
}}
                    title={adi}
                  >
                    <span className="truncate">{adi}</span>
                    <span className="text-gray-500 ml-2">Ekle</span>
                  </button>
                ))}
                {notUsedFaaliyetler.length === 0 && <div className="px-2 py-2 text-[12px] text-gray-500">Tüm faaliyetler eklendi.</div>}
              </div>
            )}
          </div>
        </div>
</div>

<div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-600">
  Aradığınız faaliyet listede yer almıyorsa, değerlendirilmesini istediğiniz
  faaliyet başlığını{" "}
  <a
    href="mailto:destek@isgpanel.tr"
    className="font-semibold text-blue-700 hover:underline"
  >
    destek@isgpanel.tr
  </a>{" "}
  adresine iletebilirsiniz.
</div>

{/* TABLO — DÜZENLEME EKRANI (STICKY BAŞLIK AÇIK) */}
{rows.length > 0 && (
  <div className="mt-3 mb-2 flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm lg:flex-row lg:items-center lg:justify-between">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-slate-700">Toplu işlem</span>
      <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
        {selectedRowCount} satır seçili
      </span>
      {hasSelectedRows && (
        <PrimaryButton
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={clearSelectedRows}
        >
          Seçimi temizle
        </PrimaryButton>
      )}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <label className="text-slate-600">Hedef sıra</label>
      <input
        type="number"
        min="1"
        max={rows.length}
        className="h-8 w-24 rounded border border-slate-300 px-2"
        value={bulkMoveTarget}
        onChange={(e) => setBulkMoveTarget(e.target.value.replace(/\D/g, ""))}
        placeholder="örn. 12"
        disabled={!hasSelectedRows}
      />
      <PrimaryButton
        type="button"
        size="sm"
        className="h-8"
        onClick={moveSelectedRowsTo}
        disabled={!hasSelectedRows}
      >
        Taşı
      </PrimaryButton>
      <PrimaryButton
        type="button"
        size="sm"
        variant="outline"
        className="h-8 border-red-200 text-red-600 hover:bg-red-50"
        onClick={deleteSelectedRows}
        disabled={!hasSelectedRows}
      >
        Seçilileri sil
      </PrimaryButton>
    </div>
  </div>
)}

<ScaledWrapper maxHeight={STICKY_MAX_HEIGHT}>
        {(w) => (
          <RiskTable
  rows={rows}
  tableWidth={w}
  firmaAdi={firmaAdi}
  tehlikeSinifi={tehlikeSinifi}
  hazirlamaTarihi={hazirlamaTarihi}
  gecerlilikTarihi={gecerlilikTarihi}
  revNo={revNo}
  revDate={revDate}
  logoUrl={logoSrc}
  sgkSicilNo={sgkSicilNo}
  kisilerProsedur={prosedurKisiler}
  imzalarProsedur={prosedurImzalar}
  selectedFirm={selectedFirm}
  onEditMD={onEditMD}
  onEditSR={onEditSR}
  onEditTM={onEditTM}
  onEditEA={onEditEA}
  onEditSD={onEditSD}
  onMoveUp={onMoveUp}
  onMoveDown={onMoveDown}
  onDelete={onDelete}
  selectedRows={selectedRows}
  onToggleRow={toggleRowSelection}
  preview={false}
  stickyHeader={true}
/>
        )}
      </ScaledWrapper>

      {/* SAĞ ALT BUTONLAR – PrimaryButton ile */}
      <div className="fixed right-3 bottom-20 sm:right-4 sm:bottom-20 md:right-6 md:bottom-6 flex flex-col gap-2 z-[998]">
        {/* ✅ Yeni: Kaydet / Güncelle (faaliyetler kalıcı olsun) */}
        <PrimaryButton
  size="sm"
  variant="green"
  onClick={saveDraft}
  disabled={savingDraft || loadingDraft}
>
  {savingDraft ? "Kaydediliyor..." : draftExists ? "Güncelle" : "Kaydet"}
</PrimaryButton>

        <PrimaryButton size="sm" variant="outline" onClick={() => setPreview(true)}>
          Görüntüle
        </PrimaryButton>

        <PrimaryButton
          size="sm"
          variant="outline"
          onClick={() => {
            // Revizyonda sayfa/satır numarası KİLİTLİ OLMASIN
            setPageNoLocked(false);
            setSayfaNoInput(pageNo || "");
            setSatirStartInput(rowStart || "");
            setRevModal(true);
          }}
        >
          Revizyon
        </PrimaryButton>

        <PrimaryButton
          size="sm"
          onClick={() => {
            // Hazırla: sayfa no 20'den başlasın ve kilitli olsun
            setPageNoLocked(true);
            setSayfaNoInput("20");
            setHazirlaModal(true);
          }}
        >
          Hazırla
        </PrimaryButton>
      </div>

      {/* ÖNİZLEME (STICKY HEADER KAPALI, PDF DE BURADAN ÇEKİLİYOR) */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setPreview(false)}>
          <div
  className="relative z-[1000] bg-white w-[100vw] max-w-[100vw] max-h-[90vh] overflow-auto rounded-none"
  onClick={(e) => e.stopPropagation()}
>
            <div>
              {/* ÜST STİCKY BAR – DÖF STİLİ */}
              <div className="sticky top-0 z-[1001] bg-white/80 backdrop-blur">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold">PDF Önizleme</span>
                    <div className="text-[11px] text-gray-500">
                      {pageNo ? (
                        <>
                          Sayfa No: <b>{pageNoFor(pageNo, page)}</b>
                        </>
                      ) : (
                        <>
                          Sayfa: <b>{page}</b> / {totalPages}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span>Sayfa:</span>
                      <b>{page}</b>
                      <span>/ {totalPages}</span>
                      <div className="ml-2 flex gap-1">
                        <button className="border rounded px-2 py-[2px]" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                          ◀
                        </button>
                        <button className="border rounded px-2 py-[2px]" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
                          ▶
                        </button>
                      </div>
                    </div>

                   <div className="flex flex-col gap-1 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
  <button
    type="button"
    className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50"
    onClick={() => exportPdf("open")}
  >
    Yeni sekmede aç
  </button>

  <button
    type="button"
    className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
    onClick={() => exportPdf("save")}
  >
    İndir (PDF)
  </button>

  <PrimaryButton
    size="sm"
    variant="green"
    className="w-full sm:w-auto px-2 py-1 text-[10px] sm:text-xs"
    onClick={saveToDocs}
    disabled={savingDoc}
  >
    {savingDoc ? "Kaydediliyor..." : "Belgelerime Kaydet"}
  </PrimaryButton>

  <button
    type="button"
    className="h-7 px-2 text-[10px] rounded-md border border-gray-300 bg-white hover:bg-gray-50 leading-none"
    onClick={() => setPreview(false)}
  >
    Kapat
  </button>
</div>
                  </div>
                </div>
              </div>

              {/* 🔥 En önemli değişiklik: Preview/PDF bölümü scale'siz PrintWrapper */}
              <div ref={printRef}>
              <PrintWrapper pageText={
                  pageNo
                    ? `SAYFA NO: ${pageNoFor(pageNo, page)}`
                    : `SAYFA: ${page} / ${totalPages}`
                }>
             <RiskTable
  rows={pagedRows}
  tableWidth={TABLE_BASE_WIDTH}
  firmaAdi={firmaAdi}
  tehlikeSinifi={tehlikeSinifi}
  hazirlamaTarihi={hazirlamaTarihi}
  gecerlilikTarihi={gecerlilikTarihi}
  revNo={revNo}
  revDate={revDate}
  logoUrl={logoSrc}
  sgkSicilNo={sgkSicilNo}
  kisilerProsedur={prosedurKisiler}
  imzalarProsedur={prosedurImzalar}
  selectedFirm={selectedFirm}
  onEditMD={() => {}}
  onEditSR={() => {}}
  onEditTM={() => {}}
  onEditEA={() => {}}
  onEditSD={() => {}}
  preview={true}
  stickyHeader={false}
/>
              </PrintWrapper>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* REVİZYON MODALI */}
      {revModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setRevModal(false)}>
          <div className="relative z-[1000] bg-white p-4 rounded-xl w-[min(520px,95vw)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Revizyon</h3>

            <input className="border w-full mb-2 p-2" placeholder="Revizyon No" value={revNo} onChange={(e) => setRevNo(e.target.value)} />
            <input type="date" className="border w-full mb-3 p-2" value={revDate} onChange={(e) => setRevDate(e.target.value)} />

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs">Sayfa No</label>
                <input className="border w-full p-2" placeholder="örn. 26" value={sayfaNoInput} onChange={(e) => setSayfaNoInput(e.target.value)} />
              </div>
              <div>
                <label className="text-xs">Satır Başlangıcı</label>
                <input
                  className="border w-full p-2"
                  placeholder="örn. 150"
                  value={satirStartInput}
                  onChange={(e) => setSatirStartInput(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            <div className="text-right">
              <PrimaryButton
                size="sm"
                variant="green"
                onClick={() => {
                  setRevModal(false);
                  setPageNoLocked(false);
                  setPageNo(sayfaNoInput.trim());
                  setRowStart(satirStartInput.trim());
                  const start = satirStartInput.trim() === "" ? 1 : Number(satirStartInput.trim());
                  renumberRows(start);
                }}
              >
                Kaydet
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* HAZIRLA MODALI */}
      {hazirlaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setHazirlaModal(false)}>
          <div className="relative z-[1000] bg-white p-4 rounded-xl w-[min(420px,95vw)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Sıfırdan Hazırla</h3>

            <label className="text-xs">Sayfa No</label>
            <input className="border w-full mb-3 p-2" placeholder="20" value={sayfaNoInput} disabled={true} onChange={(e) => setSayfaNoInput(e.target.value)} />

            <div className="flex items-center justify-end gap-2">
              <PrimaryButton
                size="sm"
                variant="outline"
                onClick={() => {
                  setHazirlaModal(false);
                  setPageNo(sayfaNoInput.trim());
                }}
              >
                Kaydet
              </PrimaryButton>

              <PrimaryButton
                size="sm"
                onClick={async () => {
                  setHazirlaModal(false);
                  setPageNo(sayfaNoInput.trim());
                  setPreview(true);
                  setTimeout(async () => {
                    await exportPdf("save");
                    setPreview(false);
                  }, 120);
                }}
              >
                PDF İndir
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* MEVCUT DURUM MODALI */}
      {mdOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setMdOpen(false)}>
          <div className="relative z-[1000] bg-white p-4 rounded-xl w-[min(560px,95vw)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Mevcut Durum</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {MD_SECENEKLERI.map((opt) => (
                <label key={opt} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={mdSelected.includes(opt)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setMdSelected((prev) => {
                        const s = new Set(prev);
                        if (checked) s.add(opt);
                        else s.delete(opt);
                        return [...s];
                      });
                    }}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>

            <div className="mb-3">
              <label className="text-sm font-medium">Manuel giriş (opsiyonel)</label>
              <textarea className="border rounded w-full p-2 min-h-20 mt-1" placeholder="Eklemek istediğin özel not..." value={mdManual} onChange={(e) => setMdManual(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={mdApplyAll} onChange={(e) => setMdApplyAll(e.target.checked)} />
              Diğer satırlara da uygulansın mı?
            </label>

            <div className="text-right">
              <PrimaryButton size="sm" variant="green" onClick={saveMD}>
                Kaydet
              </PrimaryButton>
              <PrimaryButton size="sm" variant="outline" className="ml-2" onClick={() => setMdOpen(false)}>
                İptal
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* SORUMLU MODALI */}
      {srOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setSrOpen(false)}>
          <div className="relative z-[1000] bg-white p-4 rounded-xl w-[min(520px,95vw)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Sorumlu Seç</h3>

            <div className="grid grid-cols-2 gap-2">
              {SORUMLU_SECENEKLERI.map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input type="checkbox" checked={srList.includes(s)} onChange={(e) => toggleSR(s, e.target.checked)} />
                  {s}
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 my-3">
              <input type="checkbox" checked={srApplyAll} onChange={(e) => setSrApplyAll(e.target.checked)} />
              Diğer satırlara da uygulansın mı?
            </label>

            <div className="text-right">
              <PrimaryButton size="sm" variant="green" onClick={saveSR}>
                Kaydet
              </PrimaryButton>
              <PrimaryButton size="sm" variant="outline" className="ml-2" onClick={() => setSrOpen(false)}>
                İptal
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* TERMİN MODALI */}
      {tmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setTmOpen(false)}>
          <div className="relative z-[1000] bg-white p-4 rounded-xl w-[min(420px,95vw)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Termin Seç</h3>

            <select className="border rounded px-2 h-9 w-full mb-3" value={tmDeger} onChange={(e) => setTmDeger(e.target.value)}>
              <option value="">— Seç —</option>
              {TERMIN_SECENEKLERI.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={tmApplyAll} onChange={(e) => setTmApplyAll(e.target.checked)} />
              Diğer satırlara da uygulansın mı?
            </label>

            <div className="text-right">
              <PrimaryButton size="sm" variant="green" onClick={saveTM}>
                Kaydet
              </PrimaryButton>
              <PrimaryButton size="sm" variant="outline" className="ml-2" onClick={() => setTmOpen(false)}>
                İptal
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ETKİ ALANI MODALI */}
      {eaOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setEaOpen(false)}>
          <div className="relative z-[1000] bg-white p-4 rounded-xl w-[min(520px,95vw)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Etki Alanı Seç</h3>

            <div className="grid grid-cols-2 gap-2">
              {ETKI_SECENEKLERI.map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input type="checkbox" checked={eaList.includes(s)} onChange={(e) => toggleEA(s, e.target.checked)} />
                  {s}
                </label>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                className="border rounded px-2 h-9 w-full"
                placeholder="Diğer etiket…"
                value={eaNew}
                onChange={(e) => setEaNew(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEAOther();
                  }
                }}
              />
              <button className="border rounded px-3 h-9" onClick={addEAOther}>
                Ekle
              </button>
            </div>

            <label className="flex items-center gap-2 my-3">
              <input type="checkbox" checked={eaApplyAll} onChange={(e) => setEaApplyAll(e.target.checked)} />
              Diğer satırlara da uygulansın mı?
            </label>

            <div className="text-right">
              <PrimaryButton size="sm" variant="green" onClick={saveEA}>
                Kaydet
              </PrimaryButton>
              <PrimaryButton size="sm" variant="outline" className="ml-2" onClick={() => setEaOpen(false)}>
                İptal
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* SON DEĞERLENDİRME MODALI */}
      {sdOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setSdOpen(false)}>
          <div className="relative z-[1000] bg-white p-4 rounded-xl w-[min(460px,95vw)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Son Değerlendirme</h3>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs">Olasılık (Son)</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  className="border rounded px-2 h-9 w-full"
                  value={sdOl}
                  onChange={(e) => setSdOl(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs">Şiddet (Son)</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  className="border rounded px-2 h-9 w-full"
                  value={sdSd}
                  onChange={(e) => setSdSd(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 mb-3">
              <input type="checkbox" checked={sdApplyAll} onChange={(e) => setSdApplyAll(e.target.checked)} />
              Diğer satırlara da uygula
            </label>

            <div className="text-right">
              <PrimaryButton size="sm" variant="green" onClick={saveSD}>
                Kaydet
              </PrimaryButton>
              <PrimaryButton size="sm" variant="outline" className="ml-2" onClick={() => setSdOpen(false)}>
                İptal
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={confirmData.title}
        message={confirmData.message}
        variant={confirmData.variant}
        confirmText={confirmData.confirmText}
        cancelText={confirmData.cancelText}
        onConfirm={confirmData.onConfirm}
        onCancel={confirmData.onCancel}
      />
    </div>
  );
}
