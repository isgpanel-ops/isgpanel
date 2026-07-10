import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import naceList from "../data/naceTR.json"; // ← JSON'dan veriyi alıyoruz

// "011101" → "01.11.01", "4711" → "47.11", "621" → "62.1", "62" → "62"
function formatNace(input) {
  const d = (input || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.length <= 2) return d;                       // "62"
  if (d.length <= 4) return d.slice(0, 2) + "." + d.slice(2);        // "4711" → "47.11"
  return d.slice(0, 2) + "." + d.slice(2, 4) + "." + d.slice(4, 6);  // "011101" → "01.11.01"
}

function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

export default function FirmaEklePopup({ open, onClose, onSave }) {
  // JSON'u RAM'e al
  const NACE_TR = naceList || [];

  const [firmaAdi, setFirmaAdi] = useState("");
  const [naceKodu, setNaceKodu] = useState("");
  const [faaliyet, setFaaliyet] = useState("");
  const [focusField, setFocusField] = useState(null); // "code" | "activity"
  const [showList, setShowList] = useState(false);
  const listRef = useRef(null);

  // Kod yazıldıkça: formatla + eşleşirse faaliyet otomatik doldur
  useEffect(() => {
    const formatted = formatNace(naceKodu);
    if (formatted !== naceKodu) {
      setNaceKodu(formatted);
      return; // bir sonraki effect turunda eşleşmeyi yapar
    }
    const hit = NACE_TR.find((x) => x.code === formatted);
    if (hit) setFaaliyet(hit.activity);
    // eşleşme yoksa faaliyet elle kalabilir
  }, [naceKodu]); // eslint-disable-line

  // Faaliyet yazılıyorsa öneri listesi
  const activitySuggestions = useMemo(() => {
    const q = norm(faaliyet);
    if (!q) return [];
    return NACE_TR.filter(
      (x) => norm(x.activity).includes(q) || norm(x.code).includes(q)
    ).slice(0, 10);
  }, [faaliyet, NACE_TR]);

  // Kod yazılıyorsa kod önerileri
  const codeSuggestions = useMemo(() => {
    const q = norm(naceKodu).replace(/[^\d.]/g, "");
    if (!q) return [];
    return NACE_TR.filter((x) => norm(x.code).includes(q)).slice(0, 10);
  }, [naceKodu, NACE_TR]);

  // Öneriden seçim yap
  const applySuggestion = (item) => {
    setNaceKodu(item.code);
    setFaaliyet(item.activity);
    setShowList(false);
  };

  // Dış tıkla öneriyi kapat
  useEffect(() => {
    function onClick(e) {
      if (!listRef.current) return;
      if (!listRef.current.contains(e.target)) setShowList(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSave = () => {
    if (!firmaAdi.trim()) return alert("Firma adı gerekli.");
    if (!naceKodu.trim()) return alert("NACE kodu gerekli.");
    onSave?.({
      firmaAdi: firmaAdi.trim(),
      naceKodu: naceKodu.trim(),
      faaliyet: faaliyet.trim(),
    });
    onClose?.();
    setFirmaAdi(""); setNaceKodu(""); setFaaliyet("");
    setShowList(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Firma Ekle">
      <div className="grid gap-4">
        {/* Firma Adı */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Firma Adı</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0a2b45]/30"
            placeholder="Örn: ABC İnşaat A.Ş."
            value={firmaAdi}
            onChange={(e) => setFirmaAdi(e.target.value)}
          />
        </div>

        {/* NACE Kodu */}
        <div className="relative" ref={listRef}>
          <label className="block text-sm text-gray-600 mb-1">NACE Kodu</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0a2b45]/30"
            placeholder="Örn: 47.11 veya 4711"
            value={naceKodu}
            onFocus={() => { setFocusField("code"); setShowList(true); }}
            onChange={(e) => setNaceKodu(e.target.value)}
          />
          {showList && focusField === "code" && codeSuggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow max-h-60 overflow-auto">
              {codeSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <div className="font-medium">{s.code}</div>
                  <div className="text-xs text-gray-500">{s.activity}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Faaliyet */}
        <div className="relative" ref={listRef}>
          <label className="block text-sm text-gray-600 mb-1">Faaliyet</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0a2b45]/30"
            placeholder="Faaliyet yaz ve listeden seç (otomatik doldurur)"
            value={faaliyet}
            onFocus={() => { setFocusField("activity"); setShowList(true); }}
            onChange={(e) => setFaaliyet(e.target.value)}
          />
          {showList && focusField === "activity" && activitySuggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow max-h-60 overflow-auto">
              {activitySuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <div className="font-medium">{s.activity}</div>
                  <div className="text-xs text-gray-500">{s.code}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Aksiyonlar */}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm hover:bg-gray-50">
            Vazgeç
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded text-white text-sm bg-[#0a2b45] hover:opacity-90">
            Kaydet
          </button>
        </div>
      </div>
    </Modal>
  );
}
