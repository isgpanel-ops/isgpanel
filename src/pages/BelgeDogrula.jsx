import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function BelgeDogrula() {
  const { code } = useParams();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [code]);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/verify/${code}`
      );

      const json = await res.json();

      if (!json.ok) {
        setError(json.message || "Belge bulunamadı");
        return;
      }

      setData(json);
    } catch (e) {
      setError("Doğrulama yapılamadı");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial",
        }}
      >
        Belge doğrulanıyor...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial",
          color: "#dc2626",
        }}
      >
        ❌ {error || "Belge bulunamadı"}
      </div>
    );
  }

  const imzalar = data.imzalar || {};

  const personel = data.personel || {};

const isPersonelBelgesi =
  !!personel?.adSoyad;

const showRoleSignatures =
  !isPersonelBelgesi;

const showValidityDates =
  !isPersonelBelgesi;

const isIseBaslamaFormu =
  data?.rawType ===
  "ise-baslama-formu";

const isGenelTalimat =
  data?.rawType ===
  "genel-talimat";

const isYuksekteCalisma =
  data?.rawType ===
  "yuksekte-calisma-egitim-katilim";

const belgeTuruText =
  isYuksekteCalisma
    ? "Yüksekte Çalışma Eğitimi"
    : data?.belgeTipi || "-";

const formatDateTime = (value) => {
  if (!value) return "-";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");

  return `${dd}.${mm}.${yyyy} ${hh}:${min}:${sec}`;
};

const formatDateOnly = (value) => {
  if (!value) return "-";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}.${mm}.${yyyy}`;
};

  const renderRole = (title, item) => {
    const ok = item?.durum;

    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: ok ? "#ecfdf5" : "#fef2f2",
          marginBottom: 12,
          border: `1px solid ${
            ok ? "#bbf7d0" : "#fecaca"
          }`,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          {ok ? "✅" : "⏳"} {title}
        </div>

        <div
  style={{
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.8,
  }}
>
  <div>
    {item?.adSoyad || "Henüz doğrulanmadı"}
  </div>

  <div
    style={{
      marginTop: 4,
      fontSize: 13,
    }}
  >
    {item?.message}
  </div>

  {item?.signedAt && (
    <div
      style={{
        marginTop: 4,
        fontSize: 12,
        color: "#64748b",
      }}
    >
      İmzalama:
      {" "}
      {new Date(item.signedAt).toLocaleString(
        "tr-TR"
      )}
    </div>
  )}

  {!!item?.deviceType && (
    <div
      style={{
        fontSize: 12,
        color: "#64748b",
      }}
    >
      Cihaz:
      {" "}
      {item.deviceType}
    </div>
  )}

  {!!item?.signatureHash && (
    <div
      style={{
        marginTop: 4,
        fontSize: 11,
        color: "#94a3b8",
        wordBreak: "break-all",
      }}
    >
      Hash:
      {" "}
      {item.signatureHash.slice(0, 24)}...
    </div>
  )}
</div>
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#fff",
          borderRadius: 24,
          padding: 40,
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
          fontFamily: "Arial",
        }}
      >
        <h1
          style={{
            color: "#16a34a",
            marginBottom: 12,
          }}
        >
          ✅ Belge Doğrulandı
        </h1>

        <p
          style={{
            color: "#475569",
            marginBottom: 32,
            lineHeight: 1.7,
          }}
        >
          Bu belge İSG Panel sistemi üzerinden
          elektronik ortamda oluşturulmuş ve doğrulanmıştır.
        </p>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 16,
            padding: 20,
            marginBottom: 28,
            lineHeight: 2,
          }}
        >
          <div>
            <b>Doğrulama Kodu:</b>{" "}
            {data.verificationCode}
          </div>

          <div>
           <b>Belge Türü:</b>{" "}
{belgeTuruText}
          </div>

          <div>
            <b>Firma:</b>{" "}
            {data.firmaAdi}
          </div>

          {showValidityDates && (
  <>
    <div>
      <b>Hazırlama Tarihi:</b>{" "}
      {data.hazirlamaTarihi}
    </div>

    <div>
      <b>Geçerlilik Tarihi:</b>{" "}
      {data.gecerlilikTarihi}
    </div>
  </>
)}
        </div>

{isPersonelBelgesi && (
  <div
    style={{
      background: "#f8fafc",
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      border: "1px solid #e2e8f0",
    }}
  >
    <div
      style={{
        fontWeight: 700,
        fontSize: 18,
        marginBottom: 16,
      }}
    >
      Personel Bilgisi
    </div>

    <div
      style={{
        display: "flex",
        gap: 20,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {!!personel?.foto && (
        <img
          src={personel.foto}
          alt="Personel"
          style={{
            width: 100,
            height: 120,
            objectFit: "cover",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
          }}
        />
      )}

      <div
        style={{
          lineHeight: 2,
        }}
      >
        <div>
          <b>Ad Soyad:</b>
          {" "}
          {personel?.adSoyad || "-"}
        </div>

        <div>
          <b>T.C.:</b>
          {" "}
          {personel?.tc || "-"}
        </div>

        <div>
  <b>
  {isGenelTalimat
  ? "Talimat Tarihi:"
  : isIseBaslamaFormu
  ? "İşe Giriş Tarihi:"
  : "Eğitim Tarihi:"}
</b>{" "}
 {isGenelTalimat
  ? formatDateOnly(
      personel?.egitimTarihi
    )
  : isIseBaslamaFormu
  ? formatDateOnly(
      personel?.iseGirisTarihi
    )
  : personel?.egitimTarihiBaslangic &&
    personel?.egitimTarihiBitis
  ? `${formatDateOnly(
      personel.egitimTarihiBaslangic
    )} - ${formatDateOnly(
      personel.egitimTarihiBitis
    )}`
  : formatDateOnly(
      personel?.egitimTarihi
    )
}
</div>

        <div>
          <b>İmza Doğrulama:</b>
          {" "}
          {personel?.signedAt
            ? new Date(
                personel.signedAt
              ).toLocaleString("tr-TR")
            : "-"}
        </div>
      </div>
    </div>
  </div>
)}

        {showRoleSignatures && (
  <>
    <div
      style={{
        fontWeight: 700,
        marginBottom: 16,
        fontSize: 18,
      }}
    >
      İmza Durumu
    </div>

    {renderRole("İşveren / İşveren Vekili", imzalar.isveren)}
    {renderRole("İş Güvenliği Uzmanı", imzalar.uzman)}
    {renderRole("İşyeri Hekimi", imzalar.hekim)}
    {renderRole("Çalışan Temsilcisi", imzalar.temsilci)}
    {renderRole("Destek Elemanı", imzalar.destek)}
    {renderRole("Bilgi Sahibi Kişi", imzalar.bilgi)}
  </>
)}
      </div>
    </div>
  );
}