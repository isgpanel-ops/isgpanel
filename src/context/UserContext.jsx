import React, { useState, useEffect } from "react";
import { PrimaryButton } from "../../components/ui";

export default function TicariKurumsalKimlik() {
  const [formData, setFormData] = useState({
    firmaAdi: "",
    adres: "",
    telefon: "+90 ",
    email: "",
    web: "",
    logo: null,
  });

  // ✅ Ticari kurumsal bilgileri yükle (aynı key kalsın)
  useEffect(() => {
    const saved = localStorage.getItem("ticariKurumsalBilgiler");
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
      } catch (e) {
        console.error("ticariKurumsalBilgiler parse edilemedi:", e);
      }
    }
  }, []);

  const uppercaseFields = ["firmaAdi", "adres"];

  const handleChange = (e) => {
    let { name, value } = e.target;

    if (uppercaseFields.includes(name)) {
      value = value.toLocaleUpperCase("tr-TR");
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, logo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem("ticariKurumsalBilgiler", JSON.stringify(formData));
    alert("Kurumsal Bilgiler kaydedildi ✅");
  };

  return (
    <div className="bg-white shadow-md rounded p-6 max-w-2xl mx-auto mt-6">
      <h2 className="text-lg font-bold text-[#042f4b] mb-4">
        🏢 Kurumsal Kimlik (Ticari)
      </h2>

      {/* Logo Önizleme */}
      {formData.logo && (
        <div className="mb-4 flex justify-center">
          <img
            src={formData.logo}
            alt="Logo"
            className="h-20 object-contain border p-1"
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Firma Adı
          </label>
          <input
            type="text"
            name="firmaAdi"
            value={formData.firmaAdi}
            onChange={handleChange}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Firma Adresi
          </label>
          <input
            type="text"
            name="adres"
            value={formData.adres}
            onChange={handleChange}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Telefon
          </label>
          <input
            type="tel"
            name="telefon"
            value={formData.telefon}
            onChange={handleChange}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            E-posta
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Web Sitesi
          </label>
          <input
            type="text"
            name="web"
            value={formData.web}
            onChange={handleChange}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Logo Yükle
          </label>
          <input type="file" accept="image/*" onChange={handleLogoChange} />
        </div>

        <div className="pt-2">
          <PrimaryButton
            type="submit"
            size="sm"
            variant="green"
            className="px-4 py-2 mt-2"
          >
            Kaydet
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
