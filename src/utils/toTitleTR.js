export function toTitleTR(str = "") {
  const s = String(str).replace(/\s+/g, " ").trim();

  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLocaleLowerCase("tr-TR");
      return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
    })
    .join(" ");
}
