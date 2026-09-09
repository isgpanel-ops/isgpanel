import { ClipboardPlus, Stethoscope } from "lucide-react";
import { useFirmalar } from "../../context/FirmaContext";

export default function HekimModulAlani({ title }) {
  const { selectedFirm } = useFirmalar();
  const Icon = title === "Ek-2" ? ClipboardPlus : Stethoscope;

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-5 flex items-center gap-3">
        <Icon className="h-6 w-6 text-[#042f4b]" />
        <div>
          <h1 className="text-lg font-bold text-[#042f4b]">{title}</h1>
          <p className="mt-1 text-xs text-gray-500">
            {selectedFirm?.firmaAdi || "Firma seçerek işlem yapabilirsiniz."}
          </p>
        </div>
      </div>

      <section className="border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
        <Icon className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-medium text-slate-700">{title} çalışma alanı</p>
      </section>
    </div>
  );
}
