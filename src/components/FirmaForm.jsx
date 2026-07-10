import React, { useState } from "react";

const FirmaForm = ({ onClose, onSave }) => {
  const [firma, setFirma] = useState({
    name: "",
    sicilNo: "",
    nace: "",
    faaliyet: "",
    tehlike: "",
    adres: "",
    uzman: "",
    sertifikaNo: "",
  });

  const handleChange = (e) => {
    setFirma({ ...firma, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    if (!firma.name) {
      alert("Firma adı boş bırakılamaz.");
      return;
    }
    onSave(firma);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded shadow-lg w-96">
        <h2 className="text-lg font-bold mb-4">Yeni Firma Ekle</h2>

        <input className="border p-2 w-full mb-2" name="name" placeholder="Firma Adı" onChange={handleChange} />
        <input className="border p-2 w-full mb-2" name="sicilNo" placeholder="SGK No" onChange={handleChange} />
        <input className="border p-2 w-full mb-2" name="nace" placeholder="NACE Kodu" onChange={handleChange} />
        <input className="border p-2 w-full mb-2" name="faaliyet" placeholder="Faaliyet Alanı" onChange={handleChange} />
        <input className="border p-2 w-full mb-2" name="tehlike" placeholder="Tehlike Sınıfı" onChange={handleChange} />
        <input className="border p-2 w-full mb-2" name="adres" placeholder="Adres" onChange={handleChange} />
        <input className="border p-2 w-full mb-2" name="uzman" placeholder="Hazırlayan Uzman" onChange={handleChange} />
        <input className="border p-2 w-full mb-2" name="sertifikaNo" placeholder="Sertifika No" onChange={handleChange} />

        <div className="flex justify-end space-x-2 mt-3">
          <button onClick={onClose} className="bg-gray-400 text-white px-4 py-2 rounded">
            İptal
          </button>
          <button onClick={handleSubmit} className="bg-green-600 text-white px-4 py-2 rounded">
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirmaForm;
