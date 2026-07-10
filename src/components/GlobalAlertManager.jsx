// src/components/GlobalAlertManager.jsx
import React, { useState, useEffect, useCallback } from "react";
import GlobalAlert from "./GlobalAlert";

const GlobalAlertManager = ({ children }) => {
  const [alertState, setAlertState] = useState({
    open: false,
    type: "info", // success | error | warning | info | confirm
    title: "",
    message: "",
    confirmText: "Tamam",
    cancelText: "Vazgeç",
    showCancel: false,
    resolver: null, // confirm için Promise
  });

  // ✅ Render sırasında tetiklenirse React uyarı verebiliyor.
  // Bu yüzden state güncellemesini microtask kuyruğuna alıyoruz (davranış değişmez).
  const showAlert = useCallback((options) => {
    Promise.resolve().then(() => {
      setAlertState({
        open: true,
        type: options.type || "info",
        title: options.title || "",
        message: options.message || "",
        confirmText: options.confirmText || "Tamam",
        cancelText: options.cancelText || "Vazgeç",
        showCancel: !!options.showCancel,
        resolver: options.resolver || null,
      });
    });
  }, []);

  const handleConfirm = () => {
    setAlertState((prev) => {
      if (prev.resolver) prev.resolver(true);
      return { ...prev, open: false, resolver: null };
    });
  };

  const handleCancel = () => {
    setAlertState((prev) => {
      if (prev.resolver) prev.resolver(false);
      return { ...prev, open: false, resolver: null };
    });
  };

  useEffect(() => {
    // Tarayıcının kendi alert'ini sakla
    const nativeAlert = window.alert;

    // Kurumsal success
    window.alertSuccess = (message, title = "İşlem Başarılı") => {
      showAlert({
        type: "success",
        title,
        message,
        showCancel: false,
      });
    };

    // Kurumsal error
    window.alertError = (message, title = "Hata Oluştu") => {
      showAlert({
        type: "error",
        title,
        message,
        showCancel: false,
      });
    };

    // Kurumsal warning
    window.alertWarning = (message, title = "Uyarı") => {
      showAlert({
        type: "warning",
        title,
        message,
        showCancel: false,
      });
    };

    // Kurumsal info
    window.alertInfo = (message, title = "Bilgi") => {
      showAlert({
        type: "info",
        title,
        message,
        showCancel: false,
      });
    };

    // Onay penceresi (yeni yazacağın kodlar için)
    window.alertConfirm = (message, options = {}) => {
      return new Promise((resolve) => {
        showAlert({
          type: "confirm",
          title: options.title || "Onay Gerekli",
          message,
          confirmText: options.confirmText || "Evet",
          cancelText: options.cancelText || "Hayır",
          showCancel: true,
          resolver: resolve,
        });
      });
    };

    // 🔥 En kritik: eski alert("...") kullanan HER YER artık kurumsal popup
    window.alert = (message) => {
      showAlert({
        type: "info",
        title: "Bilgilendirme",
        message: String(message ?? ""),
        showCancel: false,
      });
    };

    // cleanup
    return () => {
      window.alert = nativeAlert;
      delete window.alertSuccess;
      delete window.alertError;
      delete window.alertWarning;
      delete window.alertInfo;
      delete window.alertConfirm;
    };
  }, [showAlert]);

  return (
    <>
      {children}
      <GlobalAlert
        open={alertState.open}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        confirmText={alertState.confirmText}
        cancelText={alertState.cancelText}
        showCancel={alertState.showCancel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

export default GlobalAlertManager;
