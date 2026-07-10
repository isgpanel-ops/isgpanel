import React from "react";

const AcilDurumButton = ({ selectedFirma }) => {
  const handleClick = async () => {
    if (!selectedFirma) {
      alert("Lütfen önce bir firma seçiniz.");
      return;
    }

    const response = await fetch("http://localhost:5000/generate-acil-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selectedFirma),
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AcilDurumPlani_${selectedFirma.name}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <button
      onClick={handleClick}
      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
    >
      🚨 Acil Durum Planı Hazırla
    </button>
  );
};

export default AcilDurumButton;
