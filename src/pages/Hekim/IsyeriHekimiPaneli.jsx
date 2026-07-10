import React from "react";

export default function IsyeriHekimiPaneli() {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[#042f4b]">
            İşyeri Hekimi Paneli
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Hoş geldiniz. Bu alan işyeri hekimi kullanıcıları için ayrılmıştır.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-full bg-slate-100 px-4 py-1 text-xs font-semibold text-slate-600">
              Yakında
            </div>

            <h2 className="text-lg font-semibold text-slate-800">
              İşyeri hekimi modülü hazırlanıyor
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Şu an bu sayfa yalnızca rol bazlı yönlendirme testleri için
              oluşturuldu. Modül içerikleri daha sonra eklenecektir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}