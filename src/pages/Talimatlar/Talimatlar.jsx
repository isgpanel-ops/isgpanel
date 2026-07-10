import React, { useState } from "react";
import TalimatlarListesi from "./TalimatlarListesi";
import OneriTalimatlari from "./OneriTalimatlari";
import KKDListesi from "./KKDListesi";

const STORAGE_KEY = "talimatlar_active_tab";

export default function Talimatlar() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "talimatlar";
  });

  const changeTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Başlık */}
      <h2 className="text-lg sm:text-xl font-bold text-[#042f4b] mb-4">
        Talimatlar
      </h2>

      {/* Sekmeler */}
      <div className="border-b mb-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max text-sm">
          <button
            className={`pb-2 whitespace-nowrap ${
              activeTab === "talimatlar"
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => changeTab("talimatlar")}
          >
            Talimatlar
          </button>
<button
  className={`pb-2 whitespace-nowrap ${
    activeTab === "oneri"
      ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
      : "text-gray-500 hover:text-[#042f4b]"
  }`}
  onClick={() => changeTab("oneri")}
>
  Öneri Talimatları
</button>

<button
  className={`pb-2 whitespace-nowrap ${
    activeTab === "kkd"
      ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
      : "text-gray-500 hover:text-[#042f4b]"
  }`}
  onClick={() => changeTab("kkd")}
>
  KKD
</button>
        </div>
      </div>

      {/* İçerik */}
      <div className="mt-4">
  {activeTab === "talimatlar" && <TalimatlarListesi />}
  {activeTab === "oneri" && <OneriTalimatlari />}
  {activeTab === "kkd" && <KKDListesi />}
</div>
    </div>
  );
}