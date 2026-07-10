// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

function safeJsonParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function getActiveEmail() {
  return localStorage.getItem("__isg_active_email_global") || null;
}

function getStoredUser() {
  // 1) Global user
  const u1 =
    safeJsonParse(localStorage.getItem("user")) ||
    safeJsonParse(sessionStorage.getItem("user"));

  if (u1) return u1;

  // 2) Multi-email user (varsa)
  const activeEmail = getActiveEmail();
  if (activeEmail) {
    const key = `isgpanel:${activeEmail}:user`;
    const u2 = safeJsonParse(localStorage.getItem(key));
    if (u2) return u2;
  }

  return null;
}

function getStoredToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());

  // Başka tab/sekme değişikliklerinde sync olsun
  useEffect(() => {
    const onStorage = () => {
      setUser(getStoredUser());
      setToken(getStoredToken());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const role = user?.role || null;

  const isAuthenticated = !!token;

  // Rol isimlerin sende farklıysa burada genişletiriz
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin" || role === "super_admin";

  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      role,
      isAuthenticated,
      isAdmin,
      isSuperAdmin,
      setUser,
      setToken,
      logout,
      activeEmail: getActiveEmail(),
    }),
    [user, token, role, isAuthenticated, isAdmin, isSuperAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
