// src/utils/authToken.js
export function getToken() {
  // ✅ 1) Senin projende token burada
  const s = sessionStorage.getItem("token");
  if (s && s.length > 20) return s;

  // ✅ 2) fallback (ileride lazım olabilir)
  const l =
    localStorage.getItem("token") ||
    localStorage.getItem("isgpanelToken") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken");
  if (l && l.length > 20) return l;

  return null;
}

export function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
