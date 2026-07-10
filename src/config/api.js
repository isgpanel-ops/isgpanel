// isgpanel/src/config/api.js

/**
 * Prod (Vercel) için:
 *   VITE_API_URL = "https://api.domain.com/api"
 *
 * Local geliştirme için (env yoksa):
 *   http://localhost:5001/api
 */
export const API_BASE =
  (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") || "https://api.isgpanel.tr";
