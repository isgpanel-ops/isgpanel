import React from "react";

export default function SubTabButton({
  label,
  isActive = false,
  onClick,
  size = "md", // "sm" | "md"
}) {
  const sizeClass =
    size === "sm"
      ? "px-3 py-1 text-[11px]"
      : "px-3.5 py-1.5 text-xs";

  return (
    <button
      onClick={onClick}
      className={`
        ${sizeClass}
        border-b-2
        ${
          isActive
            ? "border-[#0a2b45] text-[#0a2b45] font-semibold bg-slate-50"
            : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50"
        }
        whitespace-nowrap transition
      `}
    >
      {label}
    </button>
  );
}
