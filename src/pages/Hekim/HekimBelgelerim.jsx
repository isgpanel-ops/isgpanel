import { useState } from "react";
import { useFirmalar } from "../../context/FirmaContext";

const tabs = [
  { id: "ek-2", label: "Ek-2", title: "Ek-2" },
  { id: "tetkikler", label: "Tetkikler", title: "Tetkikler" },
];

export default function HekimBelgelerim() {
  const { selectedFirm } = useFirmalar();
  const [activeTab, setActiveTab] = useState(() => {
    const stored = localStorage.getItem("hekim_belgelerim_active_tab");
    return tabs.some((tab) => tab.id === stored) ? stored : "ek-2";
  });

  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  const changeTab = (id) => {
    setActiveTab(id);
    localStorage.setItem("hekim_belgelerim_active_tab", id);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-[#042f4b]">Belgelerim</h1>
      </div>

      <div className="mb-6 border-b overflow-x-auto">
        <div className="flex min-w-max gap-5 text-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              className={`pb-2 ${
                activeTab === tab.id
                  ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                  : "text-gray-500 hover:text-[#042f4b]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-md bg-white p-5 shadow-md">
        <h2 className="text-base font-semibold text-[#042f4b]">
          {active.title} Belgeleri
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {selectedFirm?.firmaAdi
            ? `${selectedFirm.firmaAdi} için kayıtlı belgeler bu alanda görüntülenecek.`
            : "Belgeleri görmek için lütfen sağ üstten bir firma seçiniz."}
        </p>
        <div className="mt-4 border-t border-gray-200" />
      </section>
    </div>
  );
}
