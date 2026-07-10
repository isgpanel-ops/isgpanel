import React, { useState } from "react";
import DefterNushalari from "./DefterNushalari";
import KurulNushalari from "./KurulNushalari";

const STORAGE_KEY = "defter_kurul_active_tab";

export default function DefterKurul() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "defter";
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-[#042f4b] mb-4">
        Defter & Kurul
      </h2>

      <div className="border-b mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max text-sm">
          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "defter"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("defter")}
          >
            Defter Nüshaları
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "kurul"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("kurul")}
          >
            Kurul Nüshaları
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === "defter" && <DefterNushalari />}
        {activeTab === "kurul" && <KurulNushalari />}
      </div>
    </div>
  );
}