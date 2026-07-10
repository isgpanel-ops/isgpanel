// src/components/GlobalAlert.jsx
import React from "react";

const GlobalAlert = ({
  open,
  type,
  title,
  message,
  confirmText,
  cancelText,
  showCancel,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const typeStyles = {
    success: "border-[#28a745]",
    error: "border-[#dc3545]",
    warning: "border-[#ffc107]",
    info: "border-[#0d6efd]",
    confirm: "border-[#0d6efd]",
  };

  const iconBg = {
    success: "bg-green-100",
    error: "bg-red-100",
    warning: "bg-yellow-100",
    info: "bg-blue-100",
    confirm: "bg-blue-100",
  };

  const iconEmoji = {
    success: "✔️",
    error: "⚠️",
    warning: "⚠️",
    info: "ℹ️",
    confirm: "❓",
  };

  const confirmColorClass =
    type === "error"
      ? "bg-[#dc3545] hover:bg-[#c82333]"
      : type === "success"
      ? "bg-[#28a745] hover:bg-[#218838]"
      : "bg-[#0d6efd] hover:bg-[#0b5ed7]";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className={
          "w-full max-w-md mx-4 rounded-xl bg-white shadow-xl border-t-4 " +
          (typeStyles[type] || typeStyles.info)
        }
      >
        {/* Üst */}
        <div className="flex items-start gap-3 p-4 border-b border-slate-100">
          <div
            className={
              "flex h-8 w-8 items-center justify-center rounded-full " +
              (iconBg[type] || iconBg.info)
            }
          >
            <span className="text-[18px]">{iconEmoji[type] || iconEmoji.info}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-xs font-semibold text-[#0a2b45] uppercase">
              {title || "Bilgilendirme"}
            </h2>
            <p className="mt-1 text-sm text-slate-700 whitespace-pre-line leading-[18px]">
              {message}
            </p>
          </div>
        </div>

        {/* Alt butonlar */}
        <div className="flex justify-end gap-2 px-4 py-3 bg-slate-50 rounded-b-xl">
          {showCancel && (
            <button
              onClick={onCancel}
              className="min-w-[70px] px-3 py-1.5 text-[12px] font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 transition"
            >
              {cancelText || "Vazgeç"}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={
              "min-w-[75px] px-3 py-1.5 text-[12px] font-semibold rounded-md text-white transition shadow-sm " +
              confirmColorClass
            }
          >
            {confirmText || "Tamam"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalAlert;
