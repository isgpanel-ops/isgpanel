import { useEffect, useMemo, useState } from "react";
import {
  Building2, Check, ChevronDown, CircleMinus, ClipboardCheck, FileText,
  HeartPulse, Image, Search, Stethoscope, TriangleAlert, Upload, UserRound,
} from "lucide-react";
import { Modal } from "../../components/ui";
import { useFirmalar } from "../../context/FirmaContext";

const API_ORIGIN = ((import.meta.env.VITE_API_URL || "").trim() || "https://api.isgpanel.tr").replace(/\/$/, "").replace(/\/api$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";
const yesNoFields = [
  "Balgamlı öksürük", "Nefes darlığı", "Göğüs ağrısı", "Çarpıntı", "Sırt ağrısı",
  "İshal/Kabızlık", "Eklem ağrısı", "Kalp hastalığı", "Şeker hastalığı", "Böbrek rahatsızlığı",
  "Sarılık", "Mide/duodenum ülseri", "İşitme kaybı", "Görme bozukluğu", "Sinir sistemi hastalığı",
  "Deri hastalığı", "Besin zehirlenmesi", "Hastanede yatış", "Ameliyat", "İş kazası",
  "Meslek hastalığı şüphesi", "Maluliyet", "Devam eden tedavi", "Yükseklik korkusu", "Sigara", "Alkol",
];
const personalFields = [
  ["dogumYeri", "Doğum Yeri"], ["dogumTarihi", "Doğum Tarihi", "date"], ["cinsiyet", "Cinsiyet"],
  ["egitimDurumu", "Eğitim Durumu"], ["medeniDurum", "Medeni Durum"], ["telefon", "Telefon"],
  ["evAdresi", "Ev Adresi"], ["meslegi", "Mesleği"], ["yaptigiIs", "Yaptığı İş"], ["calistigiBolum", "Çalıştığı Bölüm"],
];

const status = (complete, incompleteLabel, emptyLabel) => complete
  ? { icon: Check, className: "bg-emerald-600", label: "Tamamlandı" }
  : incompleteLabel ? { icon: TriangleAlert, className: "bg-amber-500", label: incompleteLabel }
  : { icon: CircleMinus, className: "bg-slate-400", label: emptyLabel };

function StatusButton({ value, onClick }) {
  const Icon = value.icon;
  return <button type="button" onClick={onClick} title={value.label} className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-white ${value.className}`}><Icon className="h-4 w-4" /></button>;
}

const emptyPersonal = () => Object.fromEntries(personalFields.map(([key]) => [key, ""]));
const emptyExam = () => ({ muayeneTarihi: "", goz: "", kulakBurunBogaz: "", deri: "", kardiyovaskuler: "", solunum: "", sindirim: "", urogenital: "", kasIskelet: "", norolojik: "", psikiyatrik: "", tansiyon: "", nabiz: "", boy: "", kilo: "" });

export default function Ek2SaglikMuayenesi({ mode = "ek2" }) {
  const { selectedFirm } = useFirmalar();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const isTetkikler = mode === "tetkikler";

  const firmId = selectedFirm?.id || selectedFirm?._id;
  const request = async (path, options = {}) => {
    const res = await fetch(`${API_ORIGIN}/api/hekim/ek2${path}`, { ...options, headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "İşlem tamamlanamadı.");
    return res.json();
  };

  const load = async () => {
    if (!firmId) return setPeople([]);
    setLoading(true);
    try { setPeople((await request(`/firms/${firmId}`)).persons || []); } catch (error) { console.error(error); setPeople([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); setSelected([]); }, [firmId]);

  const filtered = useMemo(() => people.filter((person) => `${person.tcKimlik} ${person.adSoyad} ${person.gorev}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))), [people, query]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((person) => person.tcKimlik));
  const open = (type, person) => {
    const record = person.ek2 || {};
    const fallback = type === "kisiselBilgiler" ? emptyPersonal() : type === "muayene" ? emptyExam() : type === "tetkikler" ? { items: record.tetkikler || [] } : {};
    setDraft({ ...(fallback || {}), ...(record[type] || {}) }); setModal({ type, person });
  };
  const save = async () => {
    setSaving(true);
    try { await request(`/firms/${firmId}/persons/${modal.person.tcKimlik}/${modal.type}`, { method: "PUT", body: JSON.stringify({ data: draft }) }); await load(); setModal(null); } catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const validity = (date) => {
    if (!date) return "-";
    const dateValue = new Date(`${date}T00:00:00`); const hazard = String(selectedFirm?.tehlike || "").toLocaleLowerCase("tr-TR");
    dateValue.setFullYear(dateValue.getFullYear() + (hazard.includes("çok") || hazard.includes("cok") ? 1 : hazard.includes("az") ? 5 : 3));
    return dateValue.toLocaleDateString("tr-TR");
  };
  const bmi = draft.boy && draft.kilo ? (Number(draft.kilo) / ((Number(draft.boy) / 100) ** 2)).toFixed(1) : "";

  if (!selectedFirm) return <div className="rounded-md bg-white p-5 shadow-md text-sm text-gray-500">Devam etmek için sağ üstten firma seçiniz.</div>;

  return <div data-hekim-ek2 className="p-3 sm:p-4 md:p-6 space-y-3">
    <style>{`[data-hekim-ek2] .overflow-hidden > .overflow-x-auto { max-height: 430px; overflow: auto; } [data-hekim-ek2] table { min-width: 1480px !important; table-layout: fixed; } [data-hekim-ek2] th, [data-hekim-ek2] td { vertical-align: middle; }`}</style>
    <div><h1 className="text-xl font-bold text-[#042f4b]">{isTetkikler ? "Tetkikler" : "EK-2 Sağlık Muayenesi"}</h1><p className="mt-1 text-sm text-slate-500">{isTetkikler ? "Çalışan tetkiklerini yükleyin, kaydedin ve muayene süreciyle birlikte takip edin." : "Firma çalışanlarının sağlık muayene süreçlerini takip edebilir ve EK-2 formlarını hazırlayabilirsiniz."}</p></div>
    <section className="flex items-center gap-4 rounded-md bg-white p-4 shadow-sm"><Building2 className="h-10 w-10 text-blue-600" /><div className="min-w-0"><h2 className="truncate text-sm font-bold text-[#042f4b]">{selectedFirm.firmaAdi}</h2><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>Tehlike Sınıfı: <b>{selectedFirm.tehlike || "-"}</b></span><span>Çalışan Sayısı: <b>{people.length}</b></span><span>SGK Sicil No: <b>{selectedFirm.sgkSicilNo || selectedFirm.sgkNo || "-"}</b></span></div></div></section>
    <section className="flex flex-wrap gap-2 rounded-md bg-white p-3 shadow-sm"><label className="relative grow min-w-[220px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Personel ara (Ad, Soyad, T.C.)" className="h-9 w-full rounded border border-slate-200 pl-9 pr-3 text-xs" /></label><button type="button" onClick={() => setQuery("")} className="h-9 rounded border border-slate-200 px-5 text-xs">Temizle</button></section>
    {isTetkikler && <section className="flex flex-wrap items-center justify-end gap-2 rounded-md bg-white p-3 shadow-sm"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded border border-blue-200 bg-blue-50 px-4 text-xs font-medium text-blue-700"><Upload className="h-4 w-4" />Tetkik Yükle<input type="file" className="sr-only" onChange={(event) => { if (event.target.files?.[0]) alert(`${event.target.files[0].name} seçildi. Personel satırındaki tetkik düğmesinden kaydedebilirsiniz.`); }} /></label><button type="button" className="h-9 rounded bg-emerald-600 px-4 text-xs font-semibold text-white">Kaydet</button></section>}
    <section className="overflow-hidden rounded-md bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full table-fixed text-[10px] text-[#173257]"><thead className="bg-slate-50 text-[10px]"><tr>{[["", "w-8"],["No","w-9"],["T.C. Kimlik No","w-24"],["Ad Soyad","w-28"],["Görev","w-24"],["Muayene Tarihi","w-20"],["Kişisel Bilgiler","w-14"],["Sağlık Bilgileri","w-14"],["Muayene","w-12"],["Tetkikler","w-12"],["Sonuç","w-11"],["Geçerlilik","w-20"],["Dr. İmza","w-11"],["Personel İmza","w-14"],["Fotoğraf","w-11"]].map(([label, width], index) => <th key={index} className={`border-b border-slate-200 px-1 py-2 text-center font-semibold ${width}`}>{index === 0 ? <input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={toggleAll} /> : label}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan="15" className="p-6 text-center">Yükleniyor...</td></tr> : filtered.map((person, index) => { const ek2 = person.ek2 || {}; const personalDone = personalFields.every(([key]) => ek2.kisiselBilgiler?.[key]); const healthDone = Boolean(ek2.saglikBilgileri?.kanGrubu); const examDone = Boolean(ek2.muayene?.muayeneTarihi); return <tr key={person.tcKimlik} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-1 text-center"><input type="checkbox" checked={selected.includes(person.tcKimlik)} onChange={() => setSelected((items) => items.includes(person.tcKimlik) ? items.filter((item) => item !== person.tcKimlik) : [...items, person.tcKimlik])} /></td><td className="p-1 text-center">{index + 1}</td><td className="truncate p-1 text-center">{person.tcKimlik}</td><td className="truncate p-1 font-semibold" title={person.adSoyad}>{person.adSoyad}</td><td className="truncate p-1" title={person.gorev}>{person.gorev || "-"}</td><td className="p-1 text-center">{ek2.muayene?.muayeneTarihi ? new Date(`${ek2.muayene.muayeneTarihi}T00:00:00`).toLocaleDateString("tr-TR") : "-"}</td><td><StatusButton value={status(personalDone, personalDone ? "" : Object.keys(ek2.kisiselBilgiler || {}).length ? "Kişisel Bilgiler eksik" : "Kişisel Bilgiler henüz girilmedi")} onClick={() => open("kisiselBilgiler", person)} /></td><td><StatusButton value={status(healthDone, healthDone ? "" : Object.keys(ek2.saglikBilgileri || {}).length ? "Sağlık Bilgileri eksik" : "Sağlık Bilgileri henüz girilmedi")} onClick={() => open("saglikBilgileri", person)} /></td><td><StatusButton value={status(examDone, "Muayene henüz yapılmadı", "Muayene henüz yapılmadı")} onClick={() => open("muayene", person)} /></td><td><button title="Yüklenen tetkik sayısı" className="mx-auto flex items-center gap-1 text-blue-600"><FileText className="h-4 w-4" />{ek2.tetkikler?.length || 0}</button></td><td><StatusButton value={status(Boolean(ek2.sonuc?.kanaat), "Kanaat ve sonuç girilmedi", "Kanaat ve sonuç girilmedi")} onClick={() => open("sonuc", person)} /></td><td className="p-1 text-center">{validity(ek2.muayene?.muayeneTarihi)}</td><td><StatusButton value={status(Boolean(ek2.imzalar?.doktor), "Dr. imzası eksik", "Dr. imzası eksik")} /></td><td><StatusButton value={status(Boolean(ek2.imzalar?.personel), "Personel imzası eksik", "Personel imzası eksik")} /></td><td className="text-center"><Image className={`mx-auto h-4 w-4 ${person.personelFoto || ek2.fotoUrl ? "text-blue-500" : "text-slate-400"}`} /></td></tr>; })}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3 text-xs text-slate-600"><span>{filtered.length} kayıt gösteriliyor. {selected.length} kişi seçildi.</span><button type="button" disabled={!selected.length} onClick={() => alert("PDF adımına geçmeden önce zorunlu alan kontrolleri bu ekranda tamamlanacak.")} className="rounded bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50">Seçilenler İçin EK-2 Hazırla</button></div></section>
    <Modal isOpen={Boolean(modal)} onClose={() => setModal(null)} title={modal ? `${modal.person.adSoyad} - ${modal.type === "kisiselBilgiler" ? "Kişisel Bilgiler" : modal.type === "saglikBilgileri" ? "Sağlık Bilgileri" : modal.type === "muayene" ? "Fizik Muayene" : "Kanaat ve Sonuç"}` : ""} width="max-w-4xl" footer={<><button onClick={() => setModal(null)} className="rounded border px-4 py-2 text-xs">İptal</button><button onClick={save} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white">{saving ? "Kaydediliyor..." : "Kaydet"}</button></>}>
      {modal?.type === "kisiselBilgiler" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{[["tcKimlik", "T.C. Kimlik No", modal.person.tcKimlik, true],["adSoyad", "Ad Soyad", modal.person.adSoyad, true],["gorev", "Görev", modal.person.gorev, true]].map(([key, label, value, locked]) => <Field key={key} label={label} value={value} disabled={locked} />)}{personalFields.map(([key, label, type]) => <Field key={key} label={label} type={type || "text"} value={draft[key] || ""} onChange={(value) => setDraft({ ...draft, [key]: value })} />)}<div className="md:col-span-2"><Field label="Daha Önce Çalıştığı Yerler" value={draft.oncekiIsyerleri || ""} onChange={(value) => setDraft({ ...draft, oncekiIsyerleri: value })} /></div></div>}
      {modal?.type === "saglikBilgileri" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Field label="Kan Grubu" value={draft.kanGrubu || ""} onChange={(value) => setDraft({ ...draft, kanGrubu: value })} />{[["kronikHastalik", "Konjenital/Kronik hastalık"],["tetanoz", "Tetanoz aşı durumu"],["hepatit", "Hepatit aşı durumu"],["digerAsilar", "Diğer aşılar"]].map(([key, label]) => <Field key={key} label={label} value={draft[key] || ""} onChange={(value) => setDraft({ ...draft, [key]: value })} />)}{yesNoFields.map((label) => <div key={label} className="rounded border p-2"><label className="block text-xs font-medium">{label}</label><select value={draft[label]?.cevap || ""} onChange={(event) => setDraft({ ...draft, [label]: { ...(draft[label] || {}), cevap: event.target.value } })} className="mt-1 h-8 w-full rounded border px-2 text-xs"><option value="">Seçiniz</option><option>Evet</option><option>Hayır</option></select>{draft[label]?.cevap === "Evet" && <input value={draft[label]?.aciklama || ""} onChange={(event) => setDraft({ ...draft, [label]: { ...draft[label], aciklama: event.target.value } })} placeholder="Açıklama" className="mt-1 h-8 w-full rounded border px-2 text-xs" />}</div>)}</div>}
      {modal?.type === "muayene" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{[["muayeneTarihi","Muayene Tarihi","date"],["goz","Göz"],["kulakBurunBogaz","Kulak Burun Boğaz"],["deri","Deri"],["kardiyovaskuler","Kardiyovasküler Sistem"],["solunum","Solunum Sistemi"],["sindirim","Sindirim Sistemi"],["urogenital","Ürogenital Sistem"],["kasIskelet","Kas-İskelet Sistemi"],["norolojik","Nörolojik Muayene"],["psikiyatrik","Psikiyatrik Muayene"],["tansiyon","Tansiyon"],["nabiz","Nabız"],["boy","Boy (cm)","number"],["kilo","Kilo (kg)","number"]].map(([key,label,type]) => <Field key={key} label={label} type={type || "text"} value={draft[key] || ""} onChange={(value) => setDraft({ ...draft, [key]: value })} />)}<Field label="Vücut Kitle İndeksi" value={bmi} disabled /></div>}
      {modal?.type === "sonuc" && <div className="grid gap-3"><div><label className="text-xs font-medium">Kanaat</label><select value={draft.kanaat || ""} onChange={(event) => setDraft({ ...draft, kanaat: event.target.value })} className="mt-1 h-9 w-full rounded border px-3 text-sm"><option value="">Seçiniz</option><option>Çalışmaya uygundur</option><option>Kısıtlı çalışmaya uygundur</option><option>Uygun değildir</option></select></div><Field label="Açıklama / Kısıtlama" value={draft.aciklama || ""} onChange={(value) => setDraft({ ...draft, aciklama: value })} /></div>}
    </Modal>
  </div>;
}

function Field({ label, value, onChange, type = "text", disabled = false }) { return <div><label className="block text-xs font-medium text-slate-700">{label}</label><input type={type} value={value} disabled={disabled} onChange={(event) => onChange?.(event.target.value)} className="mt-1 h-9 w-full rounded border border-slate-200 px-3 text-sm disabled:bg-slate-100" /></div>; }
