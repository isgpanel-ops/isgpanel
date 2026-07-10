import React, { useState } from "react";
import YillikEgitimPlani from "./YillikEgitimPlani";
import YillikCalismaPlani from "./YillikCalismaPlani";
import YillikDegerlendirmeRaporu from "./YillikDegerlendirmeRaporu";

const STORAGE_KEY = "yillik_plan_active_tab";

export default function YillikPlanlar() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "yillikEgitim";
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Başlık */}
      <h2 className="text-lg sm:text-xl font-bold text-[#042f4b] mb-4">
        Yıllık Planlar
      </h2>

      {/* Sekmeler */}
      <div className="border-b mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max text-sm">
          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "yillikEgitim"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("yillikEgitim")}
          >
            Yıllık Eğitim Planı
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "yillikCalisma"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("yillikCalisma")}
          >
            Yıllık Çalışma Planı
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "yillikDegerlendirme"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("yillikDegerlendirme")}
          >
            Yıllık Değerlendirme Raporu
          </button>
        </div>
      </div>

      {/* İçerik */}
      <div className="mt-4">
        {activeTab === "yillikEgitim" && <YillikEgitimPlani />}
        {activeTab === "yillikCalisma" && <YillikCalismaPlani />}
        {activeTab === "yillikDegerlendirme" && (
          <YillikDegerlendirmeRaporu />
        )}
      </div>
    </div>
  );
}