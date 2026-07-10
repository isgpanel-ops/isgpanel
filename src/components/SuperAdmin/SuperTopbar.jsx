import React from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";

export default function SuperTopbar({ onMenuClick }) {
  const nav = useNavigate();

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    nav("/giris");
  }

  return (
    <div className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden w-10 h-10 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center shrink-0"
        >
          <Menu className="w-5 h-5 text-[#0a2b45]" />
        </button>

        <div className="text-sm text-gray-500 truncate">
          <span className="font-semibold text-[#0a2b45]">Super Admin</span> • yönetim
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div className="hidden sm:block text-sm text-gray-600 truncate max-w-[180px]">
          {user?.email || "-"}
        </div>

        <button
          className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
          onClick={logout}
        >
          Çıkış
        </button>
      </div>
    </div>
  );
}