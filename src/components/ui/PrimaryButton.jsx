import React from "react";

export default function PrimaryButton({
  children,
  onClick,
  type = "button",
  className = "",
  disabled = false,
  variant = "blue", // "blue" | "green" | "outline"
  size = "md",      // "md" | "sm"
}) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium " +
    "transition focus:outline-none focus:ring-2 focus:ring-blue-600/20 " +
    "disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";

  const sizeClasses =
    size === "sm"
      ? "px-3 py-1 text-xs"
      : "px-4 py-2 text-xs md:text-sm";

  const variants = {
    blue:
      "bg-blue-600 text-white border border-blue-600 hover:bg-blue-700",
    green:
      "bg-green-600 text-white border border-green-600 hover:bg-green-700",
    outline:
      "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizeClasses} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
