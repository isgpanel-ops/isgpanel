import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

function parseStored(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function normalizeCompany(company) {
  if (!company || typeof company !== "object") return null;
  const id =
    company._id ||
    company.id ||
    company.firmaId ||
    company.companyId ||
    company.sirketId ||
    company.sgkSicilNo ||
    company.sgk;
  const name =
    company.firmaAdi ||
    company.companyName ||
    company.name ||
    company.unvan ||
    company.firma ||
    "";
  if (!id && !name) return null;
  return { id: String(id || name), name: String(name || id) };
}

function findStoredCompany() {
  const activeEmail = localStorage.getItem("__isg_active_email_global") || "";
  const keys = [
    `isgpanel:${activeEmail}:selectedFirm`,
    `isgpanel:${activeEmail}:selectedFirma`,
    "selectedFirm",
    "selectedFirma",
    "currentFirm",
    "currentFirma",
    "firma",
  ];

  for (const store of [localStorage, sessionStorage]) {
    for (const key of keys) {
      const found = normalizeCompany(parseStored(store.getItem(key)));
      if (found) return found;
    }

    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key || !/firm|firma|company/i.test(key)) continue;
      const found = normalizeCompany(parseStored(store.getItem(key)));
      if (found) return found;
    }
  }

  return null;
}

export default function DenetimeHazirlanButton({ company, className = "" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCompany = useMemo(() => normalizeCompany(company) || findStoredCompany(), [company]);
  const disabled = !selectedCompany?.id;

  const basePath = location.pathname.startsWith("/ticari/admin")
    ? "/ticari/admin"
    : location.pathname.startsWith("/ticari/user")
      ? "/ticari/user"
      : "/panel";

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "Denetim dosyası oluşturmak için önce firma seçiniz." : "Denetim dosyası oluştur"}
      onClick={() =>
        navigate(`${basePath}/denetim/hazirla`, {
          state: { company: selectedCompany },
        })
      }
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition ${
        disabled
          ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
          : "bg-blue-600 text-white hover:bg-blue-700"
      } ${className}`}
    >
      <ShieldCheck size={17} />
      Denetime Hazırlan
    </button>
  );
}
