// src/components/RiskProseduruButton.jsx
import React from "react";

const RiskProseduruButton = ({ selectedFirma }) => {
  // 🔵 1) ESKİ WORD (DOCX) BUTONU – HİÇ DEĞİŞMEDİ
  const handleWordClick = async () => {
    if (!selectedFirma) {
      alert("Lütfen önce bir firma seçiniz.");
      return;
    }

    const response = await fetch(
      "http://localhost:5000/generate-risk-doc",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedFirma),
      }
    );

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RiskProseduru_${selectedFirma.name || selectedFirma.firmaAdi || "FIRMA"}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // 🔴 2) YENİ PDF KAPAK BUTONU – KURUMSAL LOGOYU GÖNDERİYOR
  const handlePdfClick = async () => {
    if (!selectedFirma) {
      alert("Lütfen önce bir firma seçiniz.");
      return;
    }

    // KurumsalKimlik sayfasında kaydedilen veriler
    const saved = localStorage.getItem("kurumsalBilgiler");
    const kurumsal = saved ? JSON.parse(saved) : {};

    // Sadece logoUrl'i createPdf'e geçiyoruz
    const body = {
      kurumsal: {
        logoUrl: kurumsal.logo || "",
      },
      // İleride istersen buraya firma bilgilerini de ekleriz (firmaAdi, sgk, tehlike sınıfı vb.)
    };

    const response = await fetch(
      "http://localhost:5001/api/pdf/prosedur",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      alert("PDF oluşturulurken bir hata oluştu.");
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    // Yeni sekmede açıyoruz, istersen indirilebilir de yapabiliriz
    window.open(url, "_blank");
  };

  return (
    <div className="flex gap-2">
      {/* WORD DOKÜMAN BUTONU (ESKİ) */}
      <button
        onClick={handleWordClick}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        📄 Risk Değerlendirme Prosedürü (Word)
      </button>

      {/* PDF KAPAK BUTONU (YENİ) */}
      <button
        onClick={handlePdfClick}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        📑 Risk Değerlendirme Kapak (PDF)
      </button>
    </div>
  );
};

export default RiskProseduruButton;
