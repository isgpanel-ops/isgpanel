import React from "react";

export default function SectionTitle({ title, subtitle, icon }) {
  return (
    <header className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-md bg-slate-50 border border-slate-200">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-[15px] md:text-base font-semibold text-[#0a2b45] tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      {/* ince kurumsal alt çizgi */}
      <div className="mt-3 h-px bg-slate-200" />
    </header>
  );
}
