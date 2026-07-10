import React, { useState } from "react";
import IseGirisEgitimi from "./IseGirisEgitimi";
import YuksekteCalismaEgitimi from "./YuksekteCalismaEgitimi";
import CalisanTemsilcisiEgitimi from "./CalisanTemsilcisiEgitimi";
import DestekAcilEkipEgitimi from "./DestekAcilEkipEgitimi";

const STORAGE_KEY = "egitim_active_tab";

export default function Egitim() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "iseGiris";
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-[#042f4b] mb-4">
        Eğitim & Sertifikalar
      </h2>

      <div className="border-b mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max text-sm">
          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "iseGiris"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("iseGiris")}
          >
            İşe Giriş Eğitimi
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "yuksekte"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("yuksekte")}
          >
            Yüksekte Çalışma Eğitimi
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "temsilci"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("temsilci")}
          >
            Çalışan Temsilcisi Eğitimi
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "destek"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("destek")}
          >
            Destek / Acil Durum Ekipleri Eğitimi
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === "iseGiris" && <IseGirisEgitimi />}
        {activeTab === "yuksekte" && <YuksekteCalismaEgitimi />}
        {activeTab === "temsilci" && <CalisanTemsilcisiEgitimi />}
        {activeTab === "destek" && <DestekAcilEkipEgitimi />}
      </div>
    </div>
  );
}