import { useEffect, useState } from "react";

export default function UserFirmalarim() {
  const [firms, setFirms] = useState([]);

  useEffect(() => {
    // TODO: Backend'den şu kullanıcıya atanmış firmaları çekeceğiz:
    // /api/ticari/firmalarim
    // Şimdilik örnek veri:
    setFirms([
      {
        id: 1,
        ad: "Örnek X Ltd. Şti.",
        tehlike: "Çok Tehlikeli",
        sonIslem: "07.12.2025",
      },
      {
        id: 2,
        ad: "Y Örnek A.Ş.",
        tehlike: "Tehlikeli",
        sonIslem: "01.12.2025",
      },
    ]);
  }, []);

  const handlePaneleGir = (firma) => {
    // İLERİDE:
    // - Seçilen firmayı context/localStorage'a yaz
    // - Bireysel panel benzeri bir sayfaya yönlendir (risk, acil, yıllık vb.)
    // Şimdilik sadece console.log:
    console.log("Panele girilecek firma:", firma);
  };

  const handleBelgeleriIndir = (firma) => {
    console.log("Belgeleri indirilecek firma:", firma);
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Firmalarım</h2>
        <p className="text-xs text-slate-500">
          Sana atanmış firmaları buradan görüntüleyebilir ve panel ekranına
          geçerek işlemlerini yapabilirsin.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="text-left px-3 py-2 rounded-l-lg">Firma Adı</th>
              <th className="text-left px-3 py-2">Tehlike Sınıfı</th>
              <th className="text-left px-3 py-2">Son İşlem</th>
              <th className="text-right px-3 py-2 rounded-r-lg">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {firms.map((firma) => (
              <tr
                key={firma.id}
                className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
              >
                <td className="px-3 py-2 font-medium text-slate-800">
                  {firma.ad}
                </td>
                <td className="px-3 py-2 text-slate-600">{firma.tehlike}</td>
                <td className="px-3 py-2 text-slate-500">{firma.sonIslem}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handlePaneleGir(firma)}
                      className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      Panele Gir
                    </button>
                    <button
                      onClick={() => handleBelgeleriIndir(firma)}
                      className="text-xs px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50"
                    >
                      Belgeleri İndir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {firms.length === 0 && (
              <tr>
                <td
                  colSpan="4"
                  className="text-center py-6 text-slate-500 text-sm"
                >
                  Henüz sana atanmış firma bulunmuyor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
