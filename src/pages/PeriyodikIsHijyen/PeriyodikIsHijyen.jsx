import React, { useState } from "react";
import PeriyodikKontrolRaporlari from "./PeriyodikKontrolRaporlari";
import IsHijyenRaporlari from "./IsHijyenRaporlari";

const STORAGE_KEY = "periyodik_is_hijyen_active_tab";

export default function PeriyodikIsHijyen() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "periyodik";
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-[#042f4b] mb-4">
        Periyodik & İş Hijyen Raporları
      </h2>

      <div className="border-b mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max text-sm">
          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "periyodik"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("periyodik")}
          >
            Periyodik Kontrol Raporları
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "hijyen"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("hijyen")}
          >
            İş Hijyen Raporları
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === "periyodik" && <PeriyodikKontrolRaporlari />}
        {activeTab === "hijyen" && <IsHijyenRaporlari />}
      </div>
    </div>
  );
}