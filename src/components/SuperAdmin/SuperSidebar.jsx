import React from "react";
import { NavLink } from "react-router-dom";
import {
  Shield,
  LayoutDashboard,
  Users,
  Bell,
  Activity,
  FileText,
  Package,
  Receipt,
  X,
} from "lucide-react";

const base =
  "flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition";

export default function SuperSidebar({ mobileOpen = false, onMobileClose }) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:block w-72 p-4 bg-[#0a2b45] text-white min-h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
          />

          <aside className="relative w-[82%] max-w-[320px] h-full bg-[#0a2b45] text-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />

              <button
                type="button"
                onClick={onMobileClose}
                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="mt-4 flex flex-col gap-2">
              <Item to="/super" end icon={<LayoutDashboard className="w-5 h-5 shrink-0" />} label="Genel Bakış" onClick={onMobileClose} />
              <Item to="/super/kullanicilar" icon={<Users className="w-5 h-5 shrink-0" />} label="Kullanıcılar" onClick={onMobileClose} />
              <Item to="/super/faturalar" icon={<Receipt className="w-5 h-5 shrink-0" />} label="Faturalar" onClick={onMobileClose} />
              <Item to="/super/duyurular-bildirimler" icon={<Bell className="w-5 h-5 shrink-0" />} label="Duyurular & Bildirimler" onClick={onMobileClose} />
              <Item to="/super/sistem-durumu" icon={<Activity className="w-5 h-5 shrink-0" />} label="Sistem Durumu" onClick={onMobileClose} />
              <Item to="/super/teklifler" icon={<FileText className="w-5 h-5 shrink-0" />} label="Teklifler" onClick={onMobileClose} />
              <Item to="/super/paket-yonetimi" icon={<Package className="w-5 h-5 shrink-0" />} label="Paket Yönetimi" onClick={onMobileClose} />
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarContent() {
  return (
    <>
      <Brand />

      <nav className="mt-4 flex flex-col gap-2">
        <Item to="/super" end icon={<LayoutDashboard className="w-5 h-5 shrink-0" />} label="Genel Bakış" />
        <Item to="/super/kullanicilar" icon={<Users className="w-5 h-5 shrink-0" />} label="Kullanıcılar" />
        <Item to="/super/faturalar" icon={<Receipt className="w-5 h-5 shrink-0" />} label="Faturalar" />
        <Item to="/super/duyurular-bildirimler" icon={<Bell className="w-5 h-5 shrink-0" />} label="Duyurular & Bildirimler" />
        <Item to="/super/sistem-durumu" icon={<Activity className="w-5 h-5 shrink-0" />} label="Sistem Durumu" />
        <Item to="/super/teklifler" icon={<FileText className="w-5 h-5 shrink-0" />} label="Teklifler" />
        <Item to="/super/paket-yonetimi" icon={<Package className="w-5 h-5 shrink-0" />} label="Paket Yönetimi" />
      </nav>
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 min-w-0">
      <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
        <Shield className="w-5 h-5" />
      </div>

      <div className="min-w-0">
        <div className="font-semibold truncate">İSG Panel</div>
        <div className="text-xs text-white/70 truncate">Super Admin</div>
      </div>
    </div>
  );
}

function Item({ to, icon, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `${base} ${
          isActive
            ? "bg-white text-[#0a2b45] font-semibold"
            : "text-white"
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}