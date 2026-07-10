import React, { useEffect, useMemo, useState } from "react";

import TicariRiskBelgeleri from "./TicariRiskBelgeleri";
import TicariAcilDurumBelgeleri from "./TicariAcilDurumBelgeleri";
import TicariYillikPlanBelgeleri from "./TicariYillikPlanBelgeleri";
import TicariEgitimBelgeleri from "./TicariEgitimBelgeleri";
import TicariTalimatBelgeleri from "./TicariTalimatBelgeleri";
import TicariDefterKurulBelgeleri from "./TicariDefterKurulBelgeleri";
import TicariPeriyodikBelgeleri from "./TicariPeriyodikBelgeleri";

const LS_ACTIVE_TAB_KEY = "isgpanel:ticariBelgelerActiveTab";

// 🔎 yeni: liste kontrol barı ayarları
const LS_SEARCH_KEY = "isgpanel:ticariBelgelerSearch";
const LS_SORT_KEY = "isgpanel:ticariBelgelerSort";
const LS_PAGE_SIZE_KEY = "isgpanel:ticariBelgelerPageSize";

const TAB_LABELS = {
  risk: "Risk Değerlendirme",
  acil: "Acil Durum",
  yillik: "Yıllık Planlar",
  egitim: "Eğitim & Sertifikalar",
  talimat: "Talimatlar",
  periyodik: "Periyodik & İş Hijyeni",
  defter: "Defter & Kurul",
};

export default function TicariBelgeler() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(LS_ACTIVE_TAB_KEY) || "risk"
  );

  // 🔎 yeni: arama / sıralama / sayfalama state’leri
  const [searchText, setSearchText] = useState(
    () => localStorage.getItem(LS_SEARCH_KEY) || ""
  );
  const [sortDir, setSortDir] = useState(
    () => localStorage.getItem(LS_SORT_KEY) || "asc" // asc: A->Z, desc: Z->A
  );
  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(localStorage.getItem(LS_PAGE_SIZE_KEY));
    return [10, 25, 50].includes(saved) ? saved : 10;
  });

  useEffect(() => {
    localStorage.setItem(LS_ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem(LS_SEARCH_KEY, searchText);
  }, [searchText]);

  useEffect(() => {
    localStorage.setItem(LS_SORT_KEY, sortDir);
  }, [sortDir]);

  useEffect(() => {
    localStorage.setItem(LS_PAGE_SIZE_KEY, String(pageSize));
  }, [pageSize]);

  // child component’lere tek prop seti
  const listControls = useMemo(
    () => ({
      searchText,
      sortDir,
      pageSize,
    }),
    [searchText, sortDir, pageSize]
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#042f4b] mb-2">Belgeler</h1>

      {/* Sekmeler */}
      <div className="flex gap-6 border-b mb-4 text-sm overflow-x-auto whitespace-nowrap pb-1">
        {Object.keys(TAB_LABELS).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pb-2 ${
              activeTab === tab
                ? "border-b-2 border-[#042f4b] font-semibold text-[#042f4b]"
                : "text-gray-500 hover:text-[#042f4b]"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* 🔎 Kontrol barı (kompakt) */}
<div className="flex items-center justify-between gap-2 mb-4">
  {/* Arama */}
  <div className="relative w-full max-w-[420px]">
    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10.5 18.5C14.9183 18.5 18.5 14.9183 18.5 10.5C18.5 6.08172 14.9183 2.5 10.5 2.5C6.08172 2.5 2.5 6.08172 2.5 10.5C2.5 14.9183 6.08172 18.5 10.5 18.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21.5 21.5L17.2 17.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>

    <input
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
      placeholder="Firma / SGK ara..."
      className="w-full pl-8 pr-3 py-1.5 rounded-xl border bg-white text-sm outline-none focus:ring-2 focus:ring-[#042f4b]/20"
    />
  </div>

  {/* Sağ kontroller */}
  <div className="flex items-center gap-2">
    {/* A-Z / Z-A */}
    <button
      type="button"
      onClick={() => setSortDir((p) => (p === "asc" ? "desc" : "asc"))}
      className="px-2.5 py-1.5 rounded-xl border bg-white text-sm hover:bg-gray-50"
      title="Sırala"
    >
      <span className="font-semibold">
        {sortDir === "asc" ? "A→Z" : "Z→A"}
      </span>
    </button>

    {/* Göster */}
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span className="hidden sm:block">Göster:</span>
      <select
        value={pageSize}
        onChange={(e) => setPageSize(Number(e.target.value))}
        className="px-2.5 py-1.5 rounded-xl border bg-white text-sm outline-none"
      >
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
      </select>
    </div>
  </div>
</div>


      {/* İçerik */}
      {activeTab === "risk" && <TicariRiskBelgeleri {...listControls} />}
      {activeTab === "acil" && <TicariAcilDurumBelgeleri {...listControls} />}
      {activeTab === "yillik" && (
        <TicariYillikPlanBelgeleri {...listControls} />
      )}
      {activeTab === "egitim" && <TicariEgitimBelgeleri {...listControls} />}
      {activeTab === "talimat" && <TicariTalimatBelgeleri {...listControls} />}
{activeTab === "periyodik" && <TicariPeriyodikBelgeleri {...listControls} />}
{activeTab === "defter" && <TicariDefterKurulBelgeleri {...listControls} />}
    </div>
  );
}
