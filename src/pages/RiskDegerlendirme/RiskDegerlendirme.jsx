import React, { useState } from "react";
import RiskDegerlendirmeProseduru from "./RiskDegerlendirmeProseduru";
import RiskDegerlendirmesi from "./RiskDegerlendirmesi";
import RiskDegerlendirmeEkibi from "./RiskDegerlendirmeEkibi";
import Dof from "./Dof";

const STORAGE_KEY = "risk_active_tab";

export default function RiskDegerlendirme() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "prosedur";
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <h1 className="text-lg sm:text-xl font-bold text-[#042f4b] mb-4">
        Risk Değerlendirme
      </h1>

      <div className="border-b mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max text-sm">
          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "prosedur"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("prosedur")}
          >
            Risk Değerlendirme Prosedürü
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "risk"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("risk")}
          >
            Risk Değerlendirmesi
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "ekip"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("ekip")}
          >
            Risk Değerlendirme Ekibi
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "dof"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("dof")}
          >
            DÖF
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === "prosedur" && <RiskDegerlendirmeProseduru />}
        {activeTab === "risk" && <RiskDegerlendirmesi />}
        {activeTab === "ekip" && <RiskDegerlendirmeEkibi />}
        {activeTab === "dof" && <Dof />}
      </div>
    </div>
  );
}