import { useUser } from "../context/UserContext";
import { useState } from "react";

export default function PersonalInfoCard() {
  const { user, setUser } = useUser();
  const [form, setForm] = useState(user);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSave = () => {
    setUser(form);
    alert("✅ Bilgiler kaydedildi!");
  };

  return (
    <div className="bg-white shadow-md rounded-xl p-6 space-y-4 border border-slate-200">
      <h2 className="text-lg font-bold text-slate-800 mb-2">Kişisel Bilgiler</h2>

      <input
        type="text"
        name="name"
        placeholder="Ad Soyad"
        value={form.name}
        onChange={handleChange}
        className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
      />

      <input
        type="text"
        name="certificateNo"
        placeholder="Sertifika No"
        value={form.certificateNo}
        onChange={handleChange}
        className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
      />

      <input
        type="text"
        name="role"
        placeholder="Görev / Unvan"
        value={form.role}
        onChange={handleChange}
        className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
      />

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" className="w-4 h-4" /> Bilgilerimi onaylıyorum
      </label>

      <button
        onClick={handleSave}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Kaydet
      </button>
    </div>
  );
}