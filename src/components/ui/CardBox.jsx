import React from "react";

export default function CardBox({ children, title, className = "" }) {
  return (
    <section
      className={`
        bg-white border border-slate-200 rounded-lg
        shadow-[0_1px_3px_rgba(15,23,42,0.08)]
        px-4 py-3 md:px-5 md:py-4
        ${className}
      `}
    >
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-slate-800 tracking-tight">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}
