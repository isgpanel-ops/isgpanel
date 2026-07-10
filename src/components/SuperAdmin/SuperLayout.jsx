import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import SuperSidebar from "./SuperSidebar";
import SuperTopbar from "./SuperTopbar";

export default function SuperLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <SuperSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <SuperTopbar onMenuClick={() => setMobileMenuOpen(true)} />

        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}