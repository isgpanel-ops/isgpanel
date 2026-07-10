import React, { useState } from "react";
import AcilDurumPlani from "./AcilDurumPlani";
import AcilDurumEkipleri from "./AcilDurumEkipleri";

const STORAGE_KEY = "acil_durum_active_tab";

export default function AcilDurum() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "plan";
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-[#042f4b] mb-4">
        Acil Durum
      </h2>

      <div className="border-b mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max text-sm">
          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "plan"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("plan")}
          >
            Acil Durum Planı
          </button>

          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "ekip"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("ekip")}
          >
            Acil Durum Ekipleri
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === "plan" && <AcilDurumPlani />}
        {activeTab === "ekip" && <AcilDurumEkipleri />}
      </div>
    </div>
  );
}