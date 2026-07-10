import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";

// ✅ EKLENDİ (API_BASE burada kullanılmasına rağmen import eksikti)
import { API_BASE } from "../config/api";

export const FirmaContext = createContext();

// ✅ Persist key
const LS_SELECTED_FIRM_KEY = "isgpanel:selectedFirm";

export function FirmaProvider({ children }) {
  const [firmalar, setFirmalar] = useState([]);
  const [selectedFirm, _setSelectedFirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const [user, setUser] = useState({ ad: "" });

  const getToken = () => localStorage.getItem("token");

  const getLocalUser = () => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // ✅ token değişimini yakala
  const [token, setToken] = useState(() => getToken());

  // ✅ LocalStorage helpers
  const readSelectedFirmLS = () => {
    try {
      const raw = localStorage.getItem(LS_SELECTED_FIRM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeSelectedFirmLS = (firmOrNull) => {
    try {
      if (!firmOrNull) localStorage.removeItem(LS_SELECTED_FIRM_KEY);
      else localStorage.setItem(LS_SELECTED_FIRM_KEY, JSON.stringify(firmOrNull));
    } catch {}
  };

  const getFirmId = (f) => f?.id || f?._id || null;

  const normalizeFirm = (f) => {
    if (!f || typeof f !== "object") return null;

    const normalized = {
      ...f,
      id: f._id || f.id,
      sgkSicilNo: f.sgkSicilNo || f.sgkNo || "",
      sgkNo: f.sgkNo || f.sgkSicilNo || "",
      nace: f.nace || f.naceKodu || f.naceKod || f.naceCode || "",
      faaliyet:
        f.faaliyet ||
        f.faaliyetAlani ||
        f.faaliyetAdi ||
        f.anaFaaliyet ||
        f.activity ||
        "",
      tehlike: f.tehlike || f.tehlikeSinifi || "",
      hazirlama: f.hazirlama || "",
      gecerlilik: f.gecerlilik || "",
    };

    return normalized;
  };

  const normalizeFirmalar = (data) => {
    // ✅ DÜZELTİLDİ: /api/firms endpoint'i { firms: [...] } döndürebilir
    const arr = Array.isArray(data)
      ? data
      : data?.firmalar || data?.firms || data?.data || [];
    return (arr || []).map(normalizeFirm).filter(Boolean);
  };

  // ✅ App açılırken hydrate (AMA: sadece geçici; firmalar gelince doğrulanacak)
  useEffect(() => {
    const cached = readSelectedFirmLS();
    if (cached) _setSelectedFirm(normalizeFirm(cached));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sync = () => setToken(getToken());

    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("token-changed", sync);

    const t = setInterval(sync, 2000);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("token-changed", sync);
      clearInterval(t);
    };
  }, []);

  // ✅ Firma detay çek (ticari_user’da /me/firms eksik dönerse bunu tamamlar)
  const lastDetailFetch = useRef({ id: null, ts: 0 });

  const fetchFirmaDetay = async (id, tkn) => {
    if (!id || !tkn) return null;
    try {
      const res = await axios.get(`${API_BASE}/firma/${id}`, {
        headers: { Authorization: `Bearer ${tkn}` },
      });
      return normalizeFirm(res.data);
    } catch (e) {
      console.warn("Firma detay çekilemedi:", e?.response?.data || e?.message || e);
      return null;
    }
  };

  const isDetailMissing = (f) => {
    if (!f) return true;
    const has = Boolean(
      (f.nace && String(f.nace).trim()) ||
        (f.faaliyet && String(f.faaliyet).trim()) ||
        (f.tehlike && String(f.tehlike).trim()) ||
        f.hazirlama ||
        f.gecerlilik
    );
    return !has;
  };

  // ✅ dışarıya bunu veriyoruz: setSelectedFirm artık LS’ye yazar + gerekiyorsa detay çekip merge eder
  const setSelectedFirm = async (firmOrNull) => {
    if (!firmOrNull) {
      _setSelectedFirm(null);
      writeSelectedFirmLS(null);
      return;
    }

    const base = normalizeFirm(firmOrNull);
    _setSelectedFirm(base);
    writeSelectedFirmLS(base);

    const id = getFirmId(base);
    const t = getToken();
    if (!id || !t) return;

    if (!isDetailMissing(base)) return;

    const now = Date.now();
    if (lastDetailFetch.current.id === id && now - lastDetailFetch.current.ts < 1500) return;
    lastDetailFetch.current = { id, ts: now };

    const detail = await fetchFirmaDetay(id, t);
    if (!detail) return;

    _setSelectedFirm((prev) => {
      if (getFirmId(prev) !== id) return prev;
      const merged = { ...prev, ...detail };
      writeSelectedFirmLS(merged);
      return merged;
    });

    setFirmalar((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.map((x) => (getFirmId(x) === id ? { ...x, ...detail } : x));
    });
  };

  // ✅ EN KRİTİK: Kullanıcının firmaları geldikten sonra seçili firmayı doğrula
  const validateSelectedFirm = async (list) => {
    const arr = Array.isArray(list) ? list : [];
    const cached = readSelectedFirmLS();
    const current = normalizeFirm(selectedFirm) || normalizeFirm(cached);

    // Kullanıcının hiç firması yoksa: kesin temizle
    if (arr.length === 0) {
      if (current) await setSelectedFirm(null);
      return;
    }

    // Seçim yoksa: burada otomatik seçim YAPMIYORUZ (senin isteğin)
    if (!current || !getFirmId(current)) {
      await setSelectedFirm(null);
      return;
    }

    // Seçili firma bu kullanıcının listesinde var mı?
    const id = getFirmId(current);
    const exists = arr.some((f) => getFirmId(f) === id);

    // Yoksa: hayalet firmayı temizle
    if (!exists) {
      await setSelectedFirm(null);
      return;
    }

    // Varsa: eksik detayları tamamla/merge et
    await setSelectedFirm(current);
  };

  const fetchFirmalar = async () => {
    const t = getToken();

    // token yoksa: firmaları çekemeyiz, ama selectedFirm'i KÖRLEŞTİRME
    if (!t) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const lu = getLocalUser();
      const role = (lu?.role || "").toString().toLowerCase();

      // ✅ DÜZELTİLDİ: ticari_user firmalarını /api/firms üzerinden almalı
      const endpoint = role === "ticari_user" ? "/firms" : "/firma";

      const res = await axios.get(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${t}` },
      });

      const list = normalizeFirmalar(res.data);
      setFirmalar(list);

      // ✅ burada doğrulama yapıyoruz (hayalet firma sorunu biter)
      await validateSelectedFirm(list);
    } catch (err) {
      console.error("Firma çekme hatası:", err);

      // hata olursa: seçili firmayı LS’den korumaya çalışma; çünkü bu hayalet firmayı geri getirir
      // en güvenlisi: temizle
      await setSelectedFirm(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirmalar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addFirma = async (firmaData) => {
    const t = getToken();
    if (!t) return;

    const res = await axios.post(`${API_BASE}/firma`, firmaData, {
      headers: { Authorization: `Bearer ${t}` },
    });

    const newFirma = normalizeFirm(res.data);

    setFirmalar((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const id = getFirmId(newFirma);
      if (id && arr.some((x) => getFirmId(x) === id)) return arr;
      return [newFirma, ...arr];
    });

    // yeni firma eklenince seç (mantığın aynı)
    await setSelectedFirm(newFirma);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("user");
    localStorage.removeItem(LS_SELECTED_FIRM_KEY);

    setFirmalar([]);
    _setSelectedFirm(null);
    setUser({ ad: "" });

    setToken(null);

    window.dispatchEvent(new Event("token-changed"));
  };

  const value = useMemo(
    () => ({
      firmalar,
      setFirmalar,
      selectedFirm,
      setSelectedFirm,
      user,
      setUser,
      loading,
      fetchFirmalar,
      addFirma,
      logout,
    }),
    [firmalar, selectedFirm, user, loading]
  );

  return <FirmaContext.Provider value={value}>{children}</FirmaContext.Provider>;
}

export function useFirmalar() {
  return useContext(FirmaContext);
}
