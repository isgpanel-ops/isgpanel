// src/utils/logoResolver.js

export function resolveLogoSrc(formData) {
  if (!formData) return "";

  // base64 (bireysel / eski)
  if (formData.logo && String(formData.logo).startsWith("data:")) {
    return formData.logo;
  }

  // dosya yolu (ticari / yeni standart)
  if (formData.logoUrl) {
    if (String(formData.logoUrl).startsWith("http")) return formData.logoUrl;
    return formData.logoUrl; // vite proxy ile çalışır
  }

  return "";
}
