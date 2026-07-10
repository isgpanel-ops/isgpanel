import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

export default function HelpWidget({ open, onClose, context }) {
  const [step, setStep] = useState("home"); // home | faq | write
  const [faq, setFaq] = useState(null);
  const [text, setText] = useState("");
  const [displayName, setDisplayName] = useState("");

  // ✅ WhatsApp yönlendirme (UI’da numara gösterilmez)
  const goWhatsAppHelp = async () => {
  if (!text.trim()) return;

  // numara backend’de, linki backend üretir
  const res = await fetch("/api/support/whatsapp-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      path: context?.path,
      firm: context?.selectedFirmName,
      user: context?.userName,
    }),
  });

  const { url } = await res.json();

  window.open(url, "_blank", "noopener,noreferrer");

  setText("");
  onClose?.();
};


  const faqs = useMemo(
    () => [
      {
        id: 1,
        q: "Kişisel bilgilerde ad–soyad güncelleyemiyorum.",
        a: "Panel kişiye özeldir. Ad–soyad değişikliği için destek@isgpanel.tr adresine e-posta gönderiniz. İnceleme sonrası güncelleme yapılacaktır.",
      },
      {
        id: 2,
        q: "E-posta adresimi güncelleyemiyorum.",
        a: "Güvenlik nedeniyle e-posta adresi kullanıcı tarafından değiştirilemez. Güncelleme talebiniz için destek@isgpanel.tr adresine e-posta gönderiniz.",
      },
      {
        id: 3,
        q: "Hazırlamış olduğumuz evraklarda logo görünmüyor.",
        a: "Kurumsal Kimlik sekmesinden logo yükleyip kaydediniz. Ticari kullanıcıysanız logo admin tarafından yüklenmelidir. Kurumsal Kimlik sekmesine giriş yapıldığında onay işlemi otomatik tamamlanır.",
      },
      {
        id: 4,
        q: "Eğitim & sertifika toplu indirme işlemi yaparken sorun yaşıyorum.",
        a: "Toplu indirme yerine sertifikaları tek tek indirmenizi tavsiye ederiz.",
      },
    ],
    []
  );

  useEffect(() => {
  if (!open) {
    setStep("home");
    setFaq(null);
    setText("");
    return;
  }

  // ☑ widget açılınca adı localStorage'dan çek
  const name =
    localStorage.getItem("kullaniciAdSoyad") ||
    context?.name ||
    context?.userName ||
    "";

  setDisplayName(name);
}, [open, context]);


  if (!open) return null;

  const headerTitle = "Yardım";

  const openFaq = (f) => {
    setFaq(f);
    setStep("faq");
  };

  

  return (
    <div className="fixed inset-0 z-[10000]">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* panel */}
      <div className="absolute bottom-6 right-6 w-[360px] max-w-[92vw] rounded-2xl bg-white shadow-2xl border overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#042f4b]">{headerTitle}</span>
            <span className="text-[11px] text-gray-500">
              {context?.path ? `Ekran: ${context.path}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Kapat"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* body */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {step === "home" && (
            <>
              <div className="text-sm text-gray-700">
                Merhaba 👋 <b>{displayName || "Kullanıcı"}</b>


                <div className="mt-1">Sık sorulan sorulardan birini seç:</div>
              </div>

              <div className="grid gap-2">
                {faqs.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => openFaq(f)}
                    className="w-full text-left px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
                  >
                    {f.id}. {f.q}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep("write")}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-[#042f4b] text-white text-sm hover:opacity-95"
              >
                Diğer (kendim yazacağım)
              </button>

             
            </>
          )}

          {step === "faq" && (
            <>
              <div className="text-sm font-semibold text-[#042f4b]">Soru {faq?.id}</div>
              <div className="text-sm text-gray-800">{faq?.q}</div>
              <div className="text-sm text-gray-700 mt-2">{faq?.a}</div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setStep("write");
                    setText("");
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#0ea36e] text-white text-sm hover:opacity-95"
                >
                  Çözülmedi, WhatsApp’a yaz
                </button>
                <button
                  onClick={() => {
                    setStep("home");
                    setFaq(null);
                  }}
                  className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
                >
                  Geri
                </button>
              </div>
            </>
          )}

          {step === "write" && (
            <>
              <div className="text-sm font-semibold text-[#042f4b]">Bize yaz</div>
              <div className="text-[12px] text-gray-600">
                Mesajın WhatsApp yardım kanalına yönlendirilecektir.
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Kısaca sorunu yaz…"
                className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#042f4b]"
              />

             

              <div className="flex gap-2">
                <button
                  onClick={goWhatsAppHelp}
                  disabled={!text.trim()}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#0ea36e] text-white text-sm hover:opacity-95 disabled:opacity-50"
                >
                  WhatsApp Yardım
                </button>
                <button
                  onClick={() => setStep("home")}
                  className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
                >
                  İptal
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
