import { Link } from "react-router-dom";
import {
  FaBuilding,
  FaCheckCircle,
  FaCloud,
  FaFilePdf,
  FaShieldAlt,
  FaUser,
} from "react-icons/fa";

const highlights = [
  "Risk değerlendirme, acil durum ve belge süreçleri tek panelde",
  "OSGB ve kurumsal ekipler için düzenli kayıt takibi",
  "Denetime hazır, izlenebilir ve pratik iş güvenliği yönetimi",
];

const stats = [
  { icon: FaShieldAlt, value: "6331", label: "Kanuna uyumlu süreç" },
  { icon: FaCloud, value: "7/24", label: "bulut erişimi" },
  { icon: FaFilePdf, value: "PDF", label: "dijital çıktı" },
];

function LoginCard({ elevated = false }) {
  return (
    <div
      className={`mx-auto w-full max-w-md rounded-2xl bg-white px-8 py-8 text-center ${
        elevated ? "shadow-2xl ring-1 ring-slate-200/80" : "shadow-xl"
      }`}
    >
      <img
        src="/logo-login.png"
        alt="İSG Panel"
        className="mx-auto mb-8 h-28 w-auto"
      />

      <div className="space-y-4">
        <Link
          to="/login/uzman"
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 md:text-base"
        >
          <FaUser className="text-base" />
          Bireysel Uzman Girişi
        </Link>

        <Link
          to="/login/osgb"
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-green-600 text-sm font-semibold text-white shadow-md transition hover:bg-green-700 md:text-base"
        >
          <FaBuilding className="text-base" />
          Kurumsal/OSGB Girişi
        </Link>
      </div>

      <p className="mt-8 text-xs text-slate-500">
        © 2026 İSG Panel — Tüm Hakları Saklıdır
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100">
      <section className="hidden min-h-screen grid-cols-[1.03fr_0.97fr] lg:grid">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#08283d_0%,#0b3f4d_46%,#10805d_100%)] px-14 py-12 text-white">
          <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
          <div className="absolute left-0 top-0 h-full w-full opacity-[0.08]">
            <div className="h-full w-full bg-[linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.18)_1px,transparent_1px)] bg-[size:72px_72px]" />
          </div>

          <div className="relative flex h-full max-w-3xl flex-col justify-center">
            <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-100">
              <FaShieldAlt className="text-emerald-300" />
              İş sağlığı ve güvenliği yönetim platformu
            </div>

            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">
              İSG yönetim ekranı
            </p>
            <h1 className="max-w-2xl text-6xl font-semibold leading-[1.04] tracking-normal">
              İSG süreçlerinizi tek panelden yönetin.
            </h1>
            <div className="mt-7 h-1.5 w-20 rounded-full bg-red-500" />
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-200">
              Risk analizi, acil durum planı, eğitim takibi, sertifika ve
              doküman yönetimini sade, denetime hazır ve izlenebilir bir yapıda
              toplayın.
            </p>

            <div className="mt-10 space-y-4">
              {highlights.map((item) => (
                <div key={item} className="flex items-center gap-3 text-slate-100">
                  <FaCheckCircle className="shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-4">
              {stats.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-4"
                >
                  <Icon className="mb-3 text-xl text-emerald-300" />
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="mt-1 text-sm leading-5 text-slate-200">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f8fb] px-12">
          <div className="w-full max-w-xl">
            <div className="mb-8 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Güvenli giriş
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-[#0b3146]">
                Tekrar hoş geldiniz
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                Giriş tipinizi seçerek İSG Panel hesabınıza devam edin.
              </p>
            </div>

            <LoginCard elevated />

            <div className="mt-8 flex items-center justify-center gap-8 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <FaCheckCircle className="text-green-600" />
                Verileriniz bu cihazda saklanır
              </span>
              <span className="inline-flex items-center gap-2">
                <FaCheckCircle className="text-green-600" />
                Güvenli yerel erişim
              </span>
            </div>
          </div>

        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center p-6 lg:hidden">
        <LoginCard />
      </section>
    </main>
  );
}
