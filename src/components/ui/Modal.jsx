import React from "react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  headerActions,        // 👈 yeni
  width = "max-w-5xl",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div
        className={`
          bg-white rounded-lg border border-slate-200
          shadow-[0_10px_40px_rgba(15,23,42,0.35)]
          w-full ${width} max-h-[90vh] flex flex-col
        `}
      >
        {/* Üst bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm md:text-base font-semibold text-[#0a2b45] tracking-tight">
            {title}
          </h2>

          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="text-xs md:text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100"
            >
              Kapat
            </button>
          </div>
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-auto px-5 py-4 bg-white">
          {children}
        </div>

        {/* Alt bar (opsiyonel) */}
        {footer && (
          <div className="px-5 py-3 border-top border-slate-200 bg-slate-50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
