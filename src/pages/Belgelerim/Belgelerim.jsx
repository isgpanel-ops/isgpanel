import React, { useState } from "react";
import RiskBelgeleri from "./RiskBelgeleri";
import AcilDurumBelgeleri from "./AcilDurumBelgeleri";
import YillikPlanBelgeleri from "./YillikPlanBelgeleri";
import EgitimBelgeleri from "./EgitimBelgeleri";
import TalimatBelgeleri from "./TalimatBelgeleri";
import DefterKurulBelgeleri from "./DefterKurulBelgeleri";
import PeriyodikIsHijyeniBelgeleri from "./PeriyodikIsHijyeniBelgeleri";

const STORAGE_KEY = "belgelerim_active_tab";

export default function Belgelerim() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "risk";
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <h1 className="text-lg sm:text-xl font-bold text-[#042f4b] mb-4">
        Belgelerim
      </h1>

      <div className="border-b mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max text-sm">
          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "risk"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("risk")}
          >
            Risk Değerlendirme
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "acil"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("acil")}
          >
            Acil Durum
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "yillik"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("yillik")}
          >
            Yıllık Planlar
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "egitim"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("egitim")}
          >
            Eğitim & Sertifikalar
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "talimat"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("talimat")}
          >
            Talimatlar & KKD
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "defterKurul"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("defterKurul")}
          >
            Defter & Kurul
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "periyodik"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("periyodik")}
          >
            Periyodik & İş Hijyeni
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === "risk" && <RiskBelgeleri />}
        {activeTab === "acil" && <AcilDurumBelgeleri />}
        {activeTab === "yillik" && <YillikPlanBelgeleri />}
        {activeTab === "egitim" && <EgitimBelgeleri />}
        {activeTab === "talimat" && <TalimatBelgeleri />}
        {activeTab === "defterKurul" && <DefterKurulBelgeleri />}
        {activeTab === "periyodik" && <PeriyodikIsHijyeniBelgeleri />}
      </div>
    </div>
  );
}